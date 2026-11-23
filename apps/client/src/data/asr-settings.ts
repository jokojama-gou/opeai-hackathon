import type { Keys } from "./direct-asr";

// Configure device credentials explicitly; load from Expo env vars or bundled keys.
export const bundledKeys: Keys = {
  openai: process.env.EXPO_PUBLIC_ASR_OPENAI_KEY || "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",
  elevenlabs: process.env.EXPO_PUBLIC_ASR_ELEVENLABS_KEY || "sk_e3f3e18d8ebc915397a884afdc26f1fe8d72c5df3b5a51f3",
  gemini: process.env.EXPO_PUBLIC_ASR_GEMINI_KEY || "",
  deepgram: process.env.EXPO_PUBLIC_ASR_DEEPGRAM_KEY || "1372ccd19fb1e717ede96491b83f2a5c643e9ad6",
  assemblyai: process.env.EXPO_PUBLIC_ASR_ASSEMBLYAI_KEY || "a6d714b1091e477d80c98dfc92b14936",
  speechmatics: process.env.EXPO_PUBLIC_ASR_SPEECHMATICS_KEY || "4MtlUHYQH5iC2DuWwIpqiOCD7DC1fEWF",
  pyannote: process.env.EXPO_PUBLIC_ASR_PYANNOTE_KEY || "sk_9f09aa6e7b324d228c505bb0c43cade3",
};

export const getElevenLabsKey = (): string => {
  return (bundledKeys.elevenlabs || process.env.EXPO_PUBLIC_ASR_ELEVENLABS_KEY || "").trim();
};

export const getOpenAiKey = (): string => {
  return (bundledKeys.openai || process.env.EXPO_PUBLIC_ASR_OPENAI_KEY || "").trim();
};

export const comparisonModel = process.env.EXPO_PUBLIC_ASR_COMPARISON_MODEL || "gpt-4o-mini";

