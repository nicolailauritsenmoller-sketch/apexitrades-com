import { useEffect, useState } from "react";

export function KycEvidencePreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!file || !url) return null;
  return file.type === "application/pdf" ? (
    <div className="space-y-2">
      <iframe src={url} title="Proof of Address preview" className="h-56 w-full rounded-md border border-border" />
      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Open Proof of Address PDF</a>
    </div>
  ) : <img src={url} alt="Proof of Address preview" className="h-56 w-full rounded-md border border-border object-contain" />;
}