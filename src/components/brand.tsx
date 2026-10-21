import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="ratemyrecruiter home" className={cn("text-2xl font-extrabold tracking-tighter", className)}>
      <span className="text-brand-red">rate</span>
      <span className="text-brand-blue">my</span>
      <span className="text-brand-red">recruiter</span>
    </Link>
  );
}

export function Stars({ value, size = 18, label }: { value: number; size?: number; label?: string }) {
  return (
    <span role="img" aria-label={label ?? `${value} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star aria-hidden className="absolute inset-0 fill-star-empty text-star-empty" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star aria-hidden className="fill-star text-star" style={{ width: size, height: size }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Accessible 1–5 star picker built on radio inputs, with optional "Not applicable". */
export function StarInput({
  name, legend, value, onChange, allowNA,
}: { name: string; legend: string; value: number | null | undefined; onChange: (v: number | null) => void; allowNA?: boolean }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{legend}</legend>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring">
            <input type="radio" name={name} className="sr-only" checked={value === n} onChange={() => onChange(n)} />
            <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
            <Star aria-hidden className={cn("h-8 w-8", value != null && value >= n ? "fill-star text-star" : "fill-star-empty text-star-empty")} />
          </label>
        ))}
        {allowNA && (
          <label className="ml-2 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
            <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
            Not applicable
          </label>
        )}
      </div>
    </fieldset>
  );
}
