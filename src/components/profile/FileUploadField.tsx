import { useState } from "react";

export const MAX_FILE_MB = 5;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"];

/** Returns an error message when the file fails the format/size rules, else null. */
export function validateFile(file: File, allowed: string[]): string | null {
  if (allowed.length && !allowed.includes(file.type)) {
    const names = allowed.map((t) => t.split("/")[1].toUpperCase()).join(", ");
    return `Unsupported format. Accepted: ${names}.`;
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${MAX_FILE_MB} MB.`;
  }
  return null;
}

export type UploadStage = "idle" | "uploading" | "done";

/** Labelled file input with inline format/size validation and an upload progress bar. */
export function FileUploadField({
  label,
  accept,
  allowed,
  capture,
  file,
  onChange,
  stage = "idle",
}: {
  label: string;
  accept: string;
  allowed: string[];
  capture?: "user" | "environment";
  file: File | null;
  onChange: (file: File | null) => void;
  stage?: UploadStage;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <label className="block rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
      {label}
      <input
        type="file"
        accept={accept}
        capture={capture}
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          if (!next) {
            setError(null);
            onChange(null);
            return;
          }
          const message = validateFile(next, allowed);
          setError(message);
          onChange(message ? null : next);
        }}
        className="mt-2 block w-full text-xs"
      />
      <span className="mt-1 block text-[11px] text-muted-foreground">
        {accept.includes("pdf") ? "JPG, PNG, WEBP or PDF" : "JPG, PNG or WEBP"} · up to {MAX_FILE_MB}{" "}
        MB
      </span>
      {error && <span className="mt-1 block text-[11px] text-bear">{error}</span>}
      {file && !error && <span className="mt-1 block text-foreground">{file.name}</span>}
      {stage !== "idle" && (
        <span className="mt-2 block">
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <span
              className={`block h-full rounded-full bg-primary transition-all duration-500 ${
                stage === "done" ? "w-full" : "w-2/3 animate-pulse"
              }`}
            />
          </span>
          <span className="mt-1 block text-[11px]">
            {stage === "done" ? "Uploaded" : "Uploading…"}
          </span>
        </span>
      )}
    </label>
  );
}
