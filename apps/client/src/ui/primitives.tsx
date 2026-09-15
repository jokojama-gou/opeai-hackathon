import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
export const colors = {
  ink: "#1D2B25",
  muted: "#56645F",
  green: "#255C45",
  pale: "#DCEED3",
  page: "#F8FBF8",
  line: "#D5DED6",
  red: "#B42332",
  amber: "#7A4D00",
  white: "#ffffff",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: {
    padding: Platform.OS === "android" ? 16 : 20,
    paddingBottom: 36,
    gap: 18,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  title: { fontSize: 28, lineHeight: 36, color: colors.ink, fontFamily: "NotoSansJP", fontWeight: "600" },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "NotoSansJP",
    color: colors.ink,
    fontWeight: "600",
  },
  body: { fontSize: 17, lineHeight: 28, color: colors.ink, fontFamily: "KosugiMaru" },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted, fontFamily: "KosugiMaru" },
  card: {
    backgroundColor: colors.white,
    borderRadius: Platform.OS === "android" ? 16 : 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#b9c6bd",
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 48,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.pale,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  small: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.green,
    fontWeight: "600",
  },
});
export function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: 28,
        paddingHorizontal: 18,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary
          ? colors.pale
          : danger
            ? colors.red
            : colors.green,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        flexDirection: "row",
        gap: 8,
      })}
    >
      {busy && <ActivityIndicator color={secondary ? colors.green : "white"} />}
      <Text
        style={{
          fontSize: 16,
          lineHeight: 23,
          fontWeight: "600",
          color: secondary ? colors.green : "white",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Badge({ children }: { children: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.small}>{children}</Text>
    </View>
  );
}
export function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{
        minHeight: 48,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: colors.green,
          backgroundColor: checked ? colors.green : colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 18 }}>
          {checked ? "✓" : ""}
        </Text>
      </View>
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Heading>{title}</Heading>
      <Text style={styles.muted}>{body}</Text>
    </Card>
  );
}
