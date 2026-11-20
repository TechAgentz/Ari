"use client";

import { AudioLines, ChevronRight, MessageCircle, MessagesSquare, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { conversationsStore, deleteConversation, useHydrated } from "@/lib/storage";
import { cn, conversationSummary, formatRelative } from "@/lib/utils";

const FILTERS = [
  { v: "all", label: "All" },
  { v: "chat", label: "Typed" },
  { v: "voice", label: "Voice" },
] as const;

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
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader
        title="Past conversations"
        description="Saved only on this device. Pick one to read it again or carry on where you left off."
        actions={hydrated && conversations.length > 0 ? <ButtonLink href="/chat?new=start">New conversation</ButtonLink> : null}
      />

      {!hydrated ? null : conversations.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="h-6 w-6" />}
          title="No conversations yet"
          description="When you talk with Ari by voice or by typing, the conversation is saved here, only on this device."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <ButtonLink href="/chat?new=start" size="lg">
                Start a conversation
              </ButtonLink>
              <ButtonLink href="/settings#data" variant="ghost">
                Load sample data
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your conversations"
                className="h-13 w-full rounded-full border border-border-strong bg-surface pl-12 pr-4 text-base text-fg placeholder:text-subtle outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="flex rounded-full border border-border bg-surface-2 p-1" role="group" aria-label="Filter by type">
              {FILTERS.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  aria-pressed={filter === f.v}
                  onClick={() => setFilter(f.v)}
                  className={cn(
                    "h-11 flex-1 cursor-pointer rounded-full px-4 text-[0.9375rem] font-semibold transition-colors duration-200",
                    filter === f.v ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-sm text-muted" aria-live="polite">
            {list.length === conversations.length ? `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"}` : `${list.length} of ${conversations.length} shown`}
          </p>

          <ul className="mt-3 space-y-3">
            {list.map((c, i) => {
              const summary = summaries.get(c.id) ?? conversationSummary(c);
              const turns = c.messages.filter((m) => m.role === "user").length;
              return (
                <li
                  key={c.id}
                  className="animate-fade-up rounded-3xl border border-border bg-surface shadow-soft"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <Link href={`/chat?id=${c.id}`} className="flex items-start gap-4 rounded-t-3xl p-4 pb-3 sm:p-5 sm:pb-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        c.mode === "voice" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary",
                      )}
                    >
                      {c.mode === "voice" ? <AudioLines className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
                      <span className="sr-only">{c.mode === "voice" ? "Voice conversation" : "Typed conversation"}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-base font-semibold leading-snug text-fg">{summary.title}</h2>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatRelative(c.updatedAt)} · {turns} {turns === 1 ? "message" : "messages"} from you
                      </p>
                      <p className={cn("mt-2 line-clamp-2 text-[0.9375rem] leading-relaxed text-muted", summary.sensitive && "italic")}>{summary.preview}</p>
                      {(c.sample || c.messages.some((m) => m.meta?.safety === "crisis")) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {c.sample && <Badge tone="warm">Fictional sample</Badge>}
                          {c.messages.some((m) => m.meta?.safety === "crisis") && <Badge tone="danger">Support shared</Badge>}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 sm:px-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(c.id)}
                      aria-label={`Delete conversation: ${summary.title}`}
                      className="hover:!bg-danger-soft hover:!text-danger"
                    >
                      <Trash2 className="h-4.5 w-4.5" aria-hidden="true" /> Delete
                    </Button>
                    <ButtonLink href={`/chat?id=${c.id}`} variant="soft" size="sm" aria-label={`Continue conversation: ${summary.title}`}>
                      Continue <ChevronRight className="h-4.5 w-4.5" aria-hidden="true" />
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.length === 0 && <p className="mt-8 text-center text-base text-muted">No conversations match your search.</p>}

          <div className="mt-10 flex justify-center border-t border-border pt-6">
            <Button variant="danger" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4.5 w-4.5" aria-hidden="true" /> Clear all conversations
            </Button>
          </div>
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
