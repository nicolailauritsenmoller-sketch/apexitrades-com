import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Eye, EyeOff } from "lucide-react";

/** Blurred 12-word recovery phrase grid with reveal, copy and download controls. */
export function RecoveryPhraseCard({ phrase }: { phrase: string }) {
  const [revealed, setRevealed] = useState(false);
  const words = phrase.trim().split(/\s+/);

  function download() {
    const blob = new Blob(
      [
        `Velocity Trade recovery phrase\nKeep these 12 words offline and private. Anyone with them can access your account.\n\n${words
          .map((w, i) => `${i + 1}. ${w}`)
          .join("\n")}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "velocity-trade-recovery-phrase.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-border p-3">
        <div
          className={`grid grid-cols-3 gap-2 transition-[filter] duration-200 ${
            revealed ? "" : "select-none blur-[8px]"
          }`}
        >
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs"
            >
              <span className="text-[10px] text-muted-foreground">{index + 1}</span>
              <span className="font-mono">{word}</span>
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {revealed ? "Hide recovery phrase" : "View recovery phrase"}
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(words.join(" "));
            toast.success("Recovery phrase copied");
          }}
          className="flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
        >
          <Copy className="size-3.5" /> Copy phrase
        </button>
        <button
          type="button"
          onClick={download}
          className="flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
        >
          <Download className="size-3.5" /> Download TXT
        </button>
      </div>
    </div>
  );
}
