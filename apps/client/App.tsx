import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DemoApp } from "./src/screens/DemoApp";
import { LiveApp } from "./src/screens/LiveApp";
import UiStudy from "./src/screens/UiStudy";
import { colors } from "./src/ui/primitives";

export default function App() {
  const [mode, setMode] = useState<"fixture" | "api">(__DEV__ ? "fixture" : "api");
  const [studyOpen, setStudyOpen] = useState(false);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <StatusBar style="dark" />
        {__DEV__ && studyOpen ? (
          <UiStudy onExit={() => setStudyOpen(false)} />
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
