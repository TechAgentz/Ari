import { ChevronRight, ExternalLink, LifeBuoy, MessageSquareText, Phone } from "lucide-react";
import Link from "next/link";
import { ABUSE_RESOURCES, CRISIS_RESOURCES, type CrisisResource } from "@/lib/safety/resources";
import type { SafetyCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const FEATURED = CRISIS_RESOURCES.filter((r) => ["988 Suicide & Crisis Lifeline", "Samaritans", "Find A Helpline"].includes(r.name));

/** Helplines to show: domestic-abuse lines first when abuse came up, then the featured crisis lines. */
function resourcesFor(categories?: readonly SafetyCategory[]): CrisisResource[] {
  return categories?.includes("abuse") ? [...ABUSE_RESOURCES, ...FEATURED] : FEATURED;
}

function ActionIcon({ href }: { href: string }) {
  if (href.startsWith("tel:")) return <Phone className="h-4 w-4" aria-hidden="true" />;
  if (href.startsWith("sms:")) return <MessageSquareText className="h-4 w-4" aria-hidden="true" />;
  return <ExternalLink className="h-4 w-4" aria-hidden="true" />;
}

/**
 * Crisis support card shown inline when a conversation indicates distress or crisis.
 * Always lists helplines (replies may say they're on screen); `compact` shows one action per helpline.
 * `categories` adds matching resources, e.g. domestic-abuse helplines for "abuse".
 */
export function CrisisCard({ className, compact = false, categories }: { className?: string; compact?: boolean; categories?: readonly SafetyCategory[] }) {
  const resources = resourcesFor(categories);
  return (
    <aside role="note" aria-label="Crisis support" className={cn("rounded-3xl border border-danger/25 bg-danger-soft p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-danger">
          <LifeBuoy className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-fg">You don&apos;t have to go through this alone</p>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-fg/80">
            If you&apos;re in immediate danger, call your local emergency number (911 · 999 · 112 · 000).
          </p>
        </div>
      </div>

      <ul className={cn("space-y-2", compact ? "mt-3" : "mt-4")}>
        {resources.map((r) => (
          <li key={r.name} className="rounded-2xl bg-surface p-3">
            <p className="text-[0.9375rem] font-semibold text-fg">
              {r.name} <span className="font-normal text-muted">· {r.region}</span>
            </p>
            <span className="mt-2 flex flex-wrap gap-2">
              {(compact ? r.actions.slice(0, 1) : r.actions).map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  target={a.href.startsWith("http") ? "_blank" : undefined}
                  rel={a.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-danger-soft px-4 text-[0.9375rem] font-semibold text-danger transition-colors hover:bg-danger hover:text-white dark:hover:text-bg"
                >
                  <ActionIcon href={a.href} />
                  {a.label}
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/support"
        className={cn("inline-flex min-h-12 items-center gap-1 text-[0.9375rem] font-semibold text-danger underline-offset-4 hover:underline", compact ? "mt-1" : "mt-2")}
      >
        More support options by country <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
