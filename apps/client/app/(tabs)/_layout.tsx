import { Platform } from "react-native";
import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useLiveWorkspace } from "../../src/data/WorkspaceProvider";
import { colors } from "../../src/ui/primitives";
export default function TabLayout() {
  const w = useLiveWorkspace();
  if (w.ready && !w.session) return <Redirect href="/" />;
  return <NativeTabs tintColor={colors.green} backgroundColor={Platform.OS === "ios" ? undefined : colors.white} indicatorColor={colors.pale} minimizeBehavior="never" labelVisibilityMode="labeled">
    <NativeTabs.Trigger name="recording"><NativeTabs.Trigger.Icon sf="mic" md="mic" /><NativeTabs.Trigger.Label>録音</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="room"><NativeTabs.Trigger.Icon sf="folder" md="folder" /><NativeTabs.Trigger.Label>ルーム</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
