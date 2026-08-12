import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { getVipAttachmentUrl } from "@/lib/vip.functions";

export function formatBytes(size: number | null) {
  if (!size || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = size;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** Inline image preview or downloadable file card for a VIP chat attachment. */
export function VipAttachment({
  messageId,
  name,
  type,
  size,
}: {
  messageId: string;
  name: string | null;
  type: string | null;
  size?: number | null;
}) {
  const fetchUrl = useServerFn(getVipAttachmentUrl);
  const q = useQuery({
    queryKey: ["vip-attachment", messageId],
    queryFn: () => fetchUrl({ data: { messageId } }),
    staleTime: 600_000,
  });

  if (q.isLoading) return <Loader2 className="my-2 size-4 animate-spin opacity-70" />;
  const url = q.data?.url;
  if (!url) return null;

  if ((type ?? "").startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block" title="Open full size">
        <img
          src={url}
          alt={name ?? "Attachment"}
          loading="lazy"
          className="max-h-56 w-auto rounded-md border border-white/10 object-cover transition-transform hover:scale-[1.02]"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={name ?? true}
      className="mt-1 flex items-center gap-2 rounded-md border border-white/15 bg-black/20 px-2.5 py-2 text-xs"
    >
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name ?? "Attachment"}</span>
        {size ? <span className="text-[10px] opacity-70">{formatBytes(size)}</span> : null}
      </span>
      <Download className="size-4 shrink-0 opacity-80" />
    </a>
  );
}
