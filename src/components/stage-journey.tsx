import { STAGES } from "@/lib/config";
import type { StageId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A gentle visual of where the conversation is — not a checklist the user has to complete. */
export function StageJourney({ stage, className }: { stage: StageId; className?: string }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label={`Conversation: ${STAGES[idx]?.label}`} role="img">
      {STAGES.map((s, i) => (
        <span key={s.id} className="flex items-center gap-1.5" title={s.label}>
          <span
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              i < idx ? "w-4 bg-primary/50" : i === idx ? "w-7 bg-primary" : "w-4 bg-surface-3",
            )}
          />
        </span>
      ))}
      <span className="ml-1.5 text-xs font-medium text-muted">{STAGES[idx]?.label}</span>
    </div>
  );
}
