import * as SecureStore from "expo-secure-store";
export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  email: string;
};
const key = "hackathon.session.v1";
export async function readSession(): Promise<Session | null> {
  const text = await SecureStore.getItemAsync(key);
  return text ? JSON.parse(text) : null;
}
export async function saveSession(session: Session | null) {
  if (session)
    await SecureStore.setItemAsync(key, JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync(key);
}
