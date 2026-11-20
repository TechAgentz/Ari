/**
 * Demo-wide configuration and feature flags.
 * This MVP runs in guest mode: no accounts, no payments, no subscriptions, no billing.
 */
export const APP = {
  name: "Haven",
  companion: "Ari",
  /** How Ari introduces itself. It is never presented as a person or a clinician. */
  role: "virtual care assistant",
  /** Who Ari works alongside (shown in introductions). Change to suit the practice. */
  careTeam: "your psychologist",
  tagline: "A calm space to talk things through",
  version: "0.1.0-demo",
} as const;

export const FEATURES = {
  guestMode: true,
  accounts: false,
  payments: false,
  subscriptions: false,
  billing: false,
} as const;

/** Conversation limits shared by client and server. */
export const LIMITS = {
  maxMessageChars: 2000,
  /** Messages sent to the AI provider per request (recent window only). */
  contextWindow: 16,
  maxConversations: 100,
} as const;

export const STAGES = [
  { id: "intro", label: "Getting to know you", short: "Hello" },
  { id: "social", label: "Your world", short: "Your world" },
  { id: "lifestyle", label: "Daily life", short: "Daily life" },
  { id: "wellbeing", label: "How you've been", short: "Wellbeing" },
  { id: "support", label: "Support", short: "Support" },
] as const;

export const DISCLAIMER =
  `${APP.companion} is a ${APP.role} working alongside ${APP.careTeam} — not a psychologist or therapist. It can't diagnose conditions and isn't for emergencies.`;
