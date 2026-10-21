<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Public scores are computed in SQL functions (`recruiter_stats`, `recent_recruiters`) and hidden below 5 reviews; never compute them in the browser — keeps the threshold enforced in one place.
- Demographic answers live in a separate `review_demographics` table readable only by the owner — row-level security can't hide columns, so they must never sit on `reviews`.
- The 5 public criteria are calculated per review in `review_criteria` (SQL) and averaged in `recruiter_stats`; `CRITERIA` in `src/lib/options.ts` holds their labels and plain-English explanations, so update both together.
- A review's overall rating is never entered by the user: the `reviews_validate` trigger sets it from the 5 criteria (`review_overall`, nearest half star). `src/lib/scoring.ts` mirrors that rule only to preview it on the form.
- Review wording is checked in `review_text_problems` (SQL), called by the form and enforced by the same trigger: 5–60 character titles, 30–600 character reviews, no words in `blocked_terms`, no recruiter or company names, no named individuals, links, emails, phone numbers or all-capitals.
- Form option lists live in `src/lib/options.ts`; DB check constraints mirror those values, so change both together.
