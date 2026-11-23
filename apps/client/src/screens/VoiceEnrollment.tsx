import { useEffect, useRef, useState } from "react";
import { AppState, Text } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { Button, Card, Heading, styles } from "../ui/primitives";
import { voiceOwner, voiceExpiresAt, type DeviceMember } from "../data/voice-enrollment";
import { useDirectCapture, loadRecordings, saveVoiceSample, deleteVoiceSample, voiceSampleUri, releaseVoiceSampleUri, type LocalRecording } from "../platform/audio/direct-device";

export function VoiceEnrollment({ member, onBusy }: { member: DeviceMember; onBusy: (value: boolean) => void }) {
  const [records, setRecords] = useState<LocalRecording[]>([]);
  const name = member.name;
  const userId = member.id;
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  const player = useAudioPlayer();
  const playbackUri = useRef<string | null>(null);
  const selected = records[0] ?? null;
  const capture = useDirectCapture(record => {
    if (alive.current) { setRecords(current => [record, ...current]); setConfirmDelete(false); }
  });
  const stopCapture = useRef(capture.stop); stopCapture.current = capture.stop;
  const capturing = ["preparing", "recording", "stopping"].includes(capture.phase);
  function stopPlayback() {
    player.pause();
    player.replace(null);
    if (playbackUri.current) releaseVoiceSampleUri(playbackUri.current);
    playbackUri.current = null;
  }
  const stopAudio = useRef(stopPlayback); stopAudio.current = stopPlayback;
  async function refresh() {
    try {
      const next = await loadRecordings(voiceOwner(userId));
      if (alive.current) {
        setRecords(next);
      }
    } catch { if (alive.current) setError("登録音声を読み込めませんでした。"); }
    finally { if (alive.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active") { stopAudio.current(); void stopCapture.current(); }
      else void refresh();
    });
    return () => {
      alive.current = false; listener.remove(); stopAudio.current();
      void stopCapture.current(); onBusy(false);
    };
  }, [userId]);
  useEffect(() => { onBusy(capturing || working); }, [capturing, working, onBusy]);
  useEffect(() => {
    if (!records.length) return;
    const remaining = Math.min(...records.map(voiceExpiresAt)) - Date.now();
    const timer = setTimeout(() => { stopAudio.current(); void refresh(); }, Math.max(0, Math.min(remaining, 2147483647)));
    return () => clearTimeout(timer);
  }, [records]);
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setWorking(true); setError("");
    try { await action(); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "操作できませんでした。"); }
    finally { lock.current = false; if (alive.current) setWorking(false); }
  }
  async function play() {
    if (!selected) return;
    stopPlayback();
    const uri = await voiceSampleUri(selected.id, userId);
    if (!alive.current || voiceExpiresAt(selected) <= Date.now()) { releaseVoiceSampleUri(uri); return; }
    playbackUri.current = uri; player.replace({ uri }); player.play();
  }
  return <>
    <Heading>自分の声を登録する</Heading>
    <Text style={styles.body}>{member.device}の「{name}」として、自分だけが話す音声をこの端末に保存します。ログインは不要です。</Text>
    <Card>
      <Text style={styles.heading}>{selected?.voice_profile ? "登録音声を保存済み" : "声の登録準備"}</Text>
      <Text style={styles.muted}>自動識別は未接続です。ElevenLabsへの登録・送信はまだ行いません。</Text>
      <Text style={styles.muted}>録音終了から最大7日。いつでも削除できます。通常の会話録音や書き起こし比較には使いません。</Text>
    </Card>
    {loading ? <Text style={styles.body}>保存した声を確認しています。</Text> : <Card>
      <Text style={styles.heading}>{member.device}：{name}</Text>
      {!selected && <>
        <Text style={styles.body}>静かな場所で、一人で自然に話してください。目安は15〜30秒です。これは登録準備の案内で、ElevenLabsの必要条件を確認したものではありません。</Text>
        <Text style={styles.muted}>読み上げ例：「こんにちは。これは私の声を登録するための録音です。今日は仲間とアプリを作っています。会話の中で話したことを、あとから分かりやすく振り返りたいです。」</Text>
        <Text accessibilityLiveRegion="polite" style={styles.title}>{Math.floor(capture.durationMs / 1000)}秒</Text>
        {capture.phase === "recording"
          ? <Button label="録音を停止して確認" onPress={() => { void capture.stop(); }} />
          : <Button label={capturing ? "録音を準備・保存中" : "自分の声を録音する"} disabled={working || capturing || !name.trim() || capture.phase === "save_failed"} onPress={() => { stopPlayback(); void capture.start(voiceOwner(userId)); }} />}
        {capture.phase === "save_failed" && <Button label="録音の保存を再試行" onPress={() => { void capture.retrySave(); }} />}
      </>}
      {selected && <>
        <Text style={styles.body}>{Math.round(selected.duration_ms / 1000)}秒の音声</Text>
        <Text style={styles.muted}>保存期限：{new Date(voiceExpiresAt(selected)).toLocaleString("ja-JP")}</Text>
        {selected.capture_status !== "saved" && <Text accessibilityRole="alert" style={styles.body}>録音が中断されています。削除して録り直してください。</Text>}
        <Button label="自分の声を聞き直す" secondary disabled={working || capturing} onPress={() => { void perform(play); }} />
        <Button label="再生を停止" secondary onPress={stopPlayback} />
        <Button label={selected.voice_profile ? "登録音声を保存済み" : "この声を登録用に保存する"} disabled={!!selected.voice_profile || working || capturing || !name.trim() || selected.capture_status !== "saved"} onPress={() => { void perform(async () => {
          await saveVoiceSample(selected.id, userId, name); await refresh();
        }); }} />
        <Button label={confirmDelete ? "登録音声と表示名を削除する" : "削除して録り直す"} danger disabled={working || capturing} onPress={() => {
          if (!confirmDelete) { stopPlayback(); setConfirmDelete(true); return; }
          void perform(async () => {
            stopPlayback();
            for (const record of records) await deleteVoiceSample(record.id, userId);
            if (alive.current) { setConfirmDelete(false); }
            await refresh();
          });
        }} />
        {confirmDelete && <Button label="削除をやめる" secondary onPress={() => setConfirmDelete(false)} />}
      </>}
    </Card>}
    {(error || capture.error) && <Text accessibilityRole="alert" style={styles.body}>{error || capture.error}</Text>}
    <Text style={styles.muted}>端末に付けた名前です。本人確認や会話の話者識別はまだ行いません。端末を操作できる人は、この登録音声を確認・削除できます。</Text>
  </>;
}
