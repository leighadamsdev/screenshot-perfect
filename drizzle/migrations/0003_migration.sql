-- 1. The overall rating is calculated from the 5 criteria, rounded to the nearest half star.
-- 2. Review titles and text are checked before saving: length limits, no offensive language,
--    no recruiter or company names, no named individuals, no links, emails or phone numbers,
--    no writing in capitals.
-- Both are enforced by a trigger, so they apply however a review is saved.

-- ---------- Overall rating ----------
alter table public.reviews drop constraint if exists reviews_overall_check;
alter table public.reviews alter column overall type numeric(2,1) using overall::numeric;
alter table public.reviews alter column overall set default 3;
alter table public.reviews add constraint reviews_overall_check
  check (overall between 1 and 5 and overall * 2 = trunc(overall * 2));

create or replace function public.review_overall(rv public.reviews)
returns numeric language sql immutable set search_path = public
as $$
  select case when avg(x) is null then null
              else least(5, greatest(1, round(avg(x) * 2) / 2)) end
  from public.review_criteria(rv) c,
       unnest(array[c.communication_speed, c.honesty_transparency, c.respect_fairness, c.process, c.feedback]) x
$$;

-- ---------- Blocked words ----------
-- Admins can add words in the Cloud table editor. match_prefix = true also blocks words that start
-- with the term (e.g. "fuck" blocks "fucking"); leave it false where that would catch innocent words.
create table if not exists public.blocked_terms (
  term text primary key check (term ~ '^[a-z]+$'),
  match_prefix boolean not null default false
);
grant all on public.blocked_terms to service_role;
alter table public.blocked_terms enable row level security;
create policy "Admins manage blocked terms" on public.blocked_terms for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant select, insert, update, delete on public.blocked_terms to authenticated;

insert into public.blocked_terms (term, match_prefix) values
  ('fuck', true), ('fck', true), ('fuk', false), ('shit', true), ('bullshit', true), ('cunt', true),
  ('bastard', true), ('bitch', true), ('wank', true), ('twat', true), ('bollock', true),
  ('motherfuck', true), ('piss', true), ('slut', true), ('whore', true), ('bellend', true),
  ('arse', false), ('arsehole', true), ('ass', false), ('asshole', true), ('dick', false),
  ('dickhead', true), ('prick', false), ('pricks', false), ('cock', false), ('cocks', false),
  ('minge', false), ('knobhead', true), ('tosser', true), ('scumbag', true),
  ('nigger', true), ('nigga', true), ('faggot', true), ('fag', false), ('fags', false),
  ('retard', false), ('retards', false), ('retarded', false), ('spastic', true), ('spaz', false),
  ('paki', false), ('pakis', false), ('kike', true), ('spic', false), ('spics', false),
  ('wog', false), ('wogs', false), ('coon', false), ('coons', false), ('tranny', false),
  ('trannies', false), ('dyke', false), ('dykes', false), ('gyppo', true), ('pikey', true)
on conflict (term) do nothing;

-- Lower case, common character swaps (sh1t, @ss, $hit), everything else to single spaces.
create or replace function public.normalise_words(_t text)
returns text language sql immutable
as $$
  select ' ' || trim(regexp_replace(translate(lower(coalesce(_t, '')), '013457@$!|8', 'oieastasiib'), '[^a-z]+', ' ', 'g')) || ' '
$$;

-- Returns a list of plain-English problems; empty means the text is fine.
create or replace function public.review_text_problems(
  _recruiter_id uuid, _title text, _body text, _extra_name text default null
)
returns text[] language plpgsql stable security definer set search_path = public
as $$
declare
  p text[] := '{}';
  t text := trim(coalesce(_title, ''));
  b text := trim(coalesce(_body, ''));
  all_text text := t || ' ' || b;
  w text := public.normalise_words(t || ' ' || b);
  w_squashed text := regexp_replace(w, '([a-z])\1+', '\1', 'g');
  names text;
  letters text;
begin
  if char_length(t) < 5 or char_length(t) > 60 then
    p := array_append(p, 'Keep the title between 5 and 60 characters.');
  end if;
  if char_length(b) < 30 or char_length(b) > 600 then
    p := array_append(p, 'Keep the review between 30 and 600 characters, focused on what happened.');
  end if;

  if exists (
    select 1 from public.blocked_terms bt
    where w like '% ' || bt.term || case when bt.match_prefix then '%' else ' %' end
       or (char_length(regexp_replace(bt.term, '([a-z])\1+', '\1', 'g')) >= 4
           and w_squashed like '% ' || regexp_replace(bt.term, '([a-z])\1+', '\1', 'g')
                                    || case when bt.match_prefix then '%' else ' %' end)
  ) then
    p := array_append(p, 'Please remove offensive or abusive language.');
  end if;

  select string_agg(distinct n, ', ') into names from (
    select rc.name as n from public.recruiters rc
    where (rc.approved or rc.id = _recruiter_id)
      and char_length(trim(public.normalise_words(rc.name))) >= 3
      and w like '%' || public.normalise_words(rc.name) || '%'
    union all
    select _extra_name where char_length(trim(public.normalise_words(_extra_name))) >= 3
      and w like '%' || public.normalise_words(_extra_name) || '%'
  ) x;
  if names is not null then
    p := array_append(p, ('Please don''t name the recruiter or company (' || names || '). Describe what happened instead.'));
  end if;

  if all_text ~ '\m([Mm]r|[Mm]rs|[Mm]s|[Mm]iss|[Dd]r)\.?\s+[A-Z][a-z]+' then
    p := array_append(p, 'Please don''t name individual people.');
  end if;

  if all_text ~* '(https?://|www\.|[a-z0-9-]+\.(com|co\.uk|org|net|io|uk)\M)' then
    p := array_append(p, 'Please remove links and web addresses.');
  end if;
  if all_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    p := array_append(p, 'Please remove email addresses.');
  end if;
  if all_text ~ '\+?[0-9](?:[ ()-]*[0-9]){9,}' then
    p := array_append(p, 'Please remove phone numbers.');
  end if;

  letters := regexp_replace(all_text, '[^A-Za-z]', '', 'g');
  if char_length(letters) >= 20
     and char_length(regexp_replace(letters, '[^A-Z]', '', 'g')) > 0.6 * char_length(letters) then
    p := array_append(p, 'Please don''t write in capital letters.');
  end if;

  return p;
end $$;
grant execute on function public.review_text_problems(uuid, text, text, text) to authenticated;

-- ---------- Trigger ----------
create or replace function public.reviews_validate()
returns trigger language plpgsql set search_path = public
as $$
declare problems text[];
begin
  if tg_op = 'INSERT' or new.title is distinct from old.title or new.body is distinct from old.body then
    new.title := trim(new.title);
    new.body := trim(new.body);
    problems := public.review_text_problems(new.recruiter_id, new.title, new.body);
    if cardinality(problems) > 0 then
      raise exception using errcode = '23514', message = array_to_string(problems, E'\n'), hint = 'review_text';
    end if;
  end if;

  new.overall := public.review_overall(new);
  if new.overall is null then
    raise exception using errcode = '23514', message = 'Rate at least one of the five categories.', hint = 'review_text';
  end if;
  return new;
end $$;

drop trigger if exists reviews_a_validate on public.reviews;
create trigger reviews_a_validate before insert or update on public.reviews
  for each row execute function public.reviews_validate();

-- Recalculate existing reviews without changing their "updated" dates.
alter table public.reviews disable trigger reviews_touch;
update public.reviews r set overall = public.review_overall(r);
alter table public.reviews enable trigger reviews_touch;
