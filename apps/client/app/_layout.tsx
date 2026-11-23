import { Stack, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { WorkspaceProvider } from "../src/data/WorkspaceProvider";
import { colors } from "../src/ui/primitives";

export default function RootLayout() {
  const segments = useSegments() as string[];
  const mockOnly = segments[0] === "mock" || segments[0] === "demo";
  const [loaded, error] = useFonts({
    KosugiMaru: require("../assets/fonts/KosugiMaru-Regular.ttf"),
    NotoSansJP: require("../assets/fonts/NotoSansJP-Variable.ttf"),
  });
  // フォント読込エラー時やWeb環境ではフォールバックして画面をブロックしない
  if (!loaded && !error && Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  const screens = <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} /></>;
  return mockOnly ? screens : <WorkspaceProvider>{screens}</WorkspaceProvider>;
}
