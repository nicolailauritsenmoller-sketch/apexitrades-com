import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password - Velocity Trade" },
      {
        name: "description",
        content:
          "Verify your emailed code and set a new password for your Velocity Trade trading account.",
      },
      { property: "og:title", content: "Reset password - Velocity Trade" },
      { property: "og:description", content: "Set a new password for your Velocity Trade account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Arriving from the emailed link already establishes a recovery session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setHasSession(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "recovery",
      });
      if (error) throw error;
      setHasSession(true);
      toast.success("Code verified - choose a new password.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-7">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <KeyRound className="size-4" strokeWidth={2.6} />
        </span>
        <h1 className="mt-5 text-2xl font-bold">
          {hasSession ? "Set a new password" : "Verify your code"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {hasSession
            ? "Choose a strong password you haven't used before."
            : "Enter the email you requested the reset for and the 6-digit code we sent."}
        </p>

        {hasSession ? (
          <form onSubmit={updatePassword} className="mt-6 space-y-3">
            <PasswordInput
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
            />
            <PasswordInput
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
            <input
              required
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="num w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm tracking-[0.4em] outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify code"}
            </button>
          </form>
        )}

        <Link
          to="/auth"
          className="mt-5 block text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
