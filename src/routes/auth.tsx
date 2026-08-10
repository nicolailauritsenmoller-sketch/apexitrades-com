import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { PasswordInput } from "@/components/PasswordInput";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Velocity Trade" },
      {
        name: "description",
        content:
          "Sign in or create a Velocity Trade account to trade crypto, stocks, futures, forex and gold with live market prices.",
      },
      { property: "og:title", content: "Sign in — Velocity Trade" },
      {
        property: "og:description",
        content: "Access your multi-currency trading account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
        toast.success("Reset code sent — check your inbox.");
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created — fund your wallet to start trading.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-7">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-4" strokeWidth={2.8} />
          </span>
          <span className="font-display text-sm font-bold">VELOCITY TRADE</span>
          <ThemeToggle className="ml-auto" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">
          {mode === "signup"
            ? "Create your account"
            : mode === "signin"
              ? "Welcome back"
              : "Reset your password"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Create your account, then fund it with a deposit to start trading."
            : mode === "signin"
              ? "Sign in to your trading account."
              : "We'll email you a verification code and a secure reset link."}
        </p>

        {mode !== "forgot" && (
          <>
            <button
              onClick={onGoogle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or email{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={onSubmit} className={`space-y-3 ${mode === "forgot" ? "mt-6" : ""}`}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring"
          />
          {mode !== "forgot" && (
            <PasswordInput
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "Working…"
              : mode === "signup"
                ? "Create account"
                : mode === "signin"
                  ? "Sign in"
                  : "Send reset code"}
          </button>
        </form>

        {mode === "forgot" && sent && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Code sent.{" "}
            <Link to="/reset-password" className="font-medium text-primary hover:underline">
              Enter your code
            </Link>
          </p>
        )}

        {mode === "signin" && (
          <button
            onClick={() => {
              setMode("forgot");
              setSent(false);
            }}
            className="mt-4 w-full text-center text-xs text-primary transition-opacity hover:opacity-80"
          >
            Forgot password?
          </button>
        )}

        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : mode === "signin"
              ? "New here? Create an account"
              : "Back to sign in"}
        </button>
      </div>
    </div>
  );
}
