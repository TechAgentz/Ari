import { LifeBuoy, Phone } from "lucide-react";
import Link from "next/link";
import { ABUSE_RESOURCES, CRISIS_RESOURCES, type CrisisResource } from "@/lib/safety/resources";
import type { SafetyCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const FEATURED = CRISIS_RESOURCES.filter((r) => ["988 Suicide & Crisis Lifeline", "Samaritans", "Find A Helpline"].includes(r.name));

/** Helplines to show: domestic-abuse lines first when abuse came up, then the featured crisis lines. */
function resourcesFor(categories?: readonly SafetyCategory[]): CrisisResource[] {
  return categories?.includes("abuse") ? [...ABUSE_RESOURCES, ...FEATURED] : FEATURED;
}

/**
 * Crisis support card shown inline when a conversation indicates distress or crisis.
 * Always lists helplines (replies may say they're on screen); `compact` shows one action per helpline.
 * `categories` adds matching resources, e.g. domestic-abuse helplines for "abuse".
 */
export function CrisisCard({ className, compact = false, categories }: { className?: string; compact?: boolean; categories?: readonly SafetyCategory[] }) {
  const resources = resourcesFor(categories);
  return (
    <aside role="note" aria-label="Crisis support" className={cn("rounded-2xl border border-danger/25 bg-danger-soft/70 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-danger">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">You don&apos;t have to go through this alone</p>
          <p className="mt-0.5 text-sm text-muted">
            If you&apos;re in immediate danger, call your local emergency number (911 · 999 · 112 · 000).
          </p>
          <ul className={cn(compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2")}>
            {resources.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                <span className="font-medium">
                  {r.name} <span className="font-normal text-muted">· {r.region}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {(compact ? r.actions.slice(0, 1) : r.actions).map((a) => (
                    <a
                      key={a.href}
                      href={a.href}
                      target={a.href.startsWith("http") ? "_blank" : undefined}
                      rel={a.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full bg-surface px-3 text-xs font-semibold text-danger hover:bg-surface-2",
                        compact ? "h-7" : "h-8",
                      )}
                    >
                      {a.href.startsWith("tel:") && <Phone className="h-3 w-3" />}
                      {a.label}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/support" className={cn("inline-block text-sm font-semibold text-danger underline-offset-4 hover:underline", compact ? "mt-2" : "mt-3")}>
            More support options by country →
          </Link>
        </div>
      </div>
    </aside>
  );
}
