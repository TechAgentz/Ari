"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

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
  const pattern = [inhale, hold, exhale, holdAfter].filter(Boolean).join("-");

  return (
    <div className="flex flex-col items-center rounded-3xl bg-surface-2 px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-center text-base text-muted">
        Follow the circle. Breathe in as it grows, out as it shrinks.{" "}
        <span className="whitespace-nowrap">({pattern} rhythm)</span>
      </p>
      <div className="relative mt-6 flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20" aria-hidden />
        {/* Solid fill + on-primary text keeps the instruction at WCAG AA contrast in both themes. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-linear-to-br from-primary to-accent shadow-lift"
          style={{ transform: `scale(${scale})`, transition: `transform ${running ? phase.seconds : 0.6}s ease-in-out` }}
        />
        <div className="relative text-center text-primary-fg" aria-live="polite">
          <p className="text-xl font-semibold">{running ? phase.label : "Ready when you are"}</p>
          {running && <p className="mt-1 text-5xl font-semibold tabular-nums">{state.count}</p>}
        </div>
      </div>
      <Button
        size="lg"
        variant={running ? "secondary" : "primary"}
        className="mt-8 min-w-56"
        aria-pressed={running}
        onClick={() => {
          if (!running) setState({ index: 0, count: phases[0].seconds, cycles: 0 });
          setRunning((r) => !r);
        }}
      >
        {running ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
        {running ? "Pause" : "Start breathing"}
      </Button>
      <p className="mt-4 text-center text-[0.9375rem] text-muted">
        {state.cycles > 0 ? `${state.cycles} ${state.cycles === 1 ? "breath" : "breaths"} done. ` : ""}Stop if you feel light-headed.
      </p>
    </div>
  );
}
