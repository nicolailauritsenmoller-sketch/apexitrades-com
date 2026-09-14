import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ensurePushPermission,
  isChatSessionWatched,
  playChime,
  playSoftPing,
  pushNotify,
  startChatLoop,
  stopChatLoop,
  unlockAudio,
} from "@/lib/alerts";
import {
  DESK_AUDIO_UNLOCK_KEY,
  playDeskSound,
  preloadDeskSounds,
  unlockDeskAudio,
  type DeskSound,
} from "@/lib/desk-sounds";


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
  const [audioReady, setAudioReady] = useState(true);

  useEffect(() => {
    setSound(localStorage.getItem(SOUND_KEY) !== "off");
    setPush(localStorage.getItem(PUSH_KEY) === "on" && Notification?.permission === "granted");
    setAudioReady(localStorage.getItem(DESK_AUDIO_UNLOCK_KEY) === "1");
    preloadDeskSounds();
    // One click anywhere on the console grants browser autoplay permission.
    const unlock = () => {
      unlockAudio();
      void unlockDeskAudio().then((ok) => ok && setAudioReady(true));
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  /** Distinct per-event chime from the Control Center sound library. */
  const cue = useCallback(
    (kind: DeskSound) => {
      if (sound) playDeskSound(kind);
    },
    [sound],
  );

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

  const settle = useCallback(
    (win: boolean, title: string, body: string) => {
      if (sound) playChime(win ? "win" : "loss");
      if (push) pushNotify(title, body, win ? "win" : "loss");
      toast(title, {
        description: body,
        className: win ? "text-ops-emerald font-semibold" : "text-ops-red font-semibold",
      });
    },
    [sound, push],
  );

  // Latest handlers kept in refs so the realtime channel subscribes exactly once
  // and never drops events while toggling sound/push.
  const handlers = useRef({ alert, settle, cue, sound, push });
  handlers.current = { alert, settle, cue, sound, push };

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
          cue("visitor");
          alert(
            "visit",
            "New user on the platform",
            `${r.browser ?? "Browser"} · ${r.os ?? ""} ${r.country ? `· ${r.country}` : ""}`.trim(),
          );
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, (p) => {
        const r = (p.new ?? {}) as any;
        if (!r.id) return;
        const stable = String(r.coin ?? "").toUpperCase().startsWith("USD");
        const vipSize = stable && Number(r.amount ?? 0) >= 20_000;
        cue(vipSize ? "vip-deposit" : "deposit");
        alert(
          "money",
          p.eventType === "INSERT"
            ? vipSize
              ? "VIP-tier deposit request"
              : "New deposit request"
            : "Deposit request updated",
          `${money(r.amount)} ${r.coin} · ${r.status}`,
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contracts" }, (p) => {
        const r = p.new as any;
        cue("trade");
        alert(
          "trade",
          "Scalp contract opened",
          `${r.display_symbol ?? r.symbol} · ${String(r.direction).toUpperCase()} · ${money(r.stake)} ${r.currency} · ${r.duration_seconds}s · user ${String(r.user_id).slice(0, 8)}`,
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contracts" }, (p) => {
        const r = (p.new ?? {}) as any;
        const prev = (p.old ?? {}) as any;
        if (r.status !== "settled" && r.status !== "closed") return;
        if (prev.status === r.status) return;
        cue("trade");
        const win = r.result === "win";
        const pnl = Number(r.payout ?? 0) - Number(r.stake ?? 0);
        settle(
          win,
          `${win ? "PROFIT" : "LOSS"} · ${r.display_symbol ?? r.symbol}`,
          `Entry ${money(r.entry_price)} → exit ${money(r.exit_price)} · P&L ${pnl >= 0 ? "+" : ""}${money(pnl)} ${r.currency} · user ${String(r.user_id).slice(0, 8)}`,
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "positions" }, (p) => {
        const r = p.new as any;
        cue("trade");
        alert(
          "trade",
          "Margin position opened",
          `${r.display_symbol ?? r.symbol} · ${String(r.side).toUpperCase()} ×${Number(r.leverage ?? 1)} · ${money(r.quantity)} @ ${money(r.entry_price)} · user ${String(r.user_id).slice(0, 8)}`,
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "positions" }, (p) => {
        const r = (p.new ?? {}) as any;
        const prev = (p.old ?? {}) as any;
        if (r.status !== "closed" || prev.status === "closed") return;
        cue("trade");
        const pnl = Number(r.realized_pnl ?? 0);
        settle(
          pnl >= 0,
          `${pnl >= 0 ? "PROFIT" : "LOSS"} · ${r.display_symbol ?? r.symbol}`,
          `Entry ${money(r.entry_price)} → exit ${money(r.exit_price)} · P&L ${pnl >= 0 ? "+" : ""}${money(pnl)} ${r.currency} · user ${String(r.user_id).slice(0, 8)}`,
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, (p) => {
        const r = (p.new ?? {}) as any;
        if (!r.id) return;
        cue("withdrawal");
        alert(
          "money",
          p.eventType === "INSERT" ? "New withdrawal request" : "Withdrawal request updated",
          `${money(r.amount)} ${r.coin} from user ${String(r.user_id).slice(0, 8)}`,
        );
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kyc_submissions" },
        (p) => {
          const r = p.new as any;
          cue("kyc");
          alert("kyc", "KYC documents submitted", `${r.full_name ?? "A user"} · ${r.country ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kyc_submissions" },
        (p) => {
          const r = p.new as any;
          if (r.status !== "pending") return;
          cue("kyc");
          alert("kyc", "KYC resubmitted for review", `${r.full_name ?? "A user"} · ${r.country ?? ""}`);
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (p) => {
        const r = p.new as any;
        cue("new-user");
        alert(
          "visit",
          "New user registration",
          `${r.display_name ?? "A new trader"}${r.uid ? ` (ID ${r.uid})` : ""} just created an account.`,
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (p) => {
        const r = (p.new ?? {}) as any;
        const prev = (p.old ?? {}) as any;
        if (r.vip_tier !== "vip_pending" || prev.vip_tier === "vip_pending") return;
        cue("vip-request");
        alert(
          "money",
          "VIP membership request",
          `${r.display_name ?? "A user"}${r.uid ? ` (ID ${r.uid})` : ""} is awaiting VIP approval.`,
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        const r = p.new as any;
        if (r.sender_role !== "user") return;
        window.dispatchEvent(new CustomEvent("desk:chat-inbound"));
        const watched = isChatSessionWatched(r.session_id);
        if (watched) {
          // Conversation is open and focused: single subtle chime, no loop.
          stopChatLoop();
          if (sound) playSoftPing();
          if (push) pushNotify("New live chat message", String(r.body).slice(0, 120), "chat");
          toast("New live chat message", { description: String(r.body).slice(0, 120) });
          return;
        }
        alert("chat", "New live chat message", String(r.body).slice(0, 120), true);
      })

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alert, settle, cue]);

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
      void unlockDeskAudio().then((ok) => ok && setAudioReady(true));
      playDeskSound("deposit");
    }
  }

  return (
    <div className="flex items-center gap-1">
      {sound && !audioReady && (
        <button
          type="button"
          onClick={() => void unlockDeskAudio().then((ok) => ok && setAudioReady(true))}
          className="mr-1 hidden touch-manipulation items-center gap-1.5 rounded-md border border-ops-amber/25 bg-ops-amber-bg px-2.5 py-1.5 text-[11px] font-semibold text-ops-amber sm:flex"
        >
          <Volume2 className="size-3.5" /> Click to enable alert sounds
        </button>
      )}
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
