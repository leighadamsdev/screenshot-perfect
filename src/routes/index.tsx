import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldCheck, BarChart3, BadgePoundSterling } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stars } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ratemyrecruiter · Reviews of how recruiters treat applicants" },
      { name: "description", content: "Read and write honest reviews of recruiters and employers, based on how job applicants were treated." },
      { property: "og:title", content: "ratemyrecruiter" },
      { property: "og:description", content: "Honest reviews of how recruiters and employers treat job applicants." },
    ],
  }),
  component: Index,
});

const typeLabel = (t: string) => (t === "agency" ? "Agency" : "In-house");

function Index() {
  const [q, setQ] = useState("");
  const term = q.trim();
  const search = useQuery({
    queryKey: ["search", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from("recruiters").select("id,name,slug,type")
        .eq("approved", true).ilike("name", `%${term.replace(/[%_]/g, "")}%`).order("name").limit(10);
      if (error) throw error;
      return data;
    },
  });
  const recent = useQuery({
    queryKey: ["recent"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recent_recruiters", { _limit: 6 });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-14">
      <section className="space-y-6 py-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          How did the recruiter <span className="text-brand-red">treat you?</span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Real reviews from job applicants, so the next person knows what to expect.
        </p>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="mx-auto max-w-xl">
          <label htmlFor="q" className="sr-only">Search recruiters and employers</label>
          <div className="relative">
            <Search aria-hidden className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recruiters and employers"
              className="h-12 pl-10 text-base" autoComplete="off" />
          </div>
          {term.length >= 2 && (
            <ul className="mt-2 divide-y rounded-lg border text-left" aria-live="polite">
              {search.data?.length === 0 && <li className="p-3 text-muted-foreground">No matches. You can add them when you write a review.</li>}
              {search.data?.map((r) => (
                <li key={r.id}>
                  <Link to="/r/$slug" params={{ slug: r.slug }} className="flex justify-between p-3 hover:bg-secondary">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-sm text-muted-foreground">{typeLabel(r.type)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </form>
        <Button asChild variant="accent" size="lg"><Link to="/review">Write a review</Link></Button>
      </section>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-4 text-2xl font-bold">Recently reviewed</h2>
        {recent.data?.length === 0 && <p className="text-muted-foreground">No reviews yet. Be the first.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.data?.map((r) => (
            <li key={r.id}>
              <Link to="/r/$slug" params={{ slug: r.slug }} className="block h-full rounded-xl border p-4 hover:border-primary">
                <p className="font-bold">{r.name}</p>
                <p className="text-sm text-muted-foreground">{typeLabel(r.type)} · {r.review_count} review{r.review_count === 1 ? "" : "s"}</p>
                <div className="mt-2">
                  {r.overall != null ? (
                    <span className="flex items-center gap-2"><Stars value={Number(r.overall)} /> <span className="font-semibold">{r.overall}</span></span>
                  ) : (
                    <span className="text-sm">Not enough reviews yet</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fair-h" className="rounded-2xl bg-secondary p-6">
        <h2 id="fair-h" className="mb-4 text-2xl font-bold">How we keep it fair</h2>
        <ul className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "Verified reviewers", d: "Every reviewer signs in with their email. One review per person per recruiter." },
            { icon: BarChart3, t: "Scores after 5 reviews", d: "We only show scores once there are at least 5 reviews, so one bad day can't define anyone." },
            { icon: BadgePoundSterling, t: "No paid removals", d: "Recruiters can't pay to hide or remove reviews. Ever." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t}>
              <Icon aria-hidden className="mb-2 h-7 w-7 text-brand-red" />
              <h3 className="font-bold">{t}</h3>
              <p className="text-muted-foreground">{d}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
