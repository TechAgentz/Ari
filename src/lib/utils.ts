import { assessRisk } from "./safety/crisis";
import type { Conversation } from "./types";

/** Neutral title and preview for conversations that contain safety-flagged messages. */
export const SENSITIVE_TITLE = "Support conversation";
export const SENSITIVE_PREVIEW = "Preview hidden for privacy. Open the conversation to read it.";

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}${rand}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function titleFromMessage(text: string, sensitive = false): string {
  if (sensitive) return SENSITIVE_TITLE;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New conversation";
  return clean.length > 48 ? `${clean.slice(0, 45).trimEnd()}…` : clean;
}

export function greetingForHour(h = new Date().getHours()): string {
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Current timestamp (kept in a helper so UI event handlers stay free of impure calls). */
export function now(): number {
  return Date.now();
}

/** True when a conversation contains safety-flagged messages (crisis or distress). */
export function isSensitiveConversation(c: Pick<Conversation, "messages">): boolean {
  return c.messages.some(
    (m) => m.meta?.safety === "crisis" || m.meta?.safety === "distress" || (m.role === "user" && assessRisk(m.content).level !== "none"),
  );
}

/**
 * Title and preview for overview screens (History, Dashboard). Conversations with
 * safety-flagged content never show their message text there.
 */
export function conversationSummary(c: Pick<Conversation, "title" | "messages">): { title: string; preview: string; sensitive: boolean } {
  const sensitive = isSensitiveConversation(c);
  const firstUser = c.messages.find((m) => m.role === "user");
  const lastUser = [...c.messages].reverse().find((m) => m.role === "user") ?? c.messages[c.messages.length - 1];
  // Titles come from the first message; re-check them so titles saved before a pattern update stay neutral too.
  const neutralTitle = sensitive && (assessRisk(c.title).level !== "none" || (!!firstUser && assessRisk(firstUser.content).level !== "none"));
  return {
    sensitive,
    title: neutralTitle ? SENSITIVE_TITLE : c.title,
    preview: sensitive ? SENSITIVE_PREVIEW : (lastUser?.content ?? ""),
  };
}
