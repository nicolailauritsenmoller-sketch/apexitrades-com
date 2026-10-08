import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function AdminActionConfirm({ open, title, description, pending, onClose, onConfirm, destructive = true }: {
  open: boolean; title: string; description: string; pending: boolean;
  onClose: () => void; onConfirm: (reason: string) => Promise<unknown>; destructive?: boolean;
}) {
  const [reason, setReason] = useState("");
  return <Dialog open={open} onOpenChange={(next) => { if (!next && !pending) { setReason(""); onClose(); } }}>
    <DialogContent className="z-[130]" onEscapeKeyDown={(e) => { if (pending) e.preventDefault(); }} onPointerDownOutside={(e) => { if (pending) e.preventDefault(); }}>
      <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-destructive" />{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <label className="space-y-2 text-sm font-medium">Audit reason (required)
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} minLength={5} maxLength={400} rows={3} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Document the reason for this action" />
      </label>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" disabled={pending} onClick={() => { setReason(""); onClose(); }}>Cancel</Button>
        <Button variant={destructive ? "destructive" : "default"} disabled={pending || reason.trim().length < 5} onClick={() => { void onConfirm(reason.trim()).then(() => { setReason(""); onClose(); }).catch(() => undefined); }}>
          {pending && <Loader2 className="animate-spin" />}{title}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}