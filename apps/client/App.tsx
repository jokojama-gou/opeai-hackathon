import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DemoApp } from "./src/screens/DemoApp";
import { LiveApp } from "./src/screens/LiveApp";
import { colors } from "./src/ui/primitives";

export default function App() {
  const [mode, setMode] = useState<"fixture" | "api">(
    __DEV__ ? "fixture" : "api",
  );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <StatusBar style="dark" />
        {mode === "fixture" ? (
          <DemoApp onLive={() => setMode("api")} />
        ) : (
          <LiveApp onDemo={() => setMode("fixture")} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
