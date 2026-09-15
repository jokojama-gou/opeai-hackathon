import { Redirect, useRouter } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLiveWorkspace } from "../src/data/WorkspaceProvider";
import { LiveApp } from "../src/screens/LiveApp";
import { colors } from "../src/ui/primitives";
export default function Entry() {
  return Platform.OS === "web" ? <Redirect href="/mock" /> : <NativeEntry />;
}
function NativeEntry() {
  const w = useLiveWorkspace();
  const router = useRouter();
  if (w.ready && w.session) return <Redirect href="/(tabs)/recording" />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}><LiveApp nativeNavigation onDemo={() => router.push("/demo")} /></SafeAreaView>;
}
