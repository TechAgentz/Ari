import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";
import type { MoodEntry } from "@/lib/types";

/**
 * The five moods. `color` is a CSS colour expression built from theme tokens (so it adapts to
 * light and dark), safe to use in inline `style` for icons, bars and tinted backgrounds.
 */
export const MOODS: { value: MoodEntry["mood"]; label: string; icon: LucideIcon; color: string }[] = [
  { value: 1, label: "Rough", icon: Frown, color: "var(--accent)" },
  { value: 2, label: "Low", icon: Annoyed, color: "color-mix(in oklab, var(--accent) 50%, var(--primary))" },
  { value: 3, label: "Okay", icon: Meh, color: "var(--primary)" },
  { value: 4, label: "Good", icon: Smile, color: "var(--success)" },
  { value: 5, label: "Great", icon: Laugh, color: "var(--warm)" },
];

export const MOOD_TAGS = ["Work", "Study", "Family", "Friends", "Relationship", "Sleep", "Health", "Exercise", "Nature", "Money", "Rest", "Creativity"];

export function moodMeta(value: number) {
  return MOODS.find((m) => m.value === value) ?? MOODS[2];
}

/** A soft background tint of a mood colour, for selected states and icon circles. */
export function moodTint(color: string, amount = 18) {
  return `color-mix(in oklab, ${color} ${amount}%, var(--surface))`;
}
