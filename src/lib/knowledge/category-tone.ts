import type { KnowledgeCategory } from "./base";

const CATEGORY_TONE: Record<KnowledgeCategory, string> = {
  "Stress & Anxiety": "bg-primary-soft text-primary",
  "Mood & Emotions": "bg-accent-soft text-accent",
  "Sleep & Energy": "bg-[color-mix(in_oklab,var(--accent)_12%,var(--surface))] text-accent",
  Relationships: "bg-warm-soft text-warm",
  "Thinking Patterns": "bg-surface-3 text-fg",
  "Skills & Practices": "bg-success-soft text-success",
  "Getting Support": "bg-danger-soft text-danger",
};

export function categoryTone(c: KnowledgeCategory): string {
  return CATEGORY_TONE[c];
}
