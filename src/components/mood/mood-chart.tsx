import type { MoodEntry } from "@/lib/types";
import { localDateKey } from "@/lib/utils";
import { moodMeta } from "./mood-meta";

/** Bar chart of the last N days of mood (1–5). Accessible via a text summary + table. */
export function MoodChart({ entries, days = 14, compact = false }: { entries: MoodEntry[]; days?: number; compact?: boolean }) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const today = new Date();
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const key = localDateKey(d);
    return { key, d, entry: byDate.get(key) };
  });
  const logged = series.filter((s) => s.entry);
  const avg = logged.length ? logged.reduce((a, s) => a + s.entry!.mood, 0) / logged.length : 0;
  const summary = logged.length
    ? `Mood over the last ${days} days: ${logged.length} check-ins, average ${avg.toFixed(1)} out of 5 (${moodMeta(Math.round(avg)).label}).`
    : `No check-ins in the last ${days} days.`;

  return (
    <figure aria-label={summary}>
      <div className={compact ? "flex h-20 items-end gap-1" : "flex h-40 items-end gap-1.5 sm:gap-2"}>
        {series.map(({ key, d, entry }) => {
          const meta = entry ? moodMeta(entry.mood) : null;
          return (
            <div key={key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div className="relative flex w-full flex-1 items-end">
                {entry ? (
                  <div
                    className="w-full rounded-full transition-[height] duration-500"
                    style={{ height: `${(entry.mood / 5) * 100}%`, background: meta!.color, minHeight: 8 }}
                    title={`${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${meta!.label}`}
                  />
                ) : (
                  <div className="h-2 w-full rounded-full bg-surface-3" title={`${d.toLocaleDateString()}: no check-in`} />
                )}
              </div>
              {!compact && <span className="text-[0.65rem] text-subtle">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>}
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
