import { Stack, useLocalSearchParams } from "expo-router";
import { type WorkspaceScreen } from "../data/useLiveWorkspace";
import { Platform, Pressable } from "react-native";
import { SymbolView } from "expo-symbols";
import { useLiveWorkspace } from "../data/WorkspaceProvider";
import { LiveApp } from "../screens/LiveApp";
import { colors } from "../ui/primitives";
const titles = { recording: "録音", room: "ルーム", records: "自分の記録", personal: "記録", settings: "設定", saved: "保存したもの", today: "日付から振り返る", todos: "ToDo", confirmation: "確認" };
export function WorkspaceStack({ title }: { title: "録音" | "ルーム" }) {
  const w = useLiveWorkspace();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.page }, headerTintColor: colors.ink, headerTitleStyle: { fontFamily: "NotoSansJP", fontWeight: "600" }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.page } }}>
    <Stack.Screen name="index" options={{ title, headerLargeTitle: Platform.OS === "ios" && title === "ルーム", headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="設定" onPress={() => w.setScreen("settings")} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}><SymbolView name={{ ios: "gearshape", android: "settings", web: "settings" }} tintColor={colors.ink} size={23} /></Pressable>, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="確認" onPress={() => w.setScreen("confirmation")} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}><SymbolView name={{ ios: "checklist", android: "fact_check", web: "fact_check" }} tintColor={colors.ink} size={23} /></Pressable> }} />
    <Stack.Screen name="[view]" options={{ headerBackButtonDisplayMode: "minimal" }} />
  </Stack>;
}
export function WorkspaceRoute({ rootScreen }: { rootScreen?: "recording" | "room" }) {
  const params = useLocalSearchParams<{ view?: WorkspaceScreen }>();
  const screen = rootScreen ?? params.view ?? "recording";
  return <><Stack.Screen options={{ title: titles[screen] }} /><LiveApp nativeNavigation routeScreen={screen} /></>;
}
