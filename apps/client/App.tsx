import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DemoApp } from "./src/screens/DemoApp";
import { LiveApp } from "./src/screens/LiveApp";
import UiStudy from "./src/screens/UiStudy";
import { colors } from "./src/ui/primitives";
import { PwaStatus } from "./src/platform/PwaStatus";
import { DeviceVoiceEnrollment } from "./src/screens/DeviceVoiceEnrollment";
import { DirectAsrScreen } from "./src/screens/DirectAsrScreen";

export default function App() {
  const [mode, setMode] = useState<"fixture" | "api" | "direct" | "voice">("direct");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <StatusBar style="dark" />
        <PwaStatus />
        {mode !== "direct" && <Pressable accessibilityRole="button" accessibilityLabel="直接書き起こしへ戻る" disabled={voiceBusy}
          onPress={() => { setStudyOpen(false); setMode("direct"); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 20 }}>
          <Text style={{ color: colors.green }}>録音・書き起こしへ戻る</Text>
        </Pressable>}
        {__DEV__ && studyOpen ? (
          <UiStudy onExit={() => setStudyOpen(false)} />
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
