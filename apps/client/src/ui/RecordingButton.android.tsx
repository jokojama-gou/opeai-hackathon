import { Button, FilledTonalButton, Host, Text } from "@expo/ui/jetpack-compose";
import { defaultMinSize, fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { colors } from "./primitives";
import type { RecordingButtonProps } from "./RecordingButton";
export function RecordingButton({ label, onPress, disabled, busy, danger }: RecordingButtonProps) {
  const Component = danger ? Button : FilledTonalButton;
  return <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={colors.green} style={{ width: "100%" }}>
    <Component onClick={onPress} enabled={!disabled && !busy} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]} colors={{ containerColor: danger ? colors.red : colors.pale, contentColor: danger ? colors.white : colors.green }}>
      <Text style={{ fontSize: 16, fontWeight: "500" }}>{busy ? "準備しています…" : label}</Text>
    </Component>
  </Host>;
}
