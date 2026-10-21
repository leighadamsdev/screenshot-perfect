// Preview of the overall rating shown on the review form while the applicant fills it in.
// The stored rating is always calculated by the database (`review_criteria`, `review_overall`
// in drizzle/migrations); this mirrors those rules, so change both together.

export type ScoringInput = {
  outcome: string;
  time_to_answer: string;
  pay_disclosed: string;
  red_flags: string[];
  rating_communication: number | null | undefined;
  rating_honesty: number | null | undefined;
  rating_respect: number | null | undefined;
  rating_relevance: number | null | undefined;
  rating_feedback: number | null | undefined;
};

const SPEED: Record<string, number> = { under_2w: 5, "2_4w": 4, "1_2m": 3, over_2m: 1 };
const PAY: Record<string, number> = { advert: 5, first_contact: 4, offer: 2, never: 1 };

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function criteriaScores(r: ScoringInput) {
  const has = (f: string) => r.red_flags.includes(f);
  const respectFlags = Number(has("pressure")) + Number(has("intrusive_questions"));
  const processFlags = Number(has("unpaid_task")) + Number(has("long_waits"));
  return {
    communication_speed:
      r.outcome === "never_heard" || has("stopped_responding") ? 1 : avg([r.rating_communication, SPEED[r.time_to_answer]]),
    honesty_transparency: has("job_not_exist") ? 1 : avg([r.rating_honesty, PAY[r.pay_disclosed]]),
    respect_fairness: has("discriminated")
      ? 1
      : r.rating_respect == null && respectFlags === 0
        ? null
        : Math.max(1, (r.rating_respect ?? 5) - respectFlags),
    process:
      r.rating_relevance == null && processFlags === 0 ? null : Math.max(1, (r.rating_relevance ?? 5) - processFlags),
    feedback: r.rating_feedback ?? null,
  };
}

/** Average of the 5 criteria, rounded to the nearest half star; null until something is answered. */
export function overallRating(r: ScoringInput): number | null {
  const a = avg(Object.values(criteriaScores(r)));
  return a == null ? null : Math.min(5, Math.max(1, Math.round(a * 2) / 2));
}
