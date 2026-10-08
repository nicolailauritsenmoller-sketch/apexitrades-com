import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";

export type SelfieCaptureMeta = {
  source: "camera";
  capturedAt: string;
  width: number;
  height: number;
  device: string;
};

/** Live camera capture - the only accepted selfie source for verification. */
export function LiveSelfieCapture({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { file: File; meta: SelfieCaptureMeta } | null;
  onChange: (v: { file: File; meta: SelfieCaptureMeta } | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!value) setPreview(null);
  }, [value]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera access is required. Allow camera permission and try again.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const track = streamRef.current?.getVideoTracks()[0];
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreview(URL.createObjectURL(blob));
        onChange({
          file,
          meta: {
            source: "camera",
            capturedAt: new Date().toISOString(),
            width: canvas.width,
            height: canvas.height,
            device: track?.label || "camera",
          },
        });
        stop();
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="rounded-md border border-border p-3 text-xs">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      {preview && value ? (
        <div className="space-y-2">
          <img src={preview} alt="Captured selfie" className="h-40 w-full rounded-md object-cover" />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              void start();
            }}
            className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-border px-3 py-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retake
          </button>
        </div>
      ) : active ? (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="h-40 w-full rounded-md bg-muted object-cover" />
          <button
            type="button"
            onClick={capture}
            className="inline-flex touch-manipulation items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
          >
            <Camera className="h-3.5 w-3.5" /> Capture photo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-border px-3 py-1.5"
        >
          <Camera className="h-3.5 w-3.5" /> Open camera
        </button>
      )}
      {error && <p className="mt-2 text-bear">{error}</p>}
      <p className="mt-2 text-muted-foreground">Uploaded photos are not accepted - take the selfie live.</p>
    </div>
  );
}
