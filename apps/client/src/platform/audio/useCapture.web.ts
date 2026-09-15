import { useState } from "react";
import type { LocalRecording } from "./storage";
export function useCapture(_onSaved: (recording: LocalRecording) => void) {
  const [error, setError] = useState<string | null>(null);
  return {
    phase: "idle" as
      | "idle"
      | "preparing"
      | "recording"
      | "stopping"
      | "saved"
      | "interrupted"
      | "save_failed",
    error,
    durationMs: 0,
    start: async (_ownerId: string) =>
      setError("端末録音はiOS / Androidで利用できます。"),
    stop: async () => {},
    retrySave: async () => {},
    clearError: () => setError(null),
  };
}
