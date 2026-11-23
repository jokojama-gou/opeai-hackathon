import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalRecording } from "./storage";
import { webAudioStore } from "./storage.web";

export function useCapture(onSaved: (recording: LocalRecording) => void) {
  const [phase, setPhase] = useState<
    "idle" | "preparing" | "recording" | "stopping" | "saved" | "interrupted" | "save_failed"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = useCallback(async (ownerId: string) => {
    try {
      setPhase("preparing");
      setError(null);
      setDurationMs(0);

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("お使いのブラウザはマイク録音に対応していません。HTTPS接続であるかご確認ください。");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = "";
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/aac")) {
          mimeType = "audio/aac";
        }
        if (mimeType) {
          options = { mimeType };
        }
      }

      const mr = new MediaRecorder(stream, options);
      const actualMime = mr.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const blob = new Blob(chunksRef.current, { type: actualMime });
        const now = new Date();
        const id = `web-${Date.now()}`;
        const recording: LocalRecording = {
          id,
          owner_id: ownerId,
          uri: `web-blob:${id}`,
          started_at: new Date(startTimeRef.current).toISOString(),
          stopped_at: now.toISOString(),
          duration_ms: Math.max(500, Math.round(Date.now() - startTimeRef.current)),
          capture_status: "saved",
          audio_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          size: blob.size,
          checksum: id,
          remote_id: null,
          remote_version: null,
          processing_key: id,
        };
        webAudioStore.set(id, blob);
        setPhase("saved");
        setDurationMs(recording.duration_ms);
        onSaved(recording);
      };
      mediaRef.current = mr;
      mr.start(500);
      startTimeRef.current = Date.now();
      setPhase("recording");
      timerRef.current = setInterval(() => setDurationMs(Date.now() - startTimeRef.current), 300);
    } catch (e: any) {
      console.error("Web microphone error:", e);
      setPhase("idle");
      const msg = e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError"
        ? "マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。"
        : e instanceof Error ? e.message : "マイクへのアクセスに失敗しました";
      setError(msg);
    }
  }, [onSaved]);

  const stop = useCallback(async () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      setPhase("stopping");
      mediaRef.current.stop();
    }
  }, []);

  return {
    phase,
    error,
    durationMs,
    start,
    stop,
    retrySave: async () => {},
    clearError: () => setError(null),
  };
}
