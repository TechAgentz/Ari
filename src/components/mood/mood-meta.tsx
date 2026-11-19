import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";
import type { MoodEntry } from "@/lib/types";

export const MOODS: { value: MoodEntry["mood"]; label: string; icon: LucideIcon; color: string }[] = [
  { value: 1, label: "Rough", icon: Frown, color: "#8b7fd6" },
  { value: 2, label: "Low", icon: Annoyed, color: "#7c9fd8" },
  { value: 3, label: "Okay", icon: Meh, color: "#6fb7b0" },
  { value: 4, label: "Good", icon: Smile, color: "#4fae8b" },
  { value: 5, label: "Great", icon: Laugh, color: "#e0a458" },
];

export const MOOD_TAGS = ["Work", "Study", "Family", "Friends", "Relationship", "Sleep", "Health", "Exercise", "Nature", "Money", "Rest", "Creativity"];

export function moodMeta(value: number) {
  return MOODS.find((m) => m.value === value) ?? MOODS[2];
}
