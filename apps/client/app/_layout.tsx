import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { WorkspaceProvider } from "../src/data/WorkspaceProvider";
import { colors } from "../src/ui/primitives";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    KosugiMaru: require("../assets/fonts/KosugiMaru-Regular.ttf"),
    NotoSansJP: require("../assets/fonts/NotoSansJP-Variable.ttf"),
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.page, justifyContent: "center", alignItems: "center" }}>{error ? <Text>フォントを読み込めませんでした。アプリを開き直してください。</Text> : <ActivityIndicator color={colors.green} />}</View>;
  return <WorkspaceProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} /></WorkspaceProvider>;
}
