import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LiveApp } from "./src/screens/LiveApp";
import { WorkspaceProvider } from "./src/data/WorkspaceProvider";
import { colors } from "./src/ui/primitives";
import { ErrorBoundary } from "./src/ui/ErrorBoundary";
import { PwaStatus } from "./src/platform/PwaStatus";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <StatusBar style="dark" />
        <PwaStatus />
        <ErrorBoundary>
          <WorkspaceProvider>
            <LiveApp />
          </WorkspaceProvider>
        </ErrorBoundary>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
