import { createContext, useContext, type ReactNode } from "react";
import { useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import { useWorkspaceState, type WorkspaceScreen } from "./useLiveWorkspace";

const Workspace = createContext<ReturnType<typeof useWorkspaceState> | null>(null);

// The recorder and authenticated state live above both native tab stacks.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const params = useGlobalSearchParams<{ view?: WorkspaceScreen }>();
  const tab = segments.includes("room") ? "room" : "recording";
  const screen = segments.includes("[view]") ? params.view ?? tab : tab;
  const state = useWorkspaceState({
    screen,
    go(next) {
      if (next === "recording" || next === "room") router.navigate(`/(tabs)/${next}`);
      else if (next !== screen) router.push({ pathname: `/(tabs)/${tab}/[view]`, params: { view: next } });
    },
  });
  return <Workspace.Provider value={state}>{children}</Workspace.Provider>;
}

export function useLiveWorkspace() {
  const workspace = useContext(Workspace);
  if (!workspace) throw new Error("WorkspaceProvider is required");
  return workspace;
}
