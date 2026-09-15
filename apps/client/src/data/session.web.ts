import type { Session } from "./session";
export type { Session } from "./session";
// Shared content and credentials are not persisted in the browser.
let current: Session | null = null;
export async function readSession(): Promise<Session | null> {
  return current;
}
export async function saveSession(session: Session | null) {
  current = session;
}
