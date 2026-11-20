import type { MoodEntry } from "@/lib/types";
import { cn, localDateKey } from "@/lib/utils";
import { moodMeta } from "./mood-meta";

function buildSeries(entries: MoodEntry[], days: number) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const key = localDateKey(d);
    return { key, d, entry: byDate.get(key), isToday: i === days - 1 };
  });
}

/** A short, plain-language summary of the last `days` days of check-ins. */
export function moodSummary(entries: MoodEntry[], days = 7): string {
  const logged = buildSeries(entries, days).filter((s) => s.entry);
  if (!logged.length) return days === 7 ? "No check-ins this week yet. Your first one will show up here." : `No check-ins in the last ${days} days.`;
  const avg = logged.reduce((a, s) => a + s.entry!.mood, 0) / logged.length;
  const period = days === 7 ? "this week" : `in the last ${days} days`;
  const count = logged.length === 1 ? "once" : `on ${logged.length} of ${days} days`;
  let line = `You checked in ${count} ${period}. On average you felt ${moodMeta(Math.round(avg)).label.toLowerCase()}.`;
  if (logged.length >= 3) {
    const half = Math.floor(logged.length / 2);
    const mean = (xs: typeof logged) => xs.reduce((a, s) => a + s.entry!.mood, 0) / xs.length;
    const diff = mean(logged.slice(-half)) - mean(logged.slice(0, half));
    if (diff >= 0.75) line += " Recent days look a little brighter.";
    else if (diff <= -0.75) line += " Recent days have felt harder. Be gentle with yourself.";
    else line += " Things have been fairly steady.";
  }
  return line;
}

/** Bar chart of the last N days of mood (1–5). Accessible via a text summary. */
export function MoodChart({ entries, days = 14, compact = false }: { entries: MoodEntry[]; days?: number; compact?: boolean }) {
  const series = buildSeries(entries, days);
  const logged = series.filter((s) => s.entry);
  const avg = logged.length ? logged.reduce((a, s) => a + s.entry!.mood, 0) / logged.length : 0;
  const summary = logged.length
    ? `Mood over the last ${days} days: ${logged.length} check-ins, average ${avg.toFixed(1)} out of 5 (${moodMeta(Math.round(avg)).label}).`
    : `No check-ins in the last ${days} days.`;
  const wide = days <= 7;

  return (
    <figure aria-label={summary} className="m-0">
      <div className={compact ? "flex h-20 items-end gap-1.5" : cn("flex h-44 items-end", wide ? "gap-2.5 sm:gap-3" : "gap-1.5 sm:gap-2")} aria-hidden="true">
        {series.map(({ key, d, entry, isToday }) => {
          const meta = entry ? moodMeta(entry.mood) : null;
          return (
            <div key={key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="flex w-full flex-1 items-end justify-center rounded-2xl">
                {entry ? (
                  <div
                    className={cn("w-full rounded-xl transition-[height] duration-300 ease-out", wide && "max-w-12")}
                    style={{ height: `${(entry.mood / 5) * 100}%`, background: meta!.color, minHeight: 10 }}
                    title={`${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${meta!.label}`}
                  />
                ) : (
                  <div className={cn("h-2.5 w-full rounded-full bg-surface-3", wide && "max-w-12")} title={`${d.toLocaleDateString()}: no check-in`} />
                )}
              </div>
              {!compact && (
                <span className={cn("text-[0.8125rem] leading-none", isToday ? "font-semibold text-fg" : "text-muted")}>
                  {d.toLocaleDateString(undefined, { weekday: wide ? "short" : "narrow" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
