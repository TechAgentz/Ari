import type { Metadata } from "next";
import { VoiceScreen } from "@/components/voice/voice-screen";

export const metadata: Metadata = { title: "Voice conversation" };

export default function VoicePage() {
  return <VoiceScreen />;
}
