import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "stopped" | "denied" | "unsupported" | "error";

export function isRecordingSupported() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickMime() {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return c.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

/** Microphone recorder. `onStarted` fires the instant MediaRecorder begins, so playback can start in sync. */
export function useMicRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (onStarted: () => void) => {
    if (!isRecordingSupported()) return setStatus("unsupported");
    setError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        setBlob(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        setStatus("stopped");
        releaseMic();
      };
      rec.onstart = () => {
        setStatus("recording");
        onStarted();
      };
      recRef.current = rec;
      setBlob(null);
      rec.start(250);
    } catch (e) {
      releaseMic();
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
      else {
        setStatus("error");
        setError(name === "NotFoundError" ? "No microphone found." : (e as Error).message);
      }
    }
  }, [releaseMic]);

  const stop = useCallback(() => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    else releaseMic();
  }, [releaseMic]);

  const reset = useCallback(() => {
    setBlob(null);
    setStatus("idle");
  }, []);

  useEffect(() => () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    releaseMic();
  }, [releaseMic]);

  return { status, blob, error, start, stop, reset };
}
