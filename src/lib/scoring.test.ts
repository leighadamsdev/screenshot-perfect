import { describe, expect, it } from "vitest";
import { overallRating, type ScoringInput } from "./scoring";

// Same cases used to check the SQL functions; expected values are what the database returns.
const base: ScoringInput = {
  outcome: "offer_accepted", time_to_answer: "under_2w", pay_disclosed: "advert", red_flags: [],
  rating_communication: null, rating_honesty: null, rating_respect: null, rating_relevance: null, rating_feedback: null,
};

describe("overallRating", () => {
  it("matches the database for each case", () => {
    expect(overallRating({ ...base, rating_communication: 5, rating_honesty: 5, rating_respect: 5, rating_relevance: 5, rating_feedback: 5 })).toBe(5);
    expect(overallRating({ ...base, outcome: "rejected_interview", rating_communication: 4, rating_honesty: 3, rating_respect: 4, rating_feedback: 2, time_to_answer: "2_4w", pay_disclosed: "offer", red_flags: ["long_waits"] })).toBe(3.5);
    expect(overallRating({ ...base, outcome: "never_heard", rating_communication: 3, time_to_answer: "still_waiting", pay_disclosed: "never" })).toBe(1);
    expect(overallRating({ ...base, outcome: "withdrew", rating_communication: 2, rating_honesty: 4, rating_respect: 4, rating_relevance: 3, time_to_answer: "over_2m", pay_disclosed: "first_contact", red_flags: ["pressure", "intrusive_questions", "unpaid_task"] })).toBe(2.5);
    expect(overallRating({ ...base, outcome: "rejected_applying", rating_honesty: 2, rating_respect: 3, rating_relevance: 4, rating_feedback: 1, time_to_answer: "1_2m", pay_disclosed: "offer", red_flags: ["discriminated", "job_not_exist"] })).toBe(2);
    expect(overallRating({ ...base, outcome: "withdrew", rating_communication: 4, rating_honesty: 3, time_to_answer: "2_4w" })).toBe(4);
  });

  it("is null until there is something to score", () => {
    expect(overallRating({ ...base, time_to_answer: "", pay_disclosed: "" })).toBeNull();
  });
});
