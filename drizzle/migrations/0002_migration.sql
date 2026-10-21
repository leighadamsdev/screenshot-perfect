-- Score each recruiter on 5 criteria built from the survey answers.
-- Each review gets a 1–5 score per criterion; the recruiter's score is the average
-- across published reviews. Scores stay hidden below 5 reviews.
--
--   Communication and speed  = avg(communication rating, speed of final answer)
--                              → 1 if they never heard back or the recruiter stopped responding
--   Honesty and transparency = avg(honesty rating, how early pay was shared)
--                              → 1 if the job may not have existed
--   Respect and fairness     = respect rating, −1 each for pressure tactics / intrusive questions
--                              → 1 if the applicant felt discriminated against
--   Fair, efficient process  = relevance rating, −1 each for an unpaid task over 2 hours / long waits
--   Feedback                 = feedback rating
-- A missing rating with a red flag starts from 5 before deductions; scores never go below 1.

create or replace function public.review_criteria(rv public.reviews)
returns table (
  communication_speed numeric,
  honesty_transparency numeric,
  respect_fairness numeric,
  process numeric,
  feedback numeric
)
language sql immutable set search_path = public
as $$
  with f as (
    select
      rv.outcome = 'never_heard' or 'stopped_responding' = any(rv.red_flags) as ghosted,
      case rv.time_to_answer when 'under_2w' then 5 when '2_4w' then 4 when '1_2m' then 3 when 'over_2m' then 1 end as speed,
      case rv.pay_disclosed when 'advert' then 5 when 'first_contact' then 4 when 'offer' then 2 when 'never' then 1 end as pay,
      'job_not_exist' = any(rv.red_flags) as ghost_job,
      'discriminated' = any(rv.red_flags) as discriminated,
      ('pressure' = any(rv.red_flags))::int + ('intrusive_questions' = any(rv.red_flags))::int as respect_flags,
      ('unpaid_task' = any(rv.red_flags))::int + ('long_waits' = any(rv.red_flags))::int as process_flags
  )
  select
    case when f.ghosted then 1
         else (select avg(x) from unnest(array[rv.rating_communication::numeric, f.speed::numeric]) x) end,
    case when f.ghost_job then 1
         else (select avg(x) from unnest(array[rv.rating_honesty::numeric, f.pay::numeric]) x) end,
    case when f.discriminated then 1
         when rv.rating_respect is null and f.respect_flags = 0 then null
         else greatest(1, coalesce(rv.rating_respect, 5) - f.respect_flags) end,
    case when rv.rating_relevance is null and f.process_flags = 0 then null
         else greatest(1, coalesce(rv.rating_relevance, 5) - f.process_flags) end,
    rv.rating_feedback::numeric
  from f
$$;

create or replace function public.recruiter_stats(_recruiter_id uuid)
returns json language sql stable security definer set search_path = public
as $$
  with r as (
    select rv.* from public.reviews rv join public.recruiters rc on rc.id = rv.recruiter_id
    where rv.recruiter_id = _recruiter_id and rv.status = 'published' and rc.approved
  ), s as (
    select c.* from r cross join lateral public.review_criteria(r::public.reviews) c
  ), n as (select count(*)::int n from r)
  select json_build_object(
    'review_count', n.n,
    'enough', n.n >= 5,
    'overall', case when n.n >= 5 then (select round(avg(overall)::numeric, 1) from r) end,
    'communication_speed', case when n.n >= 5 then (select round(avg(communication_speed), 1) from s) end,
    'honesty_transparency', case when n.n >= 5 then (select round(avg(honesty_transparency), 1) from s) end,
    'respect_fairness', case when n.n >= 5 then (select round(avg(respect_fairness), 1) from s) end,
    'process', case when n.n >= 5 then (select round(avg(process), 1) from s) end,
    'feedback', case when n.n >= 5 then (select round(avg(feedback), 1) from s) end,
    'never_heard_pct', case when n.n >= 5 then (select round(100.0 * count(*) filter (where outcome = 'never_heard') / count(*)) from r) end
  ) from n
$$;

grant execute on function public.recruiter_stats(uuid) to anon, authenticated;
