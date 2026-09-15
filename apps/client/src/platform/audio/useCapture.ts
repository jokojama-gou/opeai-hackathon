import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Crypto from "expo-crypto";
import Constants, { ExecutionEnvironment } from "expo-constants";
import {
  backupReady,
  captureActive,
  finishLocal,
  writeLocal,
  type LocalRecording,
} from "./storage";

export function useCapture(onSaved: (recording: LocalRecording) => void) {
  const [phase, setPhase] = useState<
    | "idle"
    | "preparing"
    | "recording"
    | "stopping"
    | "saved"
    | "interrupted"
    | "save_failed"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const current = useRef<LocalRecording | null>(null);
  const alive = useRef(true);
  const finishing = useRef(false);
  const starting = useRef(false);
  const stopRequested = useRef(false);
  const finishRef = useRef<
    (interrupted: boolean, alreadyStopped?: boolean) => Promise<void>
  >(async () => {});
  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
      directory: "document",
      extension: ".m4a",
      sampleRate: 48000,
      numberOfChannels: 1,
      bitRate: 64000,
    },
    (status) => {
      if (status.hasError || status.mediaServicesDidReset)
        void finishRef.current(true, true);
      else if (status.isFinished && current.current && !finishing.current)
        void finishRef.current(
          !stopRequested.current &&
            Date.now() - Date.parse(current.current.started_at) < 299000,
          true,
        );
    },
  );
  const state = useAudioRecorderState(recorder, 250);
  const durationRef = useRef(0);
  durationRef.current = Math.max(durationRef.current, state.durationMillis);
  async function finish(interrupted: boolean, alreadyStopped = false) {
    if (!current.current || finishing.current) return;
    finishing.current = true;
    setPhase("stopping");
    try {
      const duration = Math.max(
        durationRef.current,
        recorder.currentTime * 1000,
      );
      if (!alreadyStopped) await recorder.stop();
      const uri = recorder.uri ?? current.current.uri;
      const result = await finishLocal(
        current.current,
        uri,
        duration,
        interrupted,
      );
      captureActive(result.id, false);
      current.current = null;
      setPhase(
        result.capture_status === "interrupted" ? "interrupted" : "saved",
      );
      onSaved(result);
    } catch {
      setPhase("save_failed");
      setError("録音の保存を確認できませんでした。保存を再試行してください。");
      if (current.current) {
        current.current.capture_status = "save_failed";
        try {
          writeLocal(current.current);
        } catch {}
      }
    } finally {
      finishing.current = false;
      await setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
      }).catch(() => {});
    }
  }
  finishRef.current = finish;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; void finishRef.current(true); };
  }, []);
  async function start(ownerId: string) {
    if (Platform.OS === "web") {
      setError(
        "端末録音はiOS / Androidで利用できます。Webでは画面を確認できます。",
      );
      return;
    }
    // Allow microphone recording in Expo Go for hackathon testing
    if (Platform.OS === "ios" && !backupReady()) {
      setError(
        "録音の保存先を準備できませんでした。アプリを再起動してください。",
      );
      return;
    }
    if (current.current || starting.current) return;
    starting.current = true;
    setError(null);
    setPhase("preparing");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive.current) return;
      if (!permission.granted) {
        setPhase("idle");
        setError(
          "マイクの使用が許可されていません。端末の設定から変更できます。",
        );
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        allowsBackgroundRecording: true,
        interruptionMode: "doNotMix",
      });
      await recorder.prepareToRecordAsync();
      if (!alive.current) {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
        return;
      }
      const id = Crypto.randomUUID();
      const started_at = new Date().toISOString();
      current.current = {
        id,
        owner_id: ownerId,
        uri: recorder.uri ?? "",
        started_at,
        stopped_at: null,
        duration_ms: 0,
        capture_status: "recording",
        audio_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        size: 0,
        checksum: null,
        remote_id: null,
        remote_version: null,
        processing_key: Crypto.randomUUID(),
      };
      captureActive(id, true);
      writeLocal(current.current);
      durationRef.current = 0;
      stopRequested.current = false;
      recorder.record({ forDuration: 300 });
      setPhase("recording");
    } catch {
      await recorder.stop().catch(() => {});
      await setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
      }).catch(() => {});
      if (current.current) {
        captureActive(current.current.id, false);
        current.current.capture_status = "save_failed";
        try {
          writeLocal(current.current);
        } catch {}
      }
      current.current = null;
      setPhase("idle");
      setError(
        "録音を開始できませんでした。マイクや空き容量を確認してください。",
      );
    } finally {
      starting.current = false;
    }
  }
  return {
    phase,
    error,
    durationMs: state.durationMillis,
    start,
    stop: async () => {
      stopRequested.current = true;
      await finish(false);
    },
    retrySave: () => finish(true, true),
    clearError: () => setError(null),
  };
}
