import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DemoApp } from "../src/screens/DemoApp";
export default function Demo() {
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1 }}><DemoApp onLive={() => router.replace("/")} /></SafeAreaView>;
}
