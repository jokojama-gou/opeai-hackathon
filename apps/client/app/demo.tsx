import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DemoApp } from "../src/screens/DemoApp";
import { Button } from "../src/ui/primitives";
export default function Demo() {
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1 }}><Button label="文字起こしモックへ戻る" secondary onPress={() => router.replace("/mock")} /><DemoApp onLive={() => router.replace("/live")} /></SafeAreaView>;
}
