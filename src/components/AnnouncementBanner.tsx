import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";
import { getActiveAnnouncements, type Announcement } from "@/lib/announcements.functions";
import { useHasSession } from "@/lib/use-session";

const STORAGE_KEY = "vt.dismissed-announcements";

const TONE: Record<
  Announcement["severity"],
  { wrap: string; icon: typeof Info; label: string }
> = {
  info: {
    wrap: "border-primary/40 bg-primary/10 text-foreground",
    icon: Info,
    label: "Info",
  },
  warning: {
    wrap: "border-amber-500/40 bg-amber-500/10 text-foreground",
    icon: AlertTriangle,
    label: "Warning",
  },
  critical: {
    wrap: "border-bear/50 bg-bear/15 text-foreground",
    icon: ShieldAlert,
    label: "Critical",
  },
};

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const fetchAnnouncements = useServerFn(getActiveAnnouncements);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => setDismissed(readDismissed()), []);

  const hasSession = useHasSession();

  const query = useQuery({
    queryKey: ["announcements-active"],
    queryFn: () => fetchAnnouncements(),
    enabled: hasSession === true,
    retry: false,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const rows = (query.data ?? []).filter(
    (a) => a.severity === "critical" || !dismissed.includes(a.id),
  );
  if (rows.length === 0) return null;

  function dismiss(id: string) {
    const next = Array.from(new Set([...readDismissed(), id]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDismissed(next);
  }

  return (
    <div className="sticky top-0 z-50 space-y-px">
      {rows.map((a) => {
        const tone = TONE[a.severity] ?? TONE.info;
        const Icon = tone.icon;
        return (
          <div
            key={a.id}
            role="status"
            className={`flex touch-manipulation items-start gap-3 border-b px-4 py-2.5 backdrop-blur-xl ${tone.wrap}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{a.title}</span>{" "}
              <span className="text-muted-foreground">{a.body}</span>
            </div>
            {a.severity === "critical" ? (
              <span className="shrink-0 rounded-full border border-bear/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bear">
                Pinned
              </span>
            ) : (
              <button
                onClick={() => dismiss(a.id)}
                aria-label="Dismiss announcement"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
