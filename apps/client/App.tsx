import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DemoApp } from "./src/screens/DemoApp";
import { LiveApp } from "./src/screens/LiveApp";
import UiStudy from "./src/screens/UiStudy";
import { colors } from "./src/ui/primitives";
import { ErrorBoundary } from "./src/ui/ErrorBoundary";
import { PwaStatus } from "./src/platform/PwaStatus";
import { DeviceVoiceEnrollment } from "./src/screens/DeviceVoiceEnrollment";
import { DirectAsrScreen } from "./src/screens/DirectAsrScreen";
import { AudioDemoScreen } from "./src/screens/AudioDemoScreen";

export default function App() {
  const [mode, setMode] = useState<"audiodemo" | "direct" | "fixture" | "api" | "voice">("audiodemo");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <StatusBar style="dark" />
        <PwaStatus />
        
        {/* モード切替ヘッダーナビゲーション */}
        <View style={{ flexDirection: "row", backgroundColor: colors.pale, paddingHorizontal: 12, paddingVertical: 6, gap: 8, alignItems: "center" }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode("audiodemo")}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: mode === "audiodemo" ? colors.green : "transparent" }}
          >
            <Text style={{ color: mode === "audiodemo" ? colors.white : colors.ink, fontWeight: "700", fontSize: 13 }}>
              ✨ 音声デモ
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setMode("direct")}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: mode === "direct" ? colors.green : "transparent" }}
          >
            <Text style={{ color: mode === "direct" ? colors.white : colors.ink, fontWeight: "600", fontSize: 13 }}>
              🎙️ ASR比較
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setMode("voice")}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: mode === "voice" ? colors.green : "transparent" }}
          >
            <Text style={{ color: mode === "voice" ? colors.white : colors.ink, fontWeight: "600", fontSize: 13 }}>
              👤 声の登録
            </Text>
          </Pressable>
        </View>

        <ErrorBoundary>
          {__DEV__ && studyOpen ? (
            <UiStudy onExit={() => setStudyOpen(false)} />
          ) : mode === "audiodemo" ? (
            <AudioDemoScreen onGoToDirect={() => setMode("direct")} />
          ) : mode === "direct" ? (
            <DirectAsrScreen onVoice={() => setMode("voice")} onDemo={() => setMode("fixture")} onLegacy={() => setMode("api")} />
          ) : mode === "voice" ? (
            <DeviceVoiceEnrollment onBusy={setVoiceBusy} />
          ) : mode === "fixture" ? (
            <>
              {__DEV__ && (
                <Pressable accessibilityRole="button" onPress={() => setStudyOpen(true)}
                  style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 16 }}>
                  <Text style={{ color: colors.ink }}>UI検討モックを開く（K02準備）</Text>
                </Pressable>
              )}
              <DemoApp onLive={() => setMode("api")} />
            </>
          ) : (
            <LiveApp onDemo={() => setMode("fixture")} />
          )}
        </ErrorBoundary>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
