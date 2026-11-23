import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "../ui/primitives";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(
    matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [help, setHelp] = useState(false);
  const [update, setUpdate] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const done = () => { setInstalled(true); setInstall(null); setHelp(false); };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", done);
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const checkUpdate = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setUpdate(true);
    };
    const found = () => registration?.installing?.addEventListener("statechange", checkUpdate);
    if (!__DEV__ && "serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((value) => {
        if (disposed) return;
        registration = value;
        checkUpdate();
        registration.addEventListener("updatefound", found);
      }).catch(() => { if (!disposed) setFailed(true); });
    }
    return () => {
      disposed = true;
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", done);
      registration?.removeEventListener("updatefound", found);
    };
  }, []);

  const add = async () => {
    if (!install) { setHelp(value => !value); return; }
    try {
      await install.prompt();
      const choice = await install.userChoice;
      if (choice.outcome === "accepted") setHelp(false);
    } catch { setHelp(true); }
    finally { setInstall(null); }
  };
  if (online && installed && !update && !failed) return null;
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 6, gap: 4, backgroundColor: colors.pale }}>
      {!online && <Text accessibilityRole="alert" style={{ color: colors.ink, fontSize: 14 }}>
        オフラインです。共有記録の取得・ログインには接続が必要です。
      </Text>}
      {!installed && <Pressable accessibilityRole="button" onPress={() => void add()}
        style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: colors.green, fontSize: 14, fontWeight: "600" }}>
          {install ? "ホーム画面に追加" : "ホーム画面に追加するには"}
        </Text>
      </Pressable>}
      {help && <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 22 }}>
        iPhoneはSafariの共有メニューから「ホーム画面に追加」。Androidはブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。
      </Text>}
      {update && <Text accessibilityLiveRegion="polite" style={{ color: colors.ink, fontSize: 14 }}>
        新しい版があります。入力内容を保存し、このアプリのタブとウィンドウをすべて閉じて開き直してください。
      </Text>}
      {failed && <Text accessibilityLiveRegion="polite" style={{ color: colors.ink, fontSize: 14 }}>
        オフライン起動の準備ができませんでした。接続中はそのまま利用できます。
      </Text>}
    </View>
  );
}
