import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { type ApiClient } from "@hackathon/api";
import { errorText } from "./useLiveWorkspace";

export async function derivedMutation<T>(
  api: ApiClient,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): Promise<T> {
  const request_key = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify([path, method, body]),
  );
  return api.request<T>(path, method, { ...body, request_key });
}

// The parent unmounts this hook while offline, backgrounded, or signed out.
// Discard late responses from an older request or a departed screen.
export function useDerivedSnapshot<T>(
  load: () => Promise<T>,
  dependencies: unknown[],
) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const mounted = useRef(false);
  async function refresh() {
    const id = ++sequence.current;
    try {
      const next = await load();
      if (mounted.current && id === sequence.current) {
        setValue(next);
        setError("");
      }
    } catch (e) {
      if (mounted.current && id === sequence.current) {
        setValue(null);
        setError(errorText(e));
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    setValue(null);
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      mounted.current = false;
      ++sequence.current;
      clearInterval(timer);
    };
  }, dependencies);
  useEffect(() => {
    const expiries: number[] = [];
    function collect(v: unknown) {
      if (!v || typeof v !== "object") return;
      for (const [key, child] of Object.entries(v)) {
        if (key === "expires_at" && typeof child === "string")
          expiries.push(Date.parse(child));
        else if (child && typeof child === "object") collect(child);
      }
    }
    collect(value);
    const next = Math.min(...expiries.filter(Number.isFinite));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => {
        setValue(null);
        void refresh();
      },
      Math.max(0, Math.min(next - Date.now(), 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [value]);
  return {
    value,
    error,
    refresh,
    clear: () => {
      ++sequence.current;
      setValue(null);
    },
  };
}

export function reviewDate(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
