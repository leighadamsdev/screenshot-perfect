import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

const safePath = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/review");

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in · ratemyrecruiter" },
      { name: "description", content: "Sign in with a secure email link to write and manage your recruiter reviews." },
      { property: "og:title", content: "Sign in · ratemyrecruiter" },
      { property: "og:description", content: "Sign in with a secure email link to write and manage your recruiter reviews." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const target = safePath(redirect);
  const navigate = useNavigate();
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: target, replace: true });
  }, [user, target, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) return setError("Enter a valid email address.");
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(target)}` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
      {state === "sent" ? (
        <p role="status" className="mt-4 text-lg">
          Check your inbox. We've sent a sign-in link to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <p className="text-muted-foreground">We'll email you a link. No password needed.</p>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" autoComplete="email" className="h-11" value={email}
              onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "email-error" : undefined} />
            {error && <p id="email-error" className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <Button type="submit" variant="accent" className="w-full" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
    </div>
  );
}
