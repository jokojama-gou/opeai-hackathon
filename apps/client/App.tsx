import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>HACKATHON / DEVELOPMENT</Text>
        <Text accessibilityRole="header" style={styles.title}>ひとつのコードで、スマホとWebへ。</Text>
        <Text style={styles.description}>React Native・Expo・TypeScriptの開発用スターターです。</Text>
        <Text style={styles.platform}>実行環境: {Platform.OS}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCount((value) => value + 1)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>動作確認 +1</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.count}>タップ回数: {count}</Text>
        <Text style={styles.hint}>apps/client/App.tsx を編集して開発を始められます。</Text>
      </View>
      <StatusBar style="dark" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f3f5f8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  card: { width: '100%', maxWidth: 680, padding: 28, gap: 20, backgroundColor: '#fff', borderRadius: 24 },
  eyebrow: { color: '#47617c', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#142b43', fontSize: 32, fontWeight: '700', lineHeight: 44 },
  description: { color: '#4f6073', fontSize: 16, lineHeight: 26 },
  platform: { color: '#47617c', fontSize: 14 },
  button: { backgroundColor: '#175cd3', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 14 },
  pressed: { opacity: 0.75 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  count: { color: '#142b43', fontSize: 18 },
  hint: { color: '#59697a', fontSize: 13, lineHeight: 22 },
});
