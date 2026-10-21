export type Opt = { value: string; label: string };

export const SECTORS: Opt[] = [
  "Accountancy and finance", "Charity and voluntary", "Construction and property", "Creative and media",
  "Education", "Engineering and manufacturing", "Healthcare", "Hospitality and leisure", "Law",
  "Marketing and PR", "Public sector", "Retail", "Sales", "Science and research", "Social care",
  "Technology", "Transport and logistics", "Other",
].map((s) => ({ value: s, label: s }));

export const ROLE_LEVELS: Opt[] = [
  { value: "entry", label: "Entry-level/graduate" },
  { value: "experienced", label: "Experienced" },
  { value: "senior", label: "Senior" },
  { value: "internship", label: "Internship/placement/apprenticeship" },
  { value: "temporary", label: "Temporary/contract" },
];

export const OUTCOMES: Opt[] = [
  { value: "offer_accepted", label: "Offer accepted" },
  { value: "offer_declined", label: "Offer declined" },
  { value: "rejected_applying", label: "Rejected after applying" },
  { value: "rejected_interview", label: "Rejected after test or interview" },
  { value: "withdrew", label: "I withdrew" },
  { value: "never_heard", label: "Never heard back" },
  { value: "still_waiting", label: "Still waiting" },
];

export const RATINGS = [
  { key: "rating_communication", stat: "communication", label: "Communication" },
  { key: "rating_honesty", stat: "honesty", label: "Honesty about the job and pay" },
  { key: "rating_respect", stat: "respect", label: "Respect" },
  { key: "rating_relevance", stat: "relevance", label: "Relevance of the process" },
  { key: "rating_feedback", stat: "feedback", label: "Feedback" },
] as const;

export const TIME_TO_ANSWER: Opt[] = [
  { value: "under_2w", label: "Under 2 weeks" },
  { value: "2_4w", label: "2–4 weeks" },
  { value: "1_2m", label: "1–2 months" },
  { value: "over_2m", label: "Over 2 months" },
  { value: "still_waiting", label: "Still waiting" },
];

export const PAY_DISCLOSED: Opt[] = [
  { value: "advert", label: "In the advert" },
  { value: "first_contact", label: "At first contact" },
  { value: "offer", label: "Only at offer" },
  { value: "never", label: "Never" },
];

export const RED_FLAGS: Opt[] = [
  { value: "stopped_responding", label: "Stopped responding" },
  { value: "job_not_exist", label: "Job may not have existed" },
  { value: "intrusive_questions", label: "Intrusive questions" },
  { value: "unpaid_task", label: "Unpaid task over 2 hours" },
  { value: "long_waits", label: "Long waits" },
  { value: "pressure", label: "Pressure tactics" },
  { value: "discriminated", label: "Felt discriminated against" },
];

const PNS = { value: "prefer_not", label: "Prefer not to say" };

export const DEMOGRAPHICS: { key: string; label: string; options: Opt[] }[] = [
  { key: "age_band", label: "Age band", options: ["16–24", "25–34", "35–44", "45–54", "55–64", "65+"].map((v) => ({ value: v, label: v })).concat(PNS) },
  { key: "gender", label: "Gender", options: [{ value: "woman", label: "Woman" }, { value: "man", label: "Man" }, { value: "non_binary", label: "Non-binary" }, { value: "self_describe", label: "Another way" }, PNS] },
  { key: "ethnic_group", label: "Ethnic group", options: ["Asian or Asian British", "Black, Black British, Caribbean or African", "Mixed or multiple ethnic groups", "White", "Other ethnic group"].map((v) => ({ value: v, label: v })).concat(PNS) },
  { key: "disability", label: "Do you consider yourself disabled?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, PNS] },
  { key: "adjustments", label: "Were the adjustments you asked for provided?", options: [{ value: "yes", label: "Yes" }, { value: "partly", label: "Partly" }, { value: "no", label: "No" }, { value: "not_needed", label: "I did not need any" }, PNS] },
  { key: "parent_occupation", label: "Main household earner's job when you were 14", options: [{ value: "professional", label: "Professional or senior" }, { value: "intermediate", label: "Intermediate (e.g. clerical, small business)" }, { value: "routine", label: "Routine or manual" }, { value: "unemployed", label: "Long-term unemployed" }, { value: "dont_know", label: "Don't know" }, PNS] },
  { key: "qualification", label: "Highest qualification", options: [{ value: "none", label: "No formal qualifications" }, { value: "gcse", label: "GCSEs or equivalent" }, { value: "a_level", label: "A levels or equivalent" }, { value: "degree", label: "Degree" }, { value: "postgrad", label: "Postgraduate" }, PNS] },
];

export const labelFor = (opts: Opt[], v: string | null | undefined) => opts.find((o) => o.value === v)?.label ?? v ?? "";

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const MIN_REVIEWS_FOR_SCORES = 5;
