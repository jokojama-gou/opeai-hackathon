import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const palettes = {
  blue: { accent: '#2857B8', soft: '#EEF3FF', name: '案A · インクブルー' },
  green: { accent: '#216756', soft: '#EAF4EF', name: '案B · フォレスト' },
};
export const StudyTheme = createContext(palettes.blue);
export function Copy({ children, small = false, muted = false }: { children: ReactNode; small?: boolean; muted?: boolean }) {
  return <Text style={[small ? ui.small : ui.copy, muted && { color: '#626B73' }]}>{children}</Text>;
}
export function Heading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={ui.heading}>{children}</Text>;
}
export function Button({ children, onPress, primary = false, disabled = false, label, selected }: {
  children: ReactNode; onPress: () => void; primary?: boolean; disabled?: boolean; label?: string; selected?: boolean;
}) {
  const theme = useContext(StudyTheme);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, { borderColor: primary ? theme.accent : '#DCE1E5', backgroundColor: primary ? theme.accent : selected ? theme.soft : '#FFFFFF' }, disabled && ui.disabled, pressed && { opacity: 0.72 }]}>
    <Text style={[ui.buttonText, { color: primary ? '#FFFFFF' : theme.accent }]}>{children}</Text>
  </Pressable>;
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' | 'positive' }) {
  return <View style={[ui.badge, { backgroundColor: tone === 'warning' ? '#FFF3CD' : tone === 'positive' ? '#E9F3EB' : '#EFF1F3' }]}>
    <Text style={[ui.small, { color: tone === 'warning' ? '#775300' : tone === 'positive' ? '#295C36' : '#52606C', fontWeight: '600' }]}>{children}</Text>
  </View>;
}
export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return <View accessibilityLiveRegion="polite" style={ui.notice}><Text style={ui.noticeTitle}>{title}</Text>{children && <Copy>{children}</Copy>}</View>;
}
export const ui = StyleSheet.create({
  copy: { fontSize: 16, lineHeight: 26, color: '#202C36' },
  small: { fontSize: 13, lineHeight: 21, color: '#56626C' },
  heading: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: '#1C2934' },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 15, lineHeight: 23, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.55 },
  badge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  notice: { backgroundColor: '#FFF8E3', borderWidth: 1, borderColor: '#E9DCA7', padding: 18, borderRadius: 16, gap: 8 },
  noticeTitle: { color: '#725400', fontSize: 18, lineHeight: 28, fontWeight: '700' },
});
