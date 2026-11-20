"use client";

import { useSyncExternalStore } from "react";
import { LIMITS } from "./config";
import { CONVERSATIONS_KEY, MOODS_KEY, SETTINGS_KEY } from "./storage-keys";
import type { Conversation, MoodEntry, Settings } from "./types";

/**
 * Tiny localStorage-backed stores. Everything stays in this browser:
 * there are no accounts and nothing is stored on a server.
 */
function createStore<T>(key: string, fallback: T, migrate: (raw: unknown) => T = (r) => r as T) {
  let cacheRaw: string | null | undefined;
  let cache: T = fallback;
  /** Set when storage is unavailable (full / blocked): keep changes in memory for this session. */
  let memoryOnly = false;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (typeof window === "undefined") return fallback;
    if (memoryOnly) return cache;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return cache;
    }
    if (raw === cacheRaw) return cache;
    cacheRaw = raw;
    if (raw === null) {
      cache = fallback;
      return cache;
    }
    try {
      cache = migrate(JSON.parse(raw));
    } catch {
      cache = fallback;
    }
    return cache;
  };

  const emit = () => listeners.forEach((l) => l());

  const write = (next: T) => {
    cache = next;
    try {
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      cacheRaw = raw;
      memoryOnly = false;
    } catch {
      memoryOnly = true;
    }
    emit();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    read,
    write,
    update: (fn: (prev: T) => T) => write(fn(read())),
    clear: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      cacheRaw = null;
      cache = fallback;
      memoryOnly = false;
      emit();
    },
    subscribe,
    useValue: () => useSyncExternalStore(subscribe, read, () => fallback),
  };
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  theme: "light",
  aiMode: "auto",
  consent: { ai: false, voice: false, context: false },
  voice: { output: true, engine: "browser", recognition: "auto", rate: 1, checkIns: true, checkInSeconds: 8 },
};

export { SETTINGS_KEY };

export const settingsStore = createStore<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS, (raw) => {
  const r = (raw ?? {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    consent: { ...DEFAULT_SETTINGS.consent, ...(r.consent ?? {}) },
    voice: { ...DEFAULT_SETTINGS.voice, ...(r.voice ?? {}) },
  };
});

const EMPTY_CONVERSATIONS: Conversation[] = [];
const EMPTY_MOODS: MoodEntry[] = [];

export const conversationsStore = createStore<Conversation[]>(CONVERSATIONS_KEY, EMPTY_CONVERSATIONS, (raw) =>
  Array.isArray(raw) ? (raw as Conversation[]).filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)) : EMPTY_CONVERSATIONS,
);

export const moodStore = createStore<MoodEntry[]>(MOODS_KEY, EMPTY_MOODS, (raw) =>
  Array.isArray(raw) ? (raw as MoodEntry[]).filter((m) => m && typeof m.id === "string") : EMPTY_MOODS,
);

export function upsertConversation(conv: Conversation) {
  conversationsStore.update((list) => {
    const others = list.filter((c) => c.id !== conv.id);
    return [conv, ...others].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LIMITS.maxConversations);
  });
}

export function deleteConversation(id: string) {
  conversationsStore.update((list) => list.filter((c) => c.id !== id));
}

export function getConversation(id: string): Conversation | undefined {
  return conversationsStore.read().find((c) => c.id === id);
}

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Settings)) {
  settingsStore.update((s) => (typeof patch === "function" ? patch(s) : { ...s, ...patch }));
}

/** Renders `true` only after hydration, to avoid flashing client-only UI. */
const noopSubscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// ───────────── One-time chat draft hand-over ─────────────
// Pre-fills the next chat composer without putting the text in the URL, where it
// would stay in browser history. Kept for this tab only (sessionStorage, or memory).
const CHAT_DRAFT_KEY = "haven.chat-draft.v1";
let memoryDraft: string | null = null;

/** `/chat?new=<marker>` opens a new chat that picks up the pending draft. */
export const CHAT_DRAFT_MARKER = "draft";

export function setChatDraft(text: string) {
  memoryDraft = text;
  try {
    window.sessionStorage.setItem(CHAT_DRAFT_KEY, text);
  } catch {
    /* memory only */
  }
}

/** The pending draft, if any. Read it once, then call clearChatDraft(). */
export function peekChatDraft(): string | null {
  try {
    return window.sessionStorage.getItem(CHAT_DRAFT_KEY) ?? memoryDraft;
  } catch {
    return memoryDraft;
  }
}

export function clearChatDraft() {
  memoryDraft = null;
  try {
    window.sessionStorage.removeItem(CHAT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAllData() {
  conversationsStore.clear();
  moodStore.clear();
  settingsStore.clear();
  clearChatDraft();
}
