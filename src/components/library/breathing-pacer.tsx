"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Animated breathing guide: the circle expands on the in-breath and softens on the out-breath. */
export function BreathingPacer({ inhale, hold = 0, exhale, holdAfter = 0 }: { inhale: number; hold?: number; exhale: number; holdAfter?: number }) {
  const phases = useMemo(
    () => [
      { label: "Breathe in", seconds: inhale, scale: 1 },
      ...(hold ? [{ label: "Hold", seconds: hold, scale: 1 }] : []),
      { label: "Breathe out", seconds: exhale, scale: 0.55 },
      ...(holdAfter ? [{ label: "Hold", seconds: holdAfter, scale: 0.55 }] : []),
    ],
    [inhale, hold, exhale, holdAfter],
  );
  const [running, setRunning] = useState(false);
  const [state, setState] = useState({ index: 0, count: inhale, cycles: 0 });

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setState((s) => {
        if (s.count > 1) return { ...s, count: s.count - 1 };
        const next = (s.index + 1) % phases.length;
        return { index: next, count: phases[next].seconds, cycles: next === 0 ? s.cycles + 1 : s.cycles };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, phases]);

  const phase = phases[state.index];
  const scale = running ? phase.scale : 0.7;

  return (
    <div className="flex flex-col items-center rounded-3xl bg-surface-2 px-6 py-8">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-primary/20" />
        {/* Solid fill + on-primary text keeps the instruction at WCAG AA contrast in both themes. */}
        <span
          className="absolute inset-0 rounded-full bg-linear-to-br from-primary to-accent shadow-lift"
          style={{ transform: `scale(${scale})`, transition: `transform ${running ? phase.seconds : 0.6}s ease-in-out` }}
        />
        <div className="relative text-center text-primary-fg" aria-live="polite">
          <p className="text-lg font-semibold">{running ? phase.label : "Ready"}</p>
          {running && <p className="text-3xl font-semibold tabular-nums">{state.count}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!running) setState({ index: 0, count: phases[0].seconds, cycles: 0 });
          setRunning((r) => !r);
        }}
        className="mt-6 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-fg hover:bg-primary-hover"
      >
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {running ? "Pause" : "Start breathing guide"}
      </button>
      <p className="mt-3 text-xs text-subtle">
        {state.cycles > 0 ? `${state.cycles} ${state.cycles === 1 ? "breath" : "breaths"} completed · ` : ""}Stop if you feel light-headed.
      </p>
    </div>
  );
}
