import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockTranscriptionScreen } from "../src/screens/MockTranscriptionScreen";
import { colors } from "../src/ui/primitives";

export default function Mock() {
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}><MockTranscriptionScreen onExamples={() => router.push("/demo")} /></SafeAreaView>;
}
