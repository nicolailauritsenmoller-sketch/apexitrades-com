import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ensurePushPermission,
  playChime,
  pushNotify,
  startChatLoop,
  stopChatLoop,
  unlockAudio,
} from "@/lib/alerts";

const SOUND_KEY = "velocity:desk-sound";
const PUSH_KEY = "velocity:desk-push";

function money(v: unknown) {
  const n = Number(v ?? 0);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Realtime alert engine for the operations console: loud chimes plus desktop
 * push notifications for every inbound user event. The chat bell loops until
 * an agent focuses the support desk.
 */
export function AdminAlerts() {
  const [sound, setSound] = useState(true);
  const [push, setPush] = useState(false);

  useEffect(() => {
    setSound(localStorage.getItem(SOUND_KEY) !== "off");
    setPush(localStorage.getItem(PUSH_KEY) === "on" && Notification?.permission === "granted");
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const alert = useCallback(
    (kind: Parameters<typeof playChime>[0], title: string, body: string, loop = false) => {
      if (sound) {
        if (loop) startChatLoop();
        else playChime(kind);
      }
      if (push) pushNotify(title, body, kind);
      toast(title, { description: body });
    },
    [sound, push],
  );

  // Stop the looping chat bell as soon as an agent looks at the support desk.
  useEffect(() => {
    const stop = () => stopChatLoop();
    window.addEventListener("desk:chat-focus", stop);
    return () => {
      window.removeEventListener("desk:chat-focus", stop);
      stopChatLoop();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("desk-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_sessions" },
        (p) => {
          const r = p.new as any;
          alert(
            "visit",
            "New user on the platform",
            `${r.browser ?? "Browser"} · ${r.os ?? ""} ${r.country ? `· ${r.country}` : ""}`.trim(),
          );
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deposits" }, (p) => {
        const r = p.new as any;
        alert("money", "New deposit request", `${money(r.amount)} ${r.coin} awaiting approval`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "withdrawals" }, (p) => {
        const r = p.new as any;
        alert(
          "money",
          "New withdrawal request",
          `${money(r.amount)} ${r.coin} from user ${String(r.user_id).slice(0, 8)}`,
        );
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kyc_submissions" },
        (p) => {
          const r = p.new as any;
          alert("kyc", "KYC documents submitted", `${r.full_name ?? "A user"} · ${r.country ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        (p) => {
          const r = p.new as any;
          alert("chat", "New support ticket", `${r.subject} (${r.priority})`, true);
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        const r = p.new as any;
        if (r.sender_role !== "user") return;
        alert("chat", "New live chat message", String(r.body).slice(0, 120), true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alert]);

  async function togglePush() {
    if (push) {
      setPush(false);
      localStorage.setItem(PUSH_KEY, "off");
      return;
    }
    const permission = await ensurePushPermission();
    if (permission !== "granted") {
      toast.error("Desktop notifications were blocked by the browser.");
      return;
    }
    setPush(true);
    localStorage.setItem(PUSH_KEY, "on");
    pushNotify("Desk notifications enabled", "You will be alerted about new platform activity.");
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (!next) stopChatLoop();
    else {
      unlockAudio();
      playChime("visit");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleSound}
        title={sound ? "Mute alert sounds" : "Enable alert sounds"}
        aria-label={sound ? "Mute alert sounds" : "Enable alert sounds"}
        className={`grid size-9 touch-manipulation place-items-center rounded-md transition-colors hover:bg-secondary ${
          sound ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
      <button
        onClick={togglePush}
        title={push ? "Disable desktop notifications" : "Enable desktop notifications"}
        aria-label={push ? "Disable desktop notifications" : "Enable desktop notifications"}
        className={`grid size-9 touch-manipulation place-items-center rounded-md transition-colors hover:bg-secondary ${
          push ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {push ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      </button>
    </div>
  );
}
