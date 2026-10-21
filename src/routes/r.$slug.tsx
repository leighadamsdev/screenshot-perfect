import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Stars } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { OUTCOMES, RATINGS, RED_FLAGS, ROLE_LEVELS, labelFor } from "@/lib/options";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({
    meta: [
      { title: "Recruiter reviews · ratemyrecruiter" },
      { name: "description", content: "See how this recruiter treated job applicants: ratings, response rates and reviews." },
      { property: "og:title", content: "Recruiter reviews · ratemyrecruiter" },
      { property: "og:description", content: "See how this recruiter treated job applicants." },
    ],
  }),
  component: RecruiterPage,
});

type Stats = Record<string, number | boolean | null> & { review_count: number; enough: boolean };

function RecruiterPage() {
  const { slug } = Route.useParams();
  const [filter, setFilter] = useState<number | null>(null);

  const rec = useQuery({
    queryKey: ["recruiter", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("recruiters").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const id = rec.data?.id;
  const stats = useQuery({
    queryKey: ["stats", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recruiter_stats", { _recruiter_id: id! });
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
  const reviews = useQuery({
    queryKey: ["reviews", id, filter],
    enabled: !!id,
    queryFn: async () => {
      let q = supabase.from("reviews")
        .select("id,title,body,overall,outcome,role_level,sector,red_flags,created_at")
        .eq("recruiter_id", id!).eq("status", "published").order("created_at", { ascending: false });
      if (filter) q = q.eq("overall", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (rec.isLoading) return <p>Loading…</p>;
  if (!rec.data) return <p>We couldn't find that recruiter. <Link to="/" className="underline">Back to search</Link></p>;
  const r = rec.data;
  const s = stats.data;

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">{r.type === "agency" ? "Agency recruiter" : "In-house recruiter"}</p>
        <h1 className="text-4xl font-extrabold tracking-tight">{r.name}</h1>
        {!r.approved && <p className="rounded-md bg-secondary p-2 text-sm">Awaiting approval. Only you can see this page.</p>}
        <p className="text-muted-foreground">{s?.review_count ?? 0} review{s?.review_count === 1 ? "" : "s"}</p>
        <Button asChild variant="accent"><Link to="/review" search={{ recruiter: r.id }}>Review {r.name}</Link></Button>
      </header>

      <section aria-labelledby="scores-h" className="rounded-2xl border p-6">
        <h2 id="scores-h" className="sr-only">Scores</h2>
        {s && !s.enough ? (
          <p className="text-lg font-semibold">Not enough reviews yet</p>
        ) : s ? (
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="space-y-1">
              <p className="text-5xl font-extrabold">{String(s.overall)}<span className="text-xl text-muted-foreground"> / 5</span></p>
              <Stars value={Number(s.overall)} size={24} />
              <p className="pt-2"><strong>{String(s.never_heard_pct)}%</strong> never heard back</p>
            </div>
            <dl className="space-y-3">
              {RATINGS.map((rt) => {
                const v = s[rt.stat] as number | null;
                return (
                  <div key={rt.key}>
                    <div className="flex justify-between text-sm"><dt>{rt.label}</dt><dd className="font-semibold">{v ?? "N/A"}</dd></div>
                    <div className="mt-1 h-2.5 rounded-full bg-secondary" aria-hidden>
                      <div className="h-full rounded-full bg-brand-red" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="reviews-h" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="reviews-h" className="text-2xl font-bold">Reviews</h2>
          <div role="group" aria-label="Filter by star rating" className="flex flex-wrap gap-1">
            {[null, 5, 4, 3, 2, 1].map((n) => (
              <Button key={n ?? "all"} size="sm" variant={filter === n ? "default" : "outline"} aria-pressed={filter === n} onClick={() => setFilter(n)}>
                {n ? `${n}★` : "All"}
              </Button>
            ))}
          </div>
        </div>
        {reviews.data?.length === 0 && <p className="text-muted-foreground">No reviews match.</p>}
        <ul className="space-y-4">
          {reviews.data?.map((rv) => (
            <li key={rv.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={rv.overall} />
                <time className="text-sm text-muted-foreground" dateTime={rv.created_at}>
                  {new Date(rv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </time>
              </div>
              <h3 className="mt-2 text-lg font-bold">{rv.title}</h3>
              <p className="mt-1 whitespace-pre-line">{rv.body}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {labelFor(OUTCOMES, rv.outcome)} · {labelFor(ROLE_LEVELS, rv.role_level)} · {rv.sector}
              </p>
              {rv.red_flags.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1" aria-label="Red flags">
                  {rv.red_flags.map((f) => <li key={f} className="rounded-full border border-brand-red px-2 py-0.5 text-xs font-medium text-brand-red">{labelFor(RED_FLAGS, f)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
