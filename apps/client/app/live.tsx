import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLiveWorkspace } from "../src/data/WorkspaceProvider";
import { LiveApp } from "../src/screens/LiveApp";
import { colors } from "../src/ui/primitives";

export default function Live() {
  const w = useLiveWorkspace();
  if (w.ready && w.session) return <Redirect href="/(tabs)/recording" />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}><LiveApp nativeNavigation /></SafeAreaView>;
}
