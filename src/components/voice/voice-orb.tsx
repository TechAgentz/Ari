import { MicOff } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice/controller";
import { cn } from "@/lib/utils";

/**
 * Animated presence for the voice companion.
 * listening → ripples that react to mic level (--level), thinking → slow orbit,
 * speaking → wave bars, muted → still and desaturated.
 */
export function VoiceOrb({ status, id }: { status: VoiceStatus; id?: string }) {
  const listening = status === "listening";
  const speaking = status === "speaking";
  const thinking = status === "thinking" || status === "transcribing" || status === "starting";
  const muted = status === "muted";
  const idle = status === "idle" || status === "ended" || status === "error";

  return (
    <div
      id={id}
      className="relative flex h-44 w-44 items-center justify-center min-[400px]:h-52 min-[400px]:w-52 sm:h-72 sm:w-72"
      style={{ ["--level" as string]: 0 }}
      aria-hidden
    >
      {/* Ripples while listening */}
      {listening && (
        <>
          <span className="absolute inset-6 rounded-full border-2 border-primary/40" style={{ animation: "ripple 2.4s ease-out infinite" }} />
          <span className="absolute inset-6 rounded-full border-2 border-accent/30" style={{ animation: "ripple 2.4s ease-out 1.2s infinite" }} />
        </>
      )}
      {/* Orbit while thinking */}
      {thinking && (
        <span
          className="absolute inset-3 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, var(--primary) 70deg, transparent 140deg, transparent 200deg, var(--accent) 280deg, transparent 340deg)",
            mask: "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
            WebkitMask: "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
            animation: "spin-slow 2.6s linear infinite",
          }}
        />
      )}
      {/* Soft glow */}
      <span
        className={cn("absolute inset-8 rounded-full blur-2xl transition-opacity duration-500", muted ? "opacity-20" : "opacity-70")}
        style={{ background: "radial-gradient(circle, var(--primary), var(--accent) 70%, transparent)" }}
      />
      {/* Core */}
      <div
        className={cn(
          "relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full shadow-lift transition-[filter,transform] duration-300 sm:h-48 sm:w-48",
          idle && "animate-breathe",
          muted && "grayscale-[0.7]",
        )}
        style={{
          background: "radial-gradient(circle at 30% 25%, color-mix(in oklab, white 35%, var(--primary)), var(--primary) 45%, var(--accent))",
          transform: listening ? "scale(calc(1 + var(--level) * 0.12))" : undefined,
        }}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.18),transparent_55%)]" />
        {speaking && (
          <div className="flex h-16 items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-2 rounded-full bg-white/90"
                style={{ height: `${[40, 70, 100, 70, 40][i]}%`, animation: `wave ${0.9 + (i % 3) * 0.15}s ease-in-out ${i * 0.12}s infinite`, transformOrigin: "center" }}
              />
            ))}
          </div>
        )}
        {muted && <MicOff className="h-10 w-10 text-white/90" />}
      </div>
    </div>
  );
}
