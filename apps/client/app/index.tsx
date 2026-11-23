import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLiveWorkspace } from "../src/data/WorkspaceProvider";
import { LiveApp } from "../src/screens/LiveApp";
import { colors } from "../src/ui/primitives";
export default function Entry() {
  return <AppEntry />;
}
function AppEntry() {
  const w = useLiveWorkspace();
  if (w.ready && w.session && Platform.OS !== "web") return <Redirect href="/(tabs)/recording" />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}><LiveApp nativeNavigation={Platform.OS !== "web"} /></SafeAreaView>;
}
