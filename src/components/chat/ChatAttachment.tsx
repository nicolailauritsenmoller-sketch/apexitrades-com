import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import { getChatAttachmentUrl } from "@/lib/desk.functions";

/** Renders an image preview or file link for a chat attachment. */
export function ChatAttachment({
  messageId,
  name,
  type,
}: {
  messageId: string;
  name: string | null;
  type: string | null;
}) {
  const fetchUrl = useServerFn(getChatAttachmentUrl);
  const q = useQuery({
    queryKey: ["chat-attachment", messageId],
    queryFn: () => fetchUrl({ data: { messageId } }),
    staleTime: 600_000,
  });

  if (q.isLoading) {
    return <Loader2 className="my-2 size-4 animate-spin opacity-70" />;
  }
  const url = q.data?.url;
  if (!url) return null;

  if ((type ?? "").startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <img
          src={url}
          alt={name ?? "Attachment"}
          className="max-h-48 w-auto rounded-md border border-border/50 object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5 text-xs underline-offset-2 hover:underline"
    >
      <FileText className="size-3.5" />
      {name ?? "Download attachment"}
    </a>
  );
}
