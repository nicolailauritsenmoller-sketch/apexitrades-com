import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, ShieldCheck, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { advanceHeadTurn, CHALLENGE_TIMEOUT_MS, type ChallengeState, type HeadTurnEvidence } from "@/lib/head-turn-challenge";

export type SelfieCaptureMeta = {
  source: "camera";
  capturedAt: string;
  width: number;
  height: number;
  device: string;
  movementChallenge?: HeadTurnEvidence;
};

/** Live camera capture - the only accepted selfie source for verification. */
export function LiveSelfieCapture({
  label,
  value,
  onChange,
  headTurn = false,
}: {
  label: string;
  value: { file: File; meta: SelfieCaptureMeta } | null;
  onChange: (v: { file: File; meta: SelfieCaptureMeta } | null) => void;
  headTurn?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preAuthOpen, setPreAuthOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [instruction, setInstruction] = useState("Look straight ahead");
  const detectorRef = useRef<Awaited<ReturnType<typeof import("@/lib/face-movement-detector")["createFaceMovementDetector"]>> | null>(null);
  const frameRef = useRef<number | null>(null);
  const runRef = useRef(0);

  const stop = () => {
    runRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!value) setPreview(null);
  }, [value]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!active || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => setError("Unable to start camera preview. Try again."));
    if (!headTurn) return;
    const run = runRef.current;
    let state: ChallengeState = { phase: "center", heldSince: null, startedAt: performance.now(), direction: crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "left" : "right" };
    let lastTime = -1;
    let lastFrame = 0;
    const tick = (now: number) => {
      if (run !== runRef.current) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector) return;
      if (now - state.startedAt > CHALLENGE_TIMEOUT_MS) {
        stop();
        setError("Head-turn check timed out. Open the camera to try again.");
        return;
      }
      if (video.readyState >= 2 && video.currentTime !== lastTime && now - lastFrame >= 100) {
        lastTime = video.currentTime;
        lastFrame = now;
        try {
          const result = detector.detectForVideo(video, now);
          const matrix = result.facialTransformationMatrixes[0]?.data;
          const yaw = result.faceLandmarks.length === 1 && matrix ? Math.atan2(matrix[8], matrix[10]) : null;
          state = advanceHeadTurn(state, yaw, now);
          setInstruction(yaw === null ? "Keep one face clearly visible" : state.phase === "center" ? "Look straight ahead" : state.phase === "turn" ? `Turn your head slightly ${state.direction}` : "Return to looking straight ahead");
          if (state.phase === "complete") {
            capture({ kind: "head_turn", assurance: "client_observed_movement", direction: state.direction, completedAt: new Date().toISOString(), durationMs: Math.round(now - state.startedAt) });
            return;
          }
        } catch {
          stop();
          setError("Face tracking is unavailable on this device. Try another supported browser.");
          return;
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [active, headTurn]);

  async function start() {
    stop();
    setError(null);
    setStarting(true);
    setInstruction("Look straight ahead");
    const run = runRef.current;
    try {
      if (headTurn) {
        const { createFaceMovementDetector } = await import("@/lib/face-movement-detector");
        const detector = await createFaceMovementDetector();
        if (run !== runRef.current) { detector.close(); return; }
        detectorRef.current = detector;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (run !== runRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      setActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      stop();
      setError("Camera or face tracking could not start. Check camera permission and your connection, then try again.");
    } finally {
      setStarting(false);
    }
  }

  function capture(movementChallenge?: HeadTurnEvidence) {
    if (headTurn && !movementChallenge) return;
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
        if (!streamRef.current) return;
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
            ...(movementChallenge ? { movementChallenge } : {}),
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
          <Button variant="outline"
            type="button"
            onClick={() => {
              onChange(null);
              void start();
            }}
            className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-border px-3 py-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retake
          </Button>
        </div>
      ) : active ? (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="h-40 w-full rounded-md bg-muted object-cover" />
          {headTurn ? <p role="status" aria-live="polite" className="font-medium text-foreground">{instruction}</p> : <Button
            type="button"
            onClick={() => capture()}
            className="inline-flex touch-manipulation items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
          >
            <Camera className="h-3.5 w-3.5" /> Capture photo
          </Button>}
          <Button type="button" variant="ghost" size="sm" onClick={stop}>Cancel</Button>
        </div>
      ) : (
        <Button variant="outline"
          type="button"
          disabled={starting}
          onClick={() => setPreAuthOpen(true)}
          className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-border px-3 py-1.5"
        >
          <Camera className="h-3.5 w-3.5" /> {starting ? "Preparing camera..." : "Open camera"}
        </Button>
      )}
      {error && <p className="mt-2 text-bear">{error}</p>}
      <Dialog open={preAuthOpen} onOpenChange={setPreAuthOpen}>
        <DialogContent className="max-w-sm gap-0 rounded-lg border border-border bg-card p-0 shadow-xl">
          <div className="flex flex-col items-center gap-3 border-b border-border bg-gradient-to-b from-muted/60 to-transparent px-6 pb-5 pt-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Biometric Sensor Authorization
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              Velocity Trade requires secure camera access to perform live cryptographic liveness verification and identity attestation.
            </DialogDescription>
          </div>
          <div className="space-y-2 px-6 py-4 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Video frames are processed in your browser and only the captured attestation image is submitted.</span>
            </p>
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Access is used solely for this verification session and can be revoked at any time.</span>
            </p>
          </div>
          <div className="flex gap-2 border-t border-border px-6 py-4">
            <Button variant="ghost" type="button" onClick={() => setPreAuthOpen(false)} className="flex-1">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPreAuthOpen(false);
                void start();
              }}
              className="flex-1 font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Authorize Access
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
