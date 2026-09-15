import {
  ApiClient,
  ApiError,
  type ProcessingPolicy,
  type Recording,
} from "@hackathon/api";
import * as Crypto from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import {
  audioFile,
  writeLocal,
  type LocalRecording,
} from "../platform/audio/storage";
export async function processRecording(
  api: ApiClient,
  baseUrl: string,
  token: () => Promise<string | null>,
  local: LocalRecording,
  policy: ProcessingPolicy,
  onStage: (stage: string) => void,
): Promise<string | null> {
  if (
    !local.checksum ||
    !local.stopped_at ||
    !["saved", "interrupted"].includes(local.capture_status)
  )
    throw new Error("保存済みの録音を選んでください");
  if (!policy.destinations.pc_audio_transfer || !policy.transcription_configured)
    throw new Error("処理サービスが設定されていません");
  const operationKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(["processing-v2", local.processing_key, policy]),
  );
  if (local.operation?.key !== operationKey) {
    local.operation = { key: operationKey };
    writeLocal(local);
  }
  const operation = local.operation;
  if (!local.remote_id) {
    onStage("録音の情報を登録中");
    const record = await api.request<{ id: string; version: number }>(
      "/v1/recordings",
      "POST",
      {
        request_key: local.id + ":create",
        expected_version: 0,
        installation_id: "installation-" + local.owner_id,
        mode: "normal",
        duration_ms: local.duration_ms,
        stopped_at: local.stopped_at,
        capture_status: local.capture_status,
        checksum: local.checksum,
        size: local.size,
      },
    );
    local.remote_id = record.id;
    local.remote_version = record.version;
    writeLocal(local);
  }
  const rid = encodeURIComponent(local.remote_id);
  let remote = await api.request<Recording>(`/v1/recordings/${rid}`);
  if (remote.upload_status === "local") {
    onStage("送信の受付を確認中");
    const ticket = await api.request<{ ticket: string; expires_at: string }>(
      `/v1/recordings/${rid}/uploads`,
      "POST",
      {
        request_key:
          operationKey + ":upload:" + Math.floor(Date.now() / 540000),
        expected_version: remote.version,
        checksum: local.checksum,
      },
    );
    onStage("音声を送信中");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await expoFetch(
        `${baseUrl.replace(/\/$/, "")}/v1/recordings/${rid}/audio`,
        {
          method: "PUT",
          signal: controller.signal,
          headers: {
            Authorization: "Bearer " + (await token()),
            "Content-Type": "audio/mp4",
            "X-Upload-Ticket": ticket.ticket,
            "X-Audio-Checksum": local.checksum,
          },
          body: audioFile(local.uri),
        },
      );
      if (!response.ok) {
        const error = (await response.json()) as {
          code: string;
          retryable: boolean;
        };
        throw new ApiError(response.status, error.code, error.retryable);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "result_unknown");
    } finally {
      clearTimeout(timeout);
    }
    remote = await api.request<Recording>(`/v1/recordings/${rid}`);
    local.remote_version = remote.version;
    writeLocal(local);
  }
  if (!operation.job_id) {
    onStage("書き起こしを受け付け中");
    operation.transcription_version ??= remote.version;
    writeLocal(local);
    const response = await api.request<{ job_id: string }>(
      `/v1/recordings/${rid}/transcription-jobs`,
      "POST",
      {
        request_key: operationKey + ":transcription",
        expected_version: operation.transcription_version,
      },
    );
    operation.job_id = response.job_id;
    writeLocal(local);
  }
  onStage("書き起こしを処理中");
  return operation.job_id;
}
