"use client";

import { AudioLines, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CrisisCard } from "@/components/crisis-card";
import { ProviderBadge } from "@/components/provider-badge";
import { StageJourney } from "@/components/stage-journey";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { streamReply, usesRemoteAI } from "@/lib/agent/client";
import { openingMessage } from "@/lib/agent/demo-engine";
import { inferTopic } from "@/lib/agent/extract";
import { analyzeConversation } from "@/lib/agent/state";
import { getEntry, type KnowledgeEntry } from "@/lib/knowledge/base";
import { assessRisk } from "@/lib/safety/crisis";
import { APP, LIMITS } from "@/lib/config";
import {
  CHAT_DRAFT_MARKER,
  clearChatDraft,
  conversationsStore,
  deleteConversation,
  getConversation,
  peekChatDraft,
  settingsStore,
  upsertConversation,
  useHydrated,
} from "@/lib/storage";
import type { ChatMessage, Conversation, MessageMeta, TopicId } from "@/lib/types";
import { useServerConfig } from "@/lib/use-server-config";
import { now, titleFromMessage, uid } from "@/lib/utils";
import { Composer } from "./composer";
import { MessageBubble, TypingIndicator } from "./message-bubble";

export function ChatScreen() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const idParam = params.get("id");
  const fresh = params.get("new") ?? "";
  // ?practice=<library slug> opens a new conversation that offers that technique.
  const practice = idParam ? null : params.get("practice");
  // Which conversation is mounted. When this session saves a new conversation we
  // update the URL to ?id=… ourselves ("owned"), which must not remount it.
  const [s, setS] = useState({ id: idParam, fresh, practice, n: 0, owned: null as string | null, key: idParam ?? `new:${fresh}:${practice ?? ""}:0` });
  if (s.id !== idParam || s.fresh !== fresh || s.practice !== practice) {
    const keep = idParam !== null && idParam === s.owned;
    const n = s.n + 1;
    setS({ id: idParam, fresh, practice, n, owned: keep ? s.owned : null, key: keep ? s.key : (idParam ?? `new:${fresh}:${practice ?? ""}:${n}`) });
  }

  if (!hydrated) return <div className="h-app lg:h-dvh" aria-busy="true" />;
  return (
    <ChatSession
      key={s.key}
      id={idParam}
      prompt={params.get("prompt")}
      practice={practice}
      draft={fresh === CHAT_DRAFT_MARKER}
      onPersisted={(id) => {
        setS((prev) => ({ ...prev, owned: id }));
        window.history.replaceState(null, "", `/chat?id=${id}`);
      }}
    />
  );
}

const NEW_TITLE = "New conversation";
/** Quick reply to an offered technique; also pre-filled when opened from "Practise with Ari". */
const ACCEPT_OFFER = "Yes, let's try it";

/** The library entry to practise, if `slug` names one with a technique. */
export function practiceEntry(slug: string | null): KnowledgeEntry | undefined {
  const entry = slug ? getEntry(slug) : undefined;
  return entry?.technique ? entry : undefined;
}

/** Opening for "Practise with Ari": offers exactly that technique, so a "yes" walks through it. */
function practiceOpening(entry: KnowledgeEntry): { text: string; meta: MessageMeta } {
  const t = entry.technique!;
  const duration = t.duration.charAt(0).toLowerCase() + t.duration.slice(1);
  return {
    text: `Hi, I'm ${APP.companion}, your ${APP.role}. I'd be glad to guide you through **${t.name}** (${duration}) from the library. Shall I walk you through it now?`,
    meta: { provider: "demo", stage: "support", topic: "technique", techniqueOffered: entry.slug, sources: [{ slug: entry.slug, title: entry.title }] },
  };
}

export function newConversation(practice?: KnowledgeEntry): Conversation {
  const opening = practice ? practiceOpening(practice) : openingMessage("chat");
  const created = Date.now();
  return {
    id: uid("c_"),
    mode: "chat",
    title: practice ? `Practice: ${practice.technique!.name}` : NEW_TITLE,
    createdAt: created,
    updatedAt: created,
    messages: [{ id: uid("m_"), role: "assistant", content: opening.text, createdAt: created, meta: opening.meta }],
  };
}

/** A stopped reply keeps only what the user actually saw: no unseen question, offer or technique. */
export function interruptedMeta(meta: MessageMeta, shown: string): MessageMeta {
  const steps = meta.techniqueGiven ? getEntry(meta.techniqueGiven)?.technique?.steps : undefined;
  const sawTechnique = !!steps?.length && shown.includes(steps[steps.length - 1]);
  return {
    ...meta,
    interrupted: true,
    topic: undefined,
    questionId: undefined,
    techniqueOffered: undefined,
    techniqueGiven: sawTechnique ? meta.techniqueGiven : undefined,
  };
}

const PERSONAL_TOPICS: TopicId[] = ["name", "household", "household_size", "together", "support_network"];

function ChatSession({
  id,
  prompt,
  practice,
  draft,
  onPersisted,
}: {
  id: string | null;
  prompt: string | null;
  practice: string | null;
  /** Pick up the one-time draft handed over by another screen (e.g. the mood check-in). */
  draft: boolean;
  onPersisted: (id: string) => void;
}) {
  const router = useRouter();
  const settings = settingsStore.useValue();
  const stored = conversationsStore.useValue();
  const { config, loading } = useServerConfig();
  const [conv, setConv] = useState<Conversation>(() => (id && getConversation(id)) || newConversation(practiceEntry(practice)));
  const [persisted, setPersisted] = useState(() => !!(id && getConversation(id)));
  const [input, setInput] = useState(() => prompt ?? (draft ? peekChatDraft() : null) ?? (!id && practiceEntry(practice) ? ACCEPT_OFFER : ""));
  const [streaming, setStreaming] = useState<{ text: string; meta: MessageMeta | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const convRef = useRef(conv);
  const abortRef = useRef<AbortController | null>(null);
  /** Set when this conversation is deleted here, so a reply still arriving can't save it again. */
  const deletedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const busy = streaming !== null;
  const messages = conv.messages;
  const analysis = useMemo(() => analyzeConversation(messages), [messages]);
  const showCrisis = messages.some((m) => m.meta?.safety === "crisis" || m.meta?.safety === "distress") || streaming?.meta?.safety === "crisis";
  const remote = usesRemoteAI(settings, config);
  // Deleted from this browser (another tab, or just now here): show that instead of writing it back.
  const gone = persisted && !stored.some((c) => c.id === conv.id);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The draft is handed over once; drop it so it can't reappear in a later chat.
  useEffect(() => {
    if (draft) clearChatDraft();
  }, [draft]);

  useEffect(() => {
    if (gone) abortRef.current?.abort();
  }, [gone]);

  // Keep the newest message in view unless the user has scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, streaming?.text]);

  const commit = (next: Conversation) => {
    convRef.current = next;
    setConv(next);
    upsertConversation(next);
  };

  const send = async (raw: string, via: "text" | "voice" = "text") => {
    const text = raw.trim().slice(0, LIMITS.maxMessageChars);
    // Wait for the server config, so the reply comes from the provider the user chose.
    if (!text || abortRef.current || loading || deletedRef.current) return;
    const base = convRef.current;
    if (persisted && !getConversation(base.id)) return; // deleted elsewhere
    const isFirst = !base.messages.some((m) => m.role === "user");
    const risky = isFirst && assessRisk(text).level !== "none";
    const userMsg: ChatMessage = { id: uid("m_"), role: "user", content: text, createdAt: now(), meta: { via } };
    const withUser: Conversation = {
      ...base,
      messages: [...base.messages, userMsg],
      updatedAt: now(),
      // A preset title (e.g. a practice session) is kept unless the first message needs a neutral one.
      title: isFirst && (risky || base.title === NEW_TITLE) ? titleFromMessage(text, risky) : base.title,
    };
    commit(withUser);
    if (!persisted) {
      setPersisted(true);
      onPersisted(withUser.id);
    }
    setInput("");
    stickToBottom.current = true;
    setStreaming({ text: "", meta: null });

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    const result = await streamReply({
      messages: withUser.messages,
      mode: "chat",
      settings: settingsStore.read(),
      config,
      signal: ac.signal,
      onMeta: (meta) => setStreaming((s) => ({ text: s?.text ?? "", meta })),
      onDelta: (d) => {
        acc += d;
        setStreaming((s) => ({ text: acc, meta: s?.meta ?? null }));
      },
    });
    const aborted = ac.signal.aborted;
    abortRef.current = null;
    setStreaming(null);
    // Deleted while Ari was replying (here or in another tab): never write it back.
    if (deletedRef.current || !getConversation(withUser.id)) return;
    const finalText = (aborted ? acc : result.text).trim();
    if (!finalText) return;
    const assistant: ChatMessage = {
      id: uid("m_"),
      role: "assistant",
      content: aborted ? `${finalText}…` : finalText,
      createdAt: now(),
      meta: aborted ? interruptedMeta(result.meta, finalText) : result.meta,
    };
    const latest = convRef.current;
    commit({ ...latest, messages: [...latest.messages, assistant], updatedAt: now() });
  };

  const stop = () => abortRef.current?.abort();

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastTopic = lastAssistant ? lastAssistant.meta?.topic ?? inferTopic(lastAssistant.content) : undefined;
  const support = analysis.stage === "support";
  const afterSafety = lastAssistant?.meta?.safety === "crisis" || lastAssistant?.meta?.safety === "distress";
  const chips = afterSafety ? [] : [
    lastTopic && PERSONAL_TOPICS.includes(lastTopic) ? "I'd rather not say" : null,
    lastAssistant?.meta?.techniqueOffered ? ACCEPT_OFFER : null,
    lastAssistant?.meta?.techniqueOffered ? "Maybe later" : null,
    lastAssistant?.meta?.techniqueGiven ? "I'll give it a try" : null,
    !support ? "Can we talk about something on my mind?" : null,
    !support ? "I've been feeling stressed lately" : null,
    support && !lastAssistant?.meta?.techniqueGiven ? "Could you suggest a quick calming exercise?" : null,
    support ? "I'd just like to vent for a bit" : null,
  ]
    .filter((c): c is string => Boolean(c))
    .slice(0, 3);

  return (
    <div className="flex h-app flex-col lg:h-dvh">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-bg/70 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-lg font-semibold sm:text-xl">{persisted ? conv.title : `Talk with ${APP.companion}`}</h1>
          <StageJourney stage={analysis.stage} className="mt-1" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden sm:inline-flex">
            <ProviderBadge />
          </span>
          <Link
            href="/voice"
            aria-label="Switch to voice conversation"
            title="Voice conversation"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <AudioLines className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={() => router.push(`/chat?new=${now()}`)}
            aria-label="New conversation"
            title="New conversation"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Plus className="h-5 w-5" />
          </button>
          {persisted && !gone && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete this conversation"
              title="Delete conversation"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="scrollbar-thin flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6" aria-live="polite" aria-relevant="additions">
          <p className="mx-auto flex max-w-md items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-center text-xs text-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            {remote ? "Saved only in this browser. Contact details are removed before messages reach Groq." : "Saved only in this browser."}
          </p>
          {messages.map((m) => (
            <div key={m.id}>
              <MessageBubble message={m} />
              {m.meta?.safety === "crisis" && <CrisisCard className="ml-12 mt-3" categories={m.meta.safetyCategories} />}
            </div>
          ))}
          {streaming && (streaming.text ? <MessageBubble message={{ role: "assistant", content: streaming.text, meta: streaming.meta ?? undefined }} streaming /> : <TypingIndicator />)}
          {showCrisis && !messages.some((m) => m.meta?.safety === "crisis") && <CrisisCard compact className="ml-12" />}
        </div>
      </div>

      <div className="border-t border-border bg-bg/80 px-4 pb-3 pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-3xl">
          {gone ? (
            <div role="status" className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-4 text-center shadow-soft sm:flex-row sm:justify-between sm:text-left">
              <p className="text-sm text-muted">This conversation was deleted from this browser.</p>
              <Button size="sm" onClick={() => router.push(`/chat?new=${now()}`)}>
                <Plus className="h-4 w-4" /> Start a new conversation
              </Button>
            </div>
          ) : (
            <>
              {!busy && !input && !loading && chips.length > 0 && (
                <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin" aria-label="Suggested replies">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => void send(c)}
                      className="h-9 shrink-0 cursor-pointer rounded-full border border-border bg-surface px-3.5 text-sm text-muted transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-fg"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <Composer value={input} onChange={setInput} onSend={(t, via) => void send(t, via)} onStop={stop} busy={busy} disabled={loading} />
            </>
          )}
          <p className="mt-2 text-center text-xs text-subtle">
            {APP.companion} is a {APP.role}, not a psychologist, and can&apos;t diagnose.{" "}
            <Link href="/support" className="font-medium text-danger underline-offset-4 hover:underline">
              In crisis? Get help now
            </Link>
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          // Stop the reply first, so nothing still arriving can save the conversation again.
          deletedRef.current = true;
          abortRef.current?.abort();
          deleteConversation(conv.id);
          router.push(`/chat?new=${now()}`);
        }}
        title="Delete this conversation?"
        description="It will be permanently removed from this browser. This can't be undone."
      />
    </div>
  );
}
