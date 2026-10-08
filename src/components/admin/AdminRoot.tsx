import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/admin.functions";
import { useHasSession } from "@/lib/use-session";
import { AuthenticatedGate } from "@/components/security/AuthenticatedGate";
import { OperationsConsole } from "@/components/admin/OperationsConsole";
import { BrandMark } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { PLATFORM_ORIGIN } from "@/lib/operations-routing";

export function AdminRoot({ tab, onTab }: { tab?: string; onTab: (tab: string) => void }) {
  const hasSession = useHasSession();
  return hasSession === null ? <p className="p-8 text-muted-foreground">Checking session...</p>
    : hasSession ? <AuthenticatedGate><OperationsConsole selectedTab={tab} onTab={onTab} /></AuthenticatedGate>
    : <StaffLogin />;
}

function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const access = useServerFn(getMyAccess);
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      const permissions = await access();
      if (!permissions.isStaff) { window.location.replace(PLATFORM_ORIGIN + "/"); return; }
      queryClient.clear();
      window.location.reload();
    } catch {
      toast.error("Unable to sign in. Check your credentials and try again.");
    } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-background px-4">
    <form onSubmit={signIn} className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6">
      <BrandMark className="size-12" alt="Velocity Trade shield" />
      <div><h1 className="text-xl font-bold">Operations Console</h1><p className="mt-1 text-sm text-muted-foreground">Restricted - authorised staff only</p></div>
      <label className="block space-y-2 text-sm">Staff email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" /></label>
      <label className="block space-y-2 text-sm">Password<PasswordInput required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Sign in</Button></div>
      <a href={PLATFORM_ORIGIN + "/"} className="block text-sm text-muted-foreground">Return to Velocity Trade</a>
    </form>
  </main>;
}