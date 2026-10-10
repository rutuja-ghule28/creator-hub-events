import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — CreatorConnect" },
      {
        name: "description",
        content: "Sign in to register for creator events and get your tickets.",
      },
      { property: "og:title", content: "Sign in — CreatorConnect" },
      {
        property: "og:description",
        content: "Sign in to register for creator events and get your tickets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const DEMOS = [
  { label: "Attendee", email: "attendee@creatorconnect.app" },
  { label: "Creator · Meera Joshi", email: "meera@creatorconnect.app" },
  { label: "Creator · Kabir Sharma", email: "kabir@creatorconnect.app" },
  { label: "Admin", email: "admin@creatorconnect.app" },
];
const DEMO_PASS = "Demo@1234";

function AuthPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const target =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/discover";

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    setBusy(false);
    if (error) return setError("Email or password is wrong. Check them and try again.");
    nav({ to: target });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setError("Enter a valid email, like name@example.com.");
    if (password.length < 8) return setError("Password needs at least 8 characters.");
    if (mode === "in") return signIn(email, password);
    if (name.trim().length < 2) return setError("Enter your full name.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
    toast.success("Check your email to confirm your account.");
  }

  return (
    <main className="min-h-screen px-5 pb-10 pt-12">
      <div className="mb-8 flex items-center gap-2">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-brand text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <span className="font-display text-xl font-bold">CreatorConnect</span>
      </div>
      <h1 className="text-3xl font-bold leading-tight">
        {mode === "in" ? "Welcome back." : "Create your account."}
      </h1>
      <p className="mt-2 text-muted-foreground">Meet your favourite creators, in person.</p>

      {sent ? (
        <div className="mt-8 rounded-3xl bg-card p-6 ring-1 ring-border">
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Open it to finish signing up.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                className="h-12 rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="h-12 rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              className="h-12 rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
            }}
            className="min-h-11 w-full text-sm font-semibold text-primary"
          >
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      )}

      <section className="mt-8 rounded-3xl bg-card p-5 ring-1 ring-border" aria-labelledby="demo">
        <h2 id="demo" className="text-base font-semibold">
          Demo logins for testing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Password for all:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{DEMO_PASS}</code>
        </p>
        <ul className="mt-3 space-y-2">
          {DEMOS.map((d) => (
            <li key={d.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => signIn(d.email, DEMO_PASS)}
                className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-muted px-4 text-left text-sm hover:bg-accent"
              >
                <span>
                  <span className="block font-semibold">{d.label}</span>
                  <span className="text-muted-foreground">{d.email}</span>
                </span>
                <span className="text-xs font-semibold text-primary">Sign in</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
