import type { Keys } from "./direct-asr";

// Bundled credentials for immediate demo functionality on mobile devices during hackathon
export const bundledKeys: Keys = {
  openai: process.env.EXPO_PUBLIC_ASR_OPENAI_KEY || "",
  elevenlabs: process.env.EXPO_PUBLIC_ASR_ELEVENLABS_KEY || "",
  gemini: process.env.EXPO_PUBLIC_ASR_GEMINI_KEY || "",
  deepgram: process.env.EXPO_PUBLIC_ASR_DEEPGRAM_KEY || "",
  assemblyai: process.env.EXPO_PUBLIC_ASR_ASSEMBLYAI_KEY || "",
  speechmatics: process.env.EXPO_PUBLIC_ASR_SPEECHMATICS_KEY || "",
  pyannote: process.env.EXPO_PUBLIC_ASR_PYANNOTE_KEY || "",
};

export const comparisonModel = process.env.EXPO_PUBLIC_ASR_COMPARISON_MODEL || "gpt-4o-mini";
