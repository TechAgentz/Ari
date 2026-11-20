import { BookOpen, Mic } from "lucide-react";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import type { ChatMessage, MessageMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CompanionAvatar({ size = "md", pulse = false }: { size?: "sm" | "md"; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-accent text-white shadow-soft",
        size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm",
      )}
    >
      <span className="font-serif font-semibold">A</span>
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
    </span>
  );
}

function fallbackLabel(meta?: MessageMeta) {
  if (!meta?.fallback) return null;
  return "Backup reply — Groq was busy or unreachable";
}

export function MessageBubble({ message, streaming = false }: { message: Pick<ChatMessage, "role" | "content" | "meta">; streaming?: boolean }) {
  const isUser = message.role === "user";
  const fb = fallbackLabel(message.meta);
  return (
    <div className={cn("flex animate-fade-up gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <CompanionAvatar />}
      <div className={cn("flex max-w-[85%] flex-col sm:max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-3xl px-4 py-3 text-[0.97rem] leading-relaxed",
            isUser ? "rounded-br-lg bg-primary text-primary-fg" : "rounded-tl-lg border border-border bg-surface shadow-soft",
          )}
        >
          {isUser ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <Markdown text={message.content} />}
          {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary" aria-hidden />}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
          {isUser && message.meta?.via === "voice" && (
            <span className="inline-flex items-center gap-1 text-xs text-subtle">
              <Mic className="h-3 w-3" /> spoken
            </span>
          )}
          {!isUser &&
            message.meta?.sources?.map((s) => (
              <Link
                key={s.slug}
                href={`/library/${s.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:bg-surface-3"
              >
                <BookOpen className="h-3 w-3 text-accent" />
                {s.title}
              </Link>
            ))}
          {!isUser && message.meta?.interrupted && <span className="text-xs text-subtle">interrupted</span>}
          {fb && <span className="text-xs text-subtle">{fb}</span>}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex animate-fade-in items-center gap-3" role="status" aria-label="Ari is typing">
      <CompanionAvatar />
      <div className="flex gap-1.5 rounded-3xl rounded-tl-lg border border-border bg-surface px-4 py-4 shadow-soft">
        <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
        <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
        <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
      </div>
    </div>
  );
}
