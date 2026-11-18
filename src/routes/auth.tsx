import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/cc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = {
  redirect?: string | undefined;
  error?: string | undefined;
  error_code?: string | undefined;
  error_description?: string | undefined;
  confirmed?: string | undefined;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
    error: typeof s["error"] === "string" ? s["error"] : undefined,
    error_code: typeof s["error_code"] === "string" ? s["error_code"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
    confirmed: typeof s["confirmed"] === "string" ? s["confirmed"] : undefined,
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
  const search = Route.useSearch();
  const redirect = search.redirect;
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const target =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/discover";

  // Check URL query parameters and hash fragments for email confirmation redirects & errors
  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);

    // Check for auth error params from confirmation redirects
    const err = searchParams.get("error") || hashParams.get("error");
    const errCode = searchParams.get("error_code") || hashParams.get("error_code");
    const errDesc = searchParams.get("error_description") || hashParams.get("error_description");

    if (err || errCode || errDesc) {
      if (errCode === "otp_expired" || errDesc?.toLowerCase().includes("expired")) {
        setError("This email verification link has expired. Please sign in below or request a new confirmation email.");
        toast.error("Verification link has expired.");
      } else {
        const decoded = errDesc
          ? decodeURIComponent(errDesc.replace(/\+/g, " "))
          : "Invalid or expired confirmation link.";
        setError(decoded);
        toast.error(decoded);
      }
      setMode("in");
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return;
    }

    // Check if user arrived via confirmation redirect
    if (search.confirmed === "true" || hashParams.get("type") === "signup" || hashParams.get("access_token")) {
      setConfirmedSuccess(true);
    }

    // Listen for auth state changes (e.g. token exchanged from email verification)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        toast.success("Email verified successfully! Welcome to CreatorConnect.");
        nav({ to: target });
      }
    });

    // If active session exists, navigate directly to target
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        nav({ to: target });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [nav, target, search.confirmed]);

  async function handleResendVerification() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      toast.error("Please enter a valid email address to resend confirmation.");
      return;
    }
    setResending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectUrl = origin
        ? `${origin}/auth?redirect=${encodeURIComponent(target)}&confirmed=true`
        : undefined;

      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        ...(redirectUrl ? { options: { emailRedirectTo: redirectUrl } } : {}),
      });

      if (resendError) {
        toast.error(resendError.message);
      } else {
        toast.success("Verification email resent! Please check your inbox.");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setResending(false);
    }
  }

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    setIsUnconfirmed(false);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: e.trim(),
      password: p,
    });
    setBusy(false);
    if (authError) {
      if (authError.message?.toLowerCase().includes("email not confirmed")) {
        setIsUnconfirmed(true);
        return setError(
          "Please confirm your email before signing in. Check your inbox for the verification link.",
        );
      }
      return setError("Invalid email or password. Please check your credentials and try again.");
    }
    toast.success("Signed in successfully!");
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

    // Sign up mode
    setBusy(true);
    setError(null);
    setIsUnconfirmed(false);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectUrl = origin
      ? `${origin}/auth?redirect=${encodeURIComponent(target)}&confirmed=true`
      : undefined;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      ...(redirectUrl ? { options: { emailRedirectTo: redirectUrl } } : {}),
    });
    setBusy(false);

    if (signUpError) {
      return setError(signUpError.message);
    }

    // If auto-confirm is enabled or session exists immediately
    if (signUpData?.session) {
      toast.success("Account created successfully!");
      nav({ to: target });
      return;
    }

    setSent(true);
    toast.success("Account created! Check your email to confirm your account.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Semantic Header with Official Logo */}
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
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-primary">
                <Mail className="size-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Verify your email address
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                We sent an official confirmation link to{" "}
                <strong className="text-foreground font-semibold">{email}</strong>. Please check
                your inbox (and spam folder) and click the link to activate your CreatorConnect
                account.
              </p>

              <div className="mt-6 rounded-2xl bg-muted/50 p-4 border border-border/60 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" /> What to expect:
                </p>
                <p>• Clicking the link will verify your email and redirect you to the portal.</p>
                <p>• If you don't see the email within a few minutes, check your spam or junk folder.</p>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl font-medium"
                  disabled={resending}
                  onClick={handleResendVerification}
                >
                  <RefreshCw className={cn("size-4 mr-2", resending && "animate-spin")} />
                  {resending ? "Resending..." : "Resend verification email"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSent(false);
                    setMode("in");
                    setPassword("");
                    setError(null);
                  }}
                >
                  <ArrowLeft className="size-4 mr-2" />
                  Back to Sign in
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              {confirmedSuccess && (
                <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm font-medium text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <span>Email verified successfully! Please sign in with your password.</span>
                </div>
              )}

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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIsUnconfirmed(false);
                    }}
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
                    className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm font-medium text-destructive space-y-2"
                  >
                    <p>{error}</p>
                    {isUnconfirmed && (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resending}
                        className="text-xs font-semibold text-primary underline hover:opacity-80 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={cn("size-3", resending && "animate-spin")} />
                        {resending ? "Sending..." : "Click here to resend confirmation email"}
                      </button>
                    )}
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
                      setIsUnconfirmed(false);
                      setPassword("");
                    }}
                    className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1 cursor-pointer"
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
