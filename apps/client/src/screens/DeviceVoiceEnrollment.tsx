import { useCallback, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { deviceMembers, memberForPlatform, type DeviceMember } from "../data/voice-enrollment";
import { Button, styles } from "../ui/primitives";
import { VoiceEnrollment } from "./VoiceEnrollment";

export function DeviceVoiceEnrollment({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const nativeMember = memberForPlatform(Platform.OS);
  const [choice, setChoice] = useState<DeviceMember | null>(null);
  const [busy, setBusy] = useState(false);
  const reportBusy = useCallback((value: boolean) => { setBusy(value); onBusy(value); }, [onBusy]);
  const member = nativeMember ?? choice;
  return <ScrollView><View style={{ padding: 20, gap: 16 }}>
    {!nativeMember && <>
      <Text style={styles.heading}>この端末の名前を選ぶ</Text>
      <Text style={styles.muted}>Web版では最初に名前を選びます。ログインは不要です。</Text>
      <Button label="iPhoneのひなた" disabled={busy} secondary={member?.id !== deviceMembers.ios.id} onPress={() => setChoice(deviceMembers.ios)} />
      <Button label="Androidのごう" disabled={busy} secondary={member?.id !== deviceMembers.android.id} onPress={() => setChoice(deviceMembers.android)} />
    </>}
    {member && <VoiceEnrollment key={member.id} member={member} onBusy={reportBusy} />}
  </View></ScrollView>;
}
