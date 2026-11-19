"use client";

import { AudioLines, MessageCircle, MessagesSquare, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { conversationsStore, deleteConversation, useHydrated } from "@/lib/storage";
import { cn, conversationSummary, formatRelative } from "@/lib/utils";

export function HistoryScreen() {
  const hydrated = useHydrated();
  const conversations = conversationsStore.useValue();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "chat" | "voice">("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Titles and previews never show text from conversations with crisis or distress content.
  const summaries = useMemo(() => new Map(conversations.map((c) => [c.id, conversationSummary(c)])), [conversations]);

  const q = query.trim().toLowerCase();
  const list = conversations.filter(
    (c) => (filter === "all" || c.mode === filter) && (!q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader
        eyebrow="Conversation history"
        title="Your conversations"
        description="Stored only in this browser. Open one to read it back or carry on where you left off."
        actions={
          hydrated && conversations.length > 0 ? (
            <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-danger-soft px-4 text-sm font-medium text-danger hover:opacity-90">
              <Trash2 className="h-4 w-4" /> Clear all
            </button>
          ) : null
        }
      />

      {!hydrated ? null : conversations.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="h-6 w-6" />}
          title="No conversations yet"
          description="When you talk with Ari by text or voice, the conversation is saved here — only on this device."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/chat?new=start">Start a conversation</ButtonLink>
              <ButtonLink href="/settings#data" variant="secondary">
                Load sample data
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search conversations</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your conversations"
                className="h-11 w-full rounded-full border border-border bg-surface pl-12 pr-4 text-base outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <div className="flex rounded-full border border-border bg-surface p-1" role="group" aria-label="Filter by type">
              {(["all", "chat", "voice"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn("h-9 cursor-pointer rounded-full px-4 text-sm font-medium capitalize transition-colors", filter === f ? "bg-fg text-bg" : "text-muted hover:text-fg")}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {list.map((c, i) => {
              const summary = summaries.get(c.id) ?? conversationSummary(c);
              const turns = c.messages.filter((m) => m.role === "user").length;
              return (
                <li key={c.id} className="group relative animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <Link href={`/chat?id=${c.id}`} className="flex items-start gap-4 rounded-3xl border border-border bg-surface/90 p-5 pr-16 shadow-soft transition-shadow hover:shadow-lift">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", c.mode === "voice" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary")}>
                      {c.mode === "voice" ? <AudioLines className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold">{summary.title}</h2>
                        {c.sample && <Badge tone="warm">Fictional sample</Badge>}
                        {c.messages.some((m) => m.meta?.safety === "crisis") && <Badge tone="danger">Support shared</Badge>}
                      </div>
                      <p className={cn("mt-1 line-clamp-2 text-sm text-muted", summary.sensitive && "italic")}>{summary.preview}</p>
                      <p className="mt-2 text-xs text-subtle">
                        {formatRelative(c.updatedAt)} · {turns} {turns === 1 ? "message" : "messages"} from you · {c.mode === "voice" ? "Voice" : "Text"}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(c.id)}
                    aria-label={`Delete conversation: ${summary.title}`}
                    className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length === 0 && <p className="mt-8 text-center text-sm text-muted">No conversations match your search.</p>}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteConversation(pendingDelete);
          toast("Conversation deleted");
        }}
        title="Delete this conversation?"
        description="It will be permanently removed from this browser. This can't be undone."
      />
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          conversationsStore.clear();
          toast("All conversations cleared");
        }}
        title="Clear all conversations?"
        description={`All ${conversations.length} conversations will be permanently removed from this browser. Mood check-ins and settings are kept. This can't be undone.`}
        confirmLabel="Clear all"
      />
    </div>
  );
}
