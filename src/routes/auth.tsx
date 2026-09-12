import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrustStrip } from "@/components/TrustBadges";
import { toast } from "sonner";
import brandLogo from "@/assets/velocity-trade-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { PasswordInput } from "@/components/PasswordInput";
import { OtpInput } from "@/components/OtpInput";

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

type Mode = "signin" | "signup" | "forgot" | "verify" | "reset-otp" | "reset";

const RESEND_SECONDS = 60;
const OTP_TTL_SECONDS = 600; // Supabase OTP expiry — 10 minutes

/** m••••@gmail.com — never render the full address on the verification screen. */
function maskEmail(value: string) {
  const [local = "", domain = ""] = value.split("@");
  if (!local || !domain) return value;
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(4, local.length - 1))}@${domain}`;
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [referral, setReferral] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setReferral(ref.toUpperCase());
      setMode("signup");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (expiresIn <= 0) return;
    const t = setTimeout(() => setExpiresIn((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [expiresIn]);

  function startCodeTimers() {
    setCooldown(RESEND_SECONDS);
    setExpiresIn(OTP_TTL_SECONDS);
  }

  const mismatch =
    (mode === "signup" || mode === "reset") &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setCode("");
        setCodeError("");
        setPassword("");
        setConfirmPassword("");
        startCodeTimers();
        setMode("reset-otp");
        toast.success("We sent a 6-digit code to your email.");
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setPasswordError("Passwords do not match");
          return;
        }
        setPasswordError("");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: referral.trim() ? { referral_code: referral.trim().toUpperCase() } : {},
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        setCode("");
        setCodeError("");
        startCodeTimers();
        setMode("verify");
        toast.success("Enter the 6-digit code we emailed you.");
        return;
      }

      if (mode === "verify") {
        const token = code.trim();
        const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
        if (error) {
          // Some projects issue the code as an "email" OTP instead of "signup".
          const { error: fallbackError } = await supabase.auth.verifyOtp({
            email,
            token,
            type: "email",
          });
          if (fallbackError) throw error;
        }
        setCodeError("");
        toast.success("Email verified — welcome to Velocity Trade.");
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      if (mode === "reset-otp") {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type: "recovery",
        });
        if (error) throw error;
        setCodeError("");
        setExpiresIn(0);
        setMode("reset");
        toast.success("Code verified — choose a new password.");
        return;
      }

      if (mode === "reset") {
        if (password.length < 8) {
          setPasswordError("Password must be at least 8 characters");
          return;
        }
        if (password !== confirmPassword) {
          setPasswordError("Passwords do not match");
          return;
        }
        setPasswordError("");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        toast.success("Password updated.");
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      if (mode === "verify" || mode === "reset-otp") setCodeError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (cooldown > 0) return;
    try {
      if (mode === "verify") {
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
      }
      setCode("");
      setCodeError("");
      startCodeTimers();
      toast.success("New code sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the code.");
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

  async function onApple() {
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Apple sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  const heading =
    mode === "signup"
      ? "Create your account"
      : mode === "signin"
        ? "Welcome back"
        : mode === "forgot"
          ? "Reset your password"
          : mode === "verify"
            ? "Verify your email"
            : mode === "reset-otp"
              ? "Enter your reset code"
              : "Create new password";

  const subheading =
    mode === "signup"
      ? "Create your account, then fund it with a deposit to start trading."
      : mode === "signin"
        ? "Sign in to your trading account."
        : mode === "forgot"
          ? "We'll email you a 6-digit verification code."
          : mode === "reset"
            ? "Choose a strong password you haven't used before."
            : `Enter the 6-digit code sent to ${maskEmail(email)}.`;

  const isCodeStep = mode === "verify" || mode === "reset-otp";
  const expired = isCodeStep && expiresIn <= 0;


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
        <h1 className="mt-0 text-2xl font-bold">{heading}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subheading}</p>

        {(mode === "signin" || mode === "signup") && (
          <>
            <button
              onClick={onApple}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09zM12.03 7.25c-.15-2.11 1.86-3.98 3.94-4.04.29 2.32-2.07 4.36-3.94 4.04z" />
              </svg>
              Continue with Apple
            </button>

            <button
              onClick={onGoogle}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary"
            >
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or email{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form
          onSubmit={onSubmit}
          className={`space-y-3 ${mode === "signin" || mode === "signup" ? "" : "mt-6"}`}
        >
          {!isCodeStep && mode !== "reset" && (
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring"
            />
          )}

          {isCodeStep && (
            <>
              <OtpInput
                autoFocus
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setCodeError("");
                }}
                disabled={busy}
                invalid={!!codeError}
              />
              <div className="flex items-center justify-between text-xs">
                <span className={expired ? "text-destructive" : "text-muted-foreground"}>
                  {expired ? "Code expired" : `Expires in ${formatClock(expiresIn)}`}
                </span>
                {codeError && (
                  <span role="alert" className="font-medium text-destructive">
                    Invalid code
                  </span>
                )}
              </div>
            </>
          )}


          {(mode === "signin" || mode === "signup" || mode === "reset") && (
            <PasswordInput
              required
              minLength={mode === "reset" ? 8 : 6}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              placeholder={mode === "reset" ? "New password" : "Password"}
            />
          )}

          {(mode === "signup" || mode === "reset") && (
            <>
              <PasswordInput
                required
                minLength={mode === "reset" ? 8 : 6}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Confirm password"
                aria-invalid={mismatch}
                className={mismatch ? "border-destructive focus:border-destructive" : ""}
              />
              {(mismatch || passwordError) && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {passwordError || "Passwords do not match"}
                </p>
              )}
            </>
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
            disabled={busy || (isCodeStep && (code.length < 6 || expired)) || mismatch}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "Working…"
              : mode === "signup"
                ? "Create account"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Send 6-digit code"
                    : mode === "verify"
                      ? "Verify & continue"
                      : mode === "reset-otp"
                        ? "Verify code"
                        : "Update password"}

          </button>
          <TrustStrip className="pt-1" />
        </form>

        {isCodeStep && (
          <button
            onClick={onResend}
            disabled={cooldown > 0}
            className="mt-4 w-full text-center text-xs text-primary transition-opacity hover:opacity-80 disabled:text-muted-foreground"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        )}

        {mode === "signin" && (
          <button
            onClick={() => {
              setMode("forgot");
              setCode("");
            }}
            className="mt-4 w-full text-center text-xs text-primary transition-opacity hover:opacity-80"
          >
            Forgot password?
          </button>
        )}

        {mode === "reset" && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Used an emailed link instead?{" "}
            <Link to="/reset-password" className="font-medium text-primary hover:underline">
              Continue here
            </Link>
          </p>
        )}

        <button
          onClick={() => {
            setPasswordError("");
            setConfirmPassword("");
            setCode("");
            setMode(mode === "signup" ? "signin" : "signup");
          }}
          className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signup" ? (
            <>
              Already have an account? <span className="font-bold text-[#22C55E]">Sign in</span>
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
