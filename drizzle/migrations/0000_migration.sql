create type public.app_role as enum ('admin','moderator','user');
create type public.recruiter_type as enum ('in_house','agency');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create table public.recruiters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique,
  type recruiter_type not null,
  approved boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.recruiters to anon;
grant select, insert, update on public.recruiters to authenticated;
grant all on public.recruiters to service_role;
alter table public.recruiters enable row level security;

create policy "Public reads approved recruiters" on public.recruiters for select to anon, authenticated
  using (approved or created_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Users add unapproved recruiters" on public.recruiters for insert to authenticated
  with check (created_by = auth.uid() and approved = false);
create policy "Admins update recruiters" on public.recruiters for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.recruiters(id) on delete cascade,
  user_id uuid not null,
  sector text not null,
  role_level text not null check (role_level in ('entry','experienced','senior','internship','temporary')),
  outcome text not null check (outcome in ('offer_accepted','offer_declined','rejected_applying','rejected_interview','withdrew','never_heard','still_waiting')),
  rating_communication smallint check (rating_communication between 1 and 5),
  rating_honesty smallint check (rating_honesty between 1 and 5),
  rating_respect smallint check (rating_respect between 1 and 5),
  rating_relevance smallint check (rating_relevance between 1 and 5),
  rating_feedback smallint check (rating_feedback between 1 and 5),
  time_to_answer text not null check (time_to_answer in ('under_2w','2_4w','1_2m','over_2m','still_waiting')),
  pay_disclosed text not null check (pay_disclosed in ('advert','first_contact','offer','never')),
  red_flags text[] not null default '{}',
  overall smallint not null check (overall between 1 and 5),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recruiter_id, user_id)
);
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;

create policy "Public reads published reviews" on public.reviews for select to anon, authenticated
  using ((status = 'published' and exists (select 1 from public.recruiters r where r.id = recruiter_id and r.approved)) or user_id = auth.uid());
create policy "Users create own reviews" on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'published');
create policy "Users edit own reviews" on public.reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'published');
create policy "Users delete own reviews" on public.reviews for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

-- Private demographics, never public
create table public.review_demographics (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  user_id uuid not null,
  age_band text not null default 'prefer_not',
  gender text not null default 'prefer_not',
  ethnic_group text not null default 'prefer_not',
  disability text not null default 'prefer_not',
  adjustments text not null default 'prefer_not',
  parent_occupation text not null default 'prefer_not',
  qualification text not null default 'prefer_not',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.review_demographics to authenticated;
grant all on public.review_demographics to service_role;
alter table public.review_demographics enable row level security;
create policy "Users manage own demographics" on public.review_demographics for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));

-- Public scores (min 5 reviews)
create or replace function public.recruiter_stats(_recruiter_id uuid)
returns json language sql stable security definer set search_path = public
as $$
  with r as (
    select rv.* from public.reviews rv join public.recruiters rc on rc.id = rv.recruiter_id
    where rv.recruiter_id = _recruiter_id and rv.status = 'published' and rc.approved
  ), c as (select count(*)::int n from r)
  select json_build_object(
    'review_count', c.n,
    'enough', c.n >= 5,
    'overall', case when c.n >= 5 then (select round(avg(overall)::numeric,1) from r) end,
    'communication', case when c.n >= 5 then (select round(avg(rating_communication)::numeric,1) from r) end,
    'honesty', case when c.n >= 5 then (select round(avg(rating_honesty)::numeric,1) from r) end,
    'respect', case when c.n >= 5 then (select round(avg(rating_respect)::numeric,1) from r) end,
    'relevance', case when c.n >= 5 then (select round(avg(rating_relevance)::numeric,1) from r) end,
    'feedback', case when c.n >= 5 then (select round(avg(rating_feedback)::numeric,1) from r) end,
    'never_heard_pct', case when c.n >= 5 then (select round(100.0 * count(*) filter (where outcome = 'never_heard') / count(*)) from r) end
  ) from c
$$;

create or replace function public.recent_recruiters(_limit int default 6)
returns table (id uuid, name text, slug text, type recruiter_type, review_count int, overall numeric, last_review_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select rc.id, rc.name, rc.slug, rc.type, count(rv.id)::int,
    case when count(rv.id) >= 5 then round(avg(rv.overall)::numeric,1) end,
    max(rv.created_at)
  from public.recruiters rc join public.reviews rv on rv.recruiter_id = rc.id and rv.status = 'published'
  where rc.approved
  group by rc.id order by max(rv.created_at) desc limit least(_limit, 24)
$$;

grant execute on function public.recruiter_stats(uuid) to anon, authenticated;
grant execute on function public.recent_recruiters(int) to anon, authenticated;