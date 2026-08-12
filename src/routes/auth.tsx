import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrustStrip } from "@/components/TrustBadges";
import { toast } from "sonner";
import brandLogo from "@/assets/velocity-trade-logo.png";
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
  const [referral, setReferral] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) {
      setReferral(code.toUpperCase());
      setMode("signup");
    }
  }, []);

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
          options: {
            emailRedirectTo: window.location.origin,
            data: referral.trim() ? { referral_code: referral.trim().toUpperCase() } : {},
          },
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
      <div className="panel relative w-full max-w-sm p-7 pt-16">
        <div className="absolute left-7 top-6 flex items-center gap-2">
          <img
            src={brandLogo}
            alt="Velocity Trade logo"
            className="size-7 rounded-lg object-contain"
          />
          <span className="font-display text-sm font-bold">VELOCITY TRADE</span>
        </div>
        <ThemeToggle className="absolute right-7 top-6" />

        <h1 className="mt-0 text-2xl font-bold">
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
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary"
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
          {mode === "signup" && (
            <input
              value={referral}
              onChange={(e) => setReferral(e.target.value.toUpperCase())}
              maxLength={16}
              placeholder="Referral code (optional)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm uppercase tracking-wider outline-none transition-colors focus:border-ring"
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
          <TrustStrip className="pt-1" />
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
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <span className="font-bold text-[#22C55E]">Sign in</span>
            </>
          ) : mode === "signin" ? (
            <>
              New here? <span className="font-bold text-[#22C55E]">Create an account</span>
            </>
          ) : (
            "Back to sign in"
          )}
        </button>
      </div>
    </div>
  );
}
