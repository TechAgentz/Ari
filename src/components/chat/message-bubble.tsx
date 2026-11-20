import { BookOpen, Mic } from "lucide-react";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { APP } from "@/lib/config";
import type { ChatMessage, MessageMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Ari's avatar: a small version of the brand orb. */
export function CompanionAvatar({ size = "md", pulse = false }: { size?: "sm" | "md"; pulse?: boolean }) {
  return (
    <span aria-hidden className={cn("relative block shrink-0 rounded-full bg-orb shadow-soft", size === "sm" ? "h-7 w-7" : "h-9 w-9")}>
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
    </span>
  );
}

function fallbackLabel(meta?: MessageMeta) {
  if (!meta?.fallback) return null;
  return "Backup reply: Groq was busy or unreachable";
}

export function MessageBubble({ message, streaming = false }: { message: Pick<ChatMessage, "role" | "content" | "meta">; streaming?: boolean }) {
  const isUser = message.role === "user";
  const fb = fallbackLabel(message.meta);
  const sources = !isUser ? message.meta?.sources ?? [] : [];
  const spoken = isUser && message.meta?.via === "voice";
  const interrupted = !isUser && message.meta?.interrupted;
  const hasFooter = spoken || sources.length > 0 || interrupted || !!fb;

  return (
    <div className={cn("flex animate-fade-up items-end gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="mb-1 self-start">
          <CompanionAvatar />
        </span>
      )}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[72%]", isUser ? "items-end" : "items-start")}>
        {!isUser && <span className="sr-only">{APP.companion} said:</span>}
        {isUser && <span className="sr-only">You said:</span>}
        <div
          className={cn(
            "max-w-full rounded-3xl px-4 py-3 text-base leading-relaxed sm:px-5 sm:text-[1.0625rem]",
            isUser ? "rounded-br-md bg-primary text-primary-fg shadow-soft" : "rounded-tl-md border border-border bg-surface text-fg shadow-soft",
          )}
        >
          {isUser ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <Markdown text={message.content} />}
          {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary" aria-hidden />}
        </div>
        {hasFooter && (
          <div className={cn("mt-2 flex flex-wrap items-center gap-2 px-1", isUser && "justify-end")}>
            {spoken && (
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                <Mic className="h-3.5 w-3.5" aria-hidden /> Spoken
              </span>
            )}
            {sources.map((s) => (
              <Link
                key={s.slug}
                href={`/library/${s.slug}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-accent-soft px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
              >
                <BookOpen className="h-4 w-4 text-accent" aria-hidden />
                {s.title}
              </Link>
            ))}
            {interrupted && <span className="text-sm text-muted">Stopped early</span>}
            {fb && <span className="text-sm text-muted">{fb}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex animate-fade-in items-start gap-2.5" role="status" aria-label={`${APP.companion} is typing`}>
      <CompanionAvatar />
      <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md border border-border bg-surface px-5 py-4 shadow-soft">
        <span className="typing-dot h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="typing-dot h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="typing-dot h-2.5 w-2.5 rounded-full bg-primary" />
      </div>
    </div>
  );
}
