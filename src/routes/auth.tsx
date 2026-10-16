import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
      { title: "Sign In or Register — CreatorConnect" },
      {
        name: "description",
        content:
          "Sign in with email and password to access your creator event tickets and official meetups.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Sign In or Register — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Sign in with email and password to access your creator event tickets and official meetups.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/auth" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign In or Register — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Sign in with email and password to access your creator event tickets and official meetups.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/auth" }],
  }),
  component: AuthPage,
});

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function AuthPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const target =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/discover";

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: e.trim(),
      password: p,
    });
    setBusy(false);
    if (authError) {
      return setError("Invalid email or password. Please check your credentials and try again.");
    }
    nav({ to: target });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      return setError("Email address is required.");
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return setError("Please enter a valid email address (e.g. name@example.com).");
    }
    if (!password) {
      return setError("Password is required.");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters long.");
    }

    if (mode === "in") {
      return signIn(cleanEmail, password);
    }

    // Sign up mode: strictly email + password
    setBusy(true);
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      ...(origin ? { options: { emailRedirectTo: origin } } : {}),
    });
    setBusy(false);

    if (signUpError) {
      return setError(signUpError.message);
    }

    setSent(true);
    toast.success("Account created! Check your email to confirm your account.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Semantic Header with New Official Logo */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            to="/discover"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          >
            <img
              src="/assets/logo-icon.svg"
              alt="Creator Connect"
              width={36}
              height={36}
              className="size-9 transition-transform hover:scale-105"
            />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              Creator
              <span className="bg-gradient-to-r from-brand via-primary to-rose-500 bg-clip-text text-transparent">
                Connect
              </span>
            </span>
          </Link>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            Official Portal
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {mode === "in" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "in"
                ? "Sign in with your email and password to access your event passes."
                : "Join CreatorConnect to register for verified creator meetups and launches."}
            </p>
          </div>

          {sent ? (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                ✓
              </div>
              <h2 className="text-lg font-semibold text-foreground">Check your inbox</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a verification link to <strong className="text-foreground">{email}</strong>.
                Open it to finish creating your account.
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full rounded-xl"
                onClick={() => {
                  setSent(false);
                  setMode("in");
                  setPassword("");
                }}
              >
                Back to Sign in
              </Button>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <form onSubmit={submit} className="space-y-4" noValidate autoComplete="off">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email">Email address</Label>
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    required
                    placeholder="name@example.com"
                    className="h-12 rounded-xl text-base"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password">Password</Label>
                    <span className="text-xs text-muted-foreground">Minimum 8 characters</span>
                  </div>
                  <Input
                    id="auth-password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="h-12 rounded-xl text-base"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive"
                  >
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="w-full h-12 rounded-xl font-semibold shadow-brand"
                  disabled={busy}
                >
                  {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "in" ? "up" : "in");
                      setError(null);
                      setPassword("");
                    }}
                    className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
                  >
                    {mode === "in"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <footer className="mt-8 text-center text-xs text-muted-foreground">
            <p>Protected by CreatorConnect Verification &amp; Session Guard.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
