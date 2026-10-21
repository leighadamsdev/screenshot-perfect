import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StarInput } from "@/components/brand";
import {
  DEMOGRAPHICS, OUTCOMES, PAY_DISCLOSED, RATINGS, RED_FLAGS, ROLE_LEVELS, SECTORS, TIME_TO_ANSWER, slugify, type Opt,
} from "@/lib/options";

export const Route = createFileRoute("/_authenticated/review")({
  validateSearch: z.object({ recruiter: z.string().uuid().optional(), edit: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Write a review · ratemyrecruiter" },
      { name: "description", content: "Tell other applicants how a recruiter or employer treated you." },
      { property: "og:title", content: "Write a review · ratemyrecruiter" },
      { property: "og:description", content: "Tell other applicants how a recruiter or employer treated you." },
    ],
  }),
  component: ReviewPage,
});

type Form = {
  sector: string; role_level: string; outcome: string; time_to_answer: string; pay_disclosed: string;
  red_flags: string[]; overall: number | null; title: string; body: string;
  rating_communication: number | null; rating_honesty: number | null; rating_respect: number | null;
  rating_relevance: number | null; rating_feedback: number | null;
};
const empty: Form = {
  sector: "", role_level: "", outcome: "", time_to_answer: "", pay_disclosed: "", red_flags: [], overall: null,
  title: "", body: "", rating_communication: null, rating_honesty: null, rating_respect: null, rating_relevance: null, rating_feedback: null,
};
// undefined = not yet answered, null = Not applicable
type RatingState = Partial<Record<(typeof RATINGS)[number]["key"], number | null>>;

const schema = z.object({
  sector: z.string().min(1, "Choose a sector"),
  role_level: z.string().min(1, "Choose the level of role"),
  outcome: z.string().min(1, "Tell us what happened"),
  time_to_answer: z.string().min(1, "Choose how long it took"),
  pay_disclosed: z.string().min(1, "Choose when you found out the pay"),
  overall: z.number({ message: "Give an overall rating" }).int().min(1).max(5),
  title: z.string().trim().min(1, "Add a title").max(80, "Title must be 80 characters or fewer"),
  body: z.string().trim().min(1, "Write your review").max(1000, "Review must be 1,000 characters or fewer"),
});

const selectCls = "h-11 w-full rounded-md border border-input bg-background px-3 text-base";

function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="font-semibold">{label}</label>
      <select id={id} className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Radios({ name, legend, value, onChange, options }: { name: string; legend: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-secondary">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="h-4 w-4 accent-[var(--brand-blue)]" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewPage() {
  const { recruiter: preset, edit } = Route.useSearch();
  const navigate = useNavigate();
  const [recruiterId, setRecruiterId] = useState<string>(preset ?? "");
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"in_house" | "agency" | "">("");
  const [f, setF] = useState<Form>(empty);
  const [ratings, setRatings] = useState<RatingState>({});
  const [consent, setConsent] = useState(false);
  const [demo, setDemo] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const recruiters = useQuery({
    queryKey: ["recruiters-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recruiters").select("id,name,approved").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!edit) return;
    (async () => {
      const { data } = await supabase.from("reviews").select("*").eq("id", edit).maybeSingle();
      if (!data) return;
      setRecruiterId(data.recruiter_id);
      setF({ ...empty, ...data } as Form);
      const r: RatingState = {};
      RATINGS.forEach((rt) => (r[rt.key] = data[rt.key]));
      setRatings(r);
      const { data: d } = await supabase.from("review_demographics").select("*").eq("review_id", edit).maybeSingle();
      if (d) {
        setConsent(true);
        const x: Record<string, string> = {};
        DEMOGRAPHICS.forEach((q) => (x[q.key] = (d as unknown as Record<string, string>)[q.key] ?? "prefer_not"));
        setDemo(x);
      }
    })();
  }, [edit]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    const parsed = schema.safeParse(f);
    if (!parsed.success) errs.push(...parsed.error.issues.map((i) => i.message));
    if (!edit && !newMode && !recruiterId) errs.push("Choose a recruiter or add a new one");
    if (newMode && (newName.trim().length < 2 || newName.trim().length > 120)) errs.push("Enter the recruiter's name");
    if (newMode && !newType) errs.push("Choose whether the new recruiter is in-house or an agency");
    RATINGS.forEach((rt) => { if (ratings[rt.key] === undefined) errs.push(`Rate ${rt.label.toLowerCase()} or choose Not applicable`); });
    setErrors(errs);
    if (errs.length || !parsed.success) {
      setTimeout(() => document.getElementById("error-summary")?.focus(), 0);
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      let rid = recruiterId;
      if (newMode && !edit) {
        const slug = `${slugify(newName)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error } = await supabase.from("recruiters")
          .insert({ name: newName.trim(), slug, type: newType as "agency" | "in_house", created_by: uid }).select("id").single();
        if (error) throw error;
        rid = data.id;
      }
      const row = {
        ...parsed.data, red_flags: f.red_flags,
        rating_communication: ratings.rating_communication ?? null, rating_honesty: ratings.rating_honesty ?? null,
        rating_respect: ratings.rating_respect ?? null, rating_relevance: ratings.rating_relevance ?? null,
        rating_feedback: ratings.rating_feedback ?? null,
      };
      let reviewId = edit;
      if (edit) {
        const { error } = await supabase.from("reviews").update(row).eq("id", edit);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("reviews").insert({ ...row, recruiter_id: rid, user_id: uid }).select("id").single();
        if (error) {
          if (error.code === "23505") throw new Error("You've already reviewed this recruiter. You can edit it from My reviews.");
          throw error;
        }
        reviewId = data.id;
      }
      if (consent) {
        const d: Record<string, string> = {};
        DEMOGRAPHICS.forEach((q) => (d[q.key] = demo[q.key] || "prefer_not"));
        const { error } = await supabase.from("review_demographics").upsert({ review_id: reviewId!, user_id: uid, ...d });
        if (error) throw error;
      } else if (edit) {
        await supabase.from("review_demographics").delete().eq("review_id", edit);
      }
      toast.success(newMode ? "Thanks! Your review will appear once this recruiter is approved." : "Thanks, your review is live.");
      navigate({ to: "/my-reviews" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{edit ? "Edit your review" : "Write a review"}</h1>

      {errors.length > 0 && (
        <div id="error-summary" tabIndex={-1} role="alert" className="rounded-lg border-2 border-destructive p-4">
          <h2 className="font-bold">There's a problem</h2>
          <ul className="mt-2 list-disc pl-5 text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {!edit && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Who are you reviewing?</h2>
          {!newMode ? (
            <>
              <Select id="recruiter" label="Recruiter or employer" value={recruiterId} onChange={setRecruiterId}
                options={(recruiters.data ?? []).map((r) => ({ value: r.id, label: r.approved ? r.name : `${r.name} (awaiting approval)` }))} />
              <Button type="button" variant="link" className="px-0" onClick={() => setNewMode(true)}>Can't find them? Add a new one</Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="newName" className="font-semibold">Name</label>
                <Input id="newName" className="h-11" maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <Radios name="newType" legend="Type" value={newType} onChange={(v) => setNewType(v as "agency" | "in_house")}
                options={[{ value: "in_house", label: "In-house" }, { value: "agency", label: "Agency" }]} />
              <p className="text-sm text-muted-foreground">New recruiters are checked before they appear publicly.</p>
              <Button type="button" variant="link" className="px-0" onClick={() => setNewMode(false)}>Choose an existing one instead</Button>
            </>
          )}
        </section>
      )}

      <section className="space-y-5">
        <h2 className="text-xl font-bold">About the role</h2>
        <Select id="sector" label="Sector" value={f.sector} onChange={(v) => set("sector", v)} options={SECTORS} />
        <Radios name="role_level" legend="Level of role" value={f.role_level} onChange={(v) => set("role_level", v)} options={ROLE_LEVELS} />
        <Radios name="outcome" legend="What happened?" value={f.outcome} onChange={(v) => set("outcome", v)} options={OUTCOMES} />
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-bold">How were you treated?</h2>
        {RATINGS.map((rt) => (
          <StarInput key={rt.key} name={rt.key} legend={rt.label} allowNA value={ratings[rt.key]}
            onChange={(v) => setRatings((p) => ({ ...p, [rt.key]: v }))} />
        ))}
        <Radios name="time" legend="How long to a final answer?" value={f.time_to_answer} onChange={(v) => set("time_to_answer", v)} options={TIME_TO_ANSWER} />
        <Radios name="pay" legend="When did you find out the pay?" value={f.pay_disclosed} onChange={(v) => set("pay_disclosed", v)} options={PAY_DISCLOSED} />
        <fieldset className="space-y-2">
          <legend className="font-semibold">Red flags <span className="font-normal text-muted-foreground">(tick any)</span></legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {RED_FLAGS.map((o) => (
              <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:checked]:border-brand-red">
                <input type="checkbox" className="h-4 w-4 accent-[var(--brand-red)]" checked={f.red_flags.includes(o.value)}
                  onChange={(e) => set("red_flags", e.target.checked ? [...f.red_flags, o.value] : f.red_flags.filter((x) => x !== o.value))} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-bold">Your review</h2>
        <StarInput name="overall" legend="Overall rating" value={f.overall} onChange={(v) => set("overall", v)} />
        <div className="space-y-1">
          <label htmlFor="title" className="font-semibold">Title</label>
          <Input id="title" className="h-11" maxLength={80} value={f.title} onChange={(e) => set("title", e.target.value)} aria-describedby="title-count" />
          <p id="title-count" className="text-sm text-muted-foreground">{f.title.length}/80</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="body" className="font-semibold">Review</label>
          <Textarea id="body" rows={7} maxLength={1000} value={f.body} onChange={(e) => set("body", e.target.value)} aria-describedby="body-count" />
          <p id="body-count" className="text-sm text-muted-foreground">{f.body.length.toLocaleString("en-GB")}/1,000</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-secondary p-5">
        <h2 className="text-xl font-bold">About you <span className="text-base font-normal">(optional)</span></h2>
        <p>These answers help us spot unfair treatment across groups. They are never shown publicly or alongside your review.</p>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--brand-blue)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree to share this information privately with ratemyrecruiter.</span>
        </label>
        {consent && (
          <div className="space-y-4">
            {DEMOGRAPHICS.map((q) => (
              <Select key={q.key} id={q.key} label={q.label} value={demo[q.key] ?? ""} onChange={(v) => setDemo((p) => ({ ...p, [q.key]: v }))} options={q.options} />
            ))}
          </div>
        )}
      </section>

      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={saving}>
        {saving ? "Saving…" : edit ? "Save changes" : "Publish review"}
      </Button>
    </form>
  );
}
