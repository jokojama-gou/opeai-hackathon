import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Card, Heading, colors, styles as baseStyles } from "../ui/primitives";
import { bundledKeys } from "../data/asr-settings";
import { transcribe } from "../data/asr-providers";
import { prepareDenoisedAudio } from "../data/audio-isolation";
import {
  audioDigest,
  getAudio,
  isolationStore,
  providerFetch,
  useDirectCapture,
  type LocalRecording,
} from "../platform/audio/direct-device";

type Mode = "batch" | "diarize" | "live" | "denoise";

type SpeakerBlock = {
  speaker: string;
  text: string;
};

export function AudioDemoScreen({
  onBack,
  onGoToDirect,
}: {
  onBack?: () => void;
  onGoToDirect?: () => void;
}) {
  const [activeMode, setActiveMode] = useState<Mode>("batch");
  const [resultText, setResultText] = useState<string | null>(null);
  const [speakerBlocks, setSpeakerBlocks] = useState<SpeakerBlock[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isHallucinated, setIsHallucinated] = useState(false);

  // マイク録音
  const capture = useDirectCapture(async (recorded) => {
    await processAudio(recorded);
  });

  // モード切替
  const switchMode = (mode: Mode) => {
    if (capture.phase === "recording") {
      void capture.stop();
    }
    setActiveMode(mode);
    setResultText(null);
    setSpeakerBlocks([]);
    setIsHallucinated(false);
    setStatusMsg(null);
  };

  // 音声処理
  const processAudio = async (recording: LocalRecording) => {
    setIsProcessing(true);
    setResultText(null);
    setSpeakerBlocks([]);
    setIsHallucinated(false);

    const controller = new AbortController();

    try {
      if (activeMode === "batch") {
        setStatusMsg("AI (Whisper) が文字起こし中...");
        const audioInput = await getAudio(recording, "original");
        const key = bundledKeys.openai || bundledKeys.elevenlabs || "";
        const provider = bundledKeys.openai ? "openai" : "elevenlabs";

        const res = await transcribe(provider, audioInput, key, {
          fetch: providerFetch,
          signal: controller.signal,
          now: Date.now,
          sleep: async (ms, signal) => {
            if (signal?.aborted) return;
            await new Promise((r) => setTimeout(r, ms));
          },
          job: () => {},
        });

        const text = res.text?.trim() || "";
        const checkHallucination =
          text.includes("ご視聴ありがと") ||
          text.includes("チャンネル登録") ||
          text.includes("視聴ありがと");

        if (checkHallucination || !text) {
          setIsHallucinated(true);
          setStatusMsg(null);
        } else {
          setResultText(text);
          setStatusMsg("✨ 文字起こしが完了しました！");
        }
      } else if (activeMode === "diarize") {
        setStatusMsg("ElevenLabs Scribe で話者を特定・分離中...");
        const audioInput = await getAudio(recording, "original");
        const key = bundledKeys.elevenlabs || bundledKeys.openai || "";

        const res = await transcribe("elevenlabs", audioInput, key, {
          fetch: providerFetch,
          signal: controller.signal,
          now: Date.now,
          sleep: async (ms, signal) => {
            if (signal?.aborted) return;
            await new Promise((r) => setTimeout(r, ms));
          },
          job: () => {},
        });

        if (res.segments && res.segments.length > 0) {
          const blocks: SpeakerBlock[] = [];
          let currentSpeaker = "";
          let currentText = "";

          res.segments.forEach((seg) => {
            const spk = seg.speaker ? `話者 ${seg.speaker}` : "話者 A";
            if (spk !== currentSpeaker) {
              if (currentText.trim()) {
                blocks.push({ speaker: currentSpeaker, text: currentText.trim() });
              }
              currentSpeaker = spk;
              currentText = seg.text;
            } else {
              currentText += seg.text;
            }
          });
          if (currentText.trim()) {
            blocks.push({ speaker: currentSpeaker, text: currentText.trim() });
          }

          setSpeakerBlocks(blocks);
          setStatusMsg("✨ 話者分離が完了しました！");
        } else if (res.text && res.text.trim()) {
          setResultText(res.text.trim());
          setStatusMsg("✨ 文字起こしが完了しました！");
        } else {
          setIsHallucinated(true);
          setStatusMsg(null);
        }
      } else if (activeMode === "denoise") {
        setStatusMsg("ElevenLabs Voice Isolator でノイズ除去中...");
        const store = isolationStore(recording);
        const key = bundledKeys.elevenlabs || "";

        await prepareDenoisedAudio(store, key, {
          signal: controller.signal,
          fetch: providerFetch,
          digest: audioDigest,
          retry: true,
        });

        const denoisedInput = await store.denoised();
        const oaiKey = bundledKeys.openai || key;
        const res = await transcribe("openai", denoisedInput, oaiKey, {
          fetch: providerFetch,
          signal: controller.signal,
          now: Date.now,
          sleep: async (ms, signal) => {
            if (signal?.aborted) return;
            await new Promise((r) => setTimeout(r, ms));
          },
          job: () => {},
        });

        setResultText(res.text?.trim() || "ノイズ除去音声の生成が完了しました。");
        setStatusMsg("✨ ノイズ除去 & 文字起こし完了！");
      } else if (activeMode === "live") {
        setStatusMsg("リアルタイム音声を処理中...");
        const audioInput = await getAudio(recording, "original");
        const oaiKey = bundledKeys.openai || bundledKeys.elevenlabs || "";
        const res = await transcribe("openai", audioInput, oaiKey, {
          fetch: providerFetch,
          signal: controller.signal,
          now: Date.now,
          sleep: async (ms, signal) => {
            if (signal?.aborted) return;
            await new Promise((r) => setTimeout(r, ms));
          },
          job: () => {},
        });
        setResultText(res.text?.trim() || "");
        setStatusMsg("⚡ ライブ認識完了！");
      }
    } catch (err: any) {
      setResultText(`音声処理エラー: ${err?.message || "エラーが発生しました"}`);
      setStatusMsg(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={baseStyles.page} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 戻る</Text>
          </TouchableOpacity>
        )}
        <Heading>🎙️ Voicemark</Heading>
        <Text style={styles.subtitle}>
          ElevenLabs API キー組み込み済み ・ 実際の音声の書き起こし、話者分離、ノイズ除去を実行します
        </Text>
      </View>

      {/* モード切替タブ */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabItem, activeMode === "batch" && styles.tabActive]}
          onPress={() => switchMode("batch")}
        >
          <Text style={[styles.tabText, activeMode === "batch" && styles.tabTextActive]}>
            📝 文字起こし
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeMode === "diarize" && styles.tabActive]}
          onPress={() => switchMode("diarize")}
        >
          <Text style={[styles.tabText, activeMode === "diarize" && styles.tabTextActive]}>
            👥 話者分離
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeMode === "live" && styles.tabActive]}
          onPress={() => switchMode("live")}
        >
          <Text style={[styles.tabText, activeMode === "live" && styles.tabTextActive]}>
            ⚡ ライブ字幕
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeMode === "denoise" && styles.tabActive]}
          onPress={() => switchMode("denoise")}
        >
          <Text style={[styles.tabText, activeMode === "denoise" && styles.tabTextActive]}>
            ✨ ノイズ除去
          </Text>
        </TouchableOpacity>
      </View>

      {/* メイン録音カード */}
      <Card style={styles.mainCard}>
        <View style={styles.micCircle}>
          <Text style={styles.micIcon}>{capture.phase === "recording" ? "🎙️" : "🎤"}</Text>
        </View>

        <Text style={styles.instruction}>
          {capture.phase === "recording"
            ? "🔴 録音中... 喋り終わったら停止ボタンを押してください"
            : activeMode === "batch"
            ? "ボタンを押して喋った後、まとめて文字起こしします"
            : activeMode === "diarize"
            ? "複数人で話すと、誰の発言かを特定して書き起こします"
            : activeMode === "live"
            ? "ボタンを押して喋ると、即座に字幕が生成されます"
            : "録音した音声のノイズをElevenLabsで除去します"}
        </Text>

        <View style={styles.buttonWrapper}>
          {capture.phase === "recording" ? (
            <TouchableOpacity
              style={[styles.bigButton, styles.bigButtonDanger]}
              onPress={() => {
                void capture.stop();
              }}
            >
              <Text style={styles.bigButtonText}>⏹️ 録音を停止して解析する</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.bigButton, isProcessing && styles.bigButtonDisabled]}
              disabled={isProcessing}
              onPress={() => {
                setResultText(null);
                setSpeakerBlocks([]);
                setIsHallucinated(false);
                setStatusMsg(null);
                void capture.start("simple-mic");
              }}
            >
              <Text style={styles.bigButtonText}>
                {isProcessing ? "⏳ AIが処理中..." : "🔴 ボタンを押して喋る"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isProcessing && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.green} size="small" />
            <Text style={styles.loadingText}>{statusMsg}</Text>
          </View>
        )}
      </Card>

      {/* 結果表示領域 */}
      <Card style={styles.resultCard}>
        <View style={styles.resultTitleRow}>
          <Text style={styles.resultHeader}>💬 AI解析結果</Text>
          {onGoToDirect && (
            <TouchableOpacity onPress={onGoToDirect} style={styles.detailBtn}>
              <Text style={styles.detailBtnText}>全8モデル比較を見る →</Text>
            </TouchableOpacity>
          )}
        </View>

        {isHallucinated ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>🔇 声が入っていないか、無音でした</Text>
            <Text style={styles.warnSub}>
              マイクの近くではっきりと喋ってもう一度お試しのうえ停止してください。
            </Text>
          </View>
        ) : speakerBlocks.length > 0 ? (
          <View style={styles.speakerList}>
            {speakerBlocks.map((b, idx) => (
              <View key={idx} style={styles.speakerBubble}>
                <View style={styles.speakerBadge}>
                  <Text style={styles.speakerBadgeText}>👤 {b.speaker}</Text>
                </View>
                <Text style={styles.speakerText}>「{b.text}」</Text>
              </View>
            ))}
          </View>
        ) : resultText ? (
          <View style={styles.resultContentBox}>
            <Text style={styles.resultText}>「{resultText}」</Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              「ボタンを押して喋る」を押すと、ここにAIの解析結果が表示されます
            </Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    marginBottom: 4,
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  tabNav: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#ffffff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.green,
  },
  mainCard: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.green,
  },
  micCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pale,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  micIcon: {
    fontSize: 32,
  },
  instruction: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  buttonWrapper: {
    width: "100%",
    paddingHorizontal: 12,
  },
  bigButton: {
    backgroundColor: colors.green,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bigButtonDanger: {
    backgroundColor: "#dc2626",
  },
  bigButtonDisabled: {
    opacity: 0.6,
  },
  bigButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  loadingText: {
    fontSize: 14,
    color: colors.green,
    fontWeight: "600",
  },
  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
  },
  resultTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  detailBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#e8f0e9",
    borderRadius: 6,
  },
  detailBtnText: {
    fontSize: 12,
    color: colors.green,
    fontWeight: "700",
  },
  resultContentBox: {
    backgroundColor: "#f0fdf4",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#86efac",
  },
  resultText: {
    fontSize: 17,
    lineHeight: 26,
    color: "#0f172a",
    fontWeight: "700",
  },
  warnBox: {
    backgroundColor: "#fffbe6",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#ffe58f",
  },
  warnTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#873800",
  },
  warnSub: {
    fontSize: 13,
    color: "#873800",
    marginTop: 4,
  },
  speakerList: {
    gap: 10,
  },
  speakerBubble: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  speakerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  speakerBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1e40af",
  },
  speakerText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    lineHeight: 22,
  },
  emptyBox: {
    backgroundColor: "#f8fafc",
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
});
