import { MicOff } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice/controller";
import { cn } from "@/lib/utils";

export type VoiceOrbSize = "sm" | "md" | "lg";

const SIZES: Record<VoiceOrbSize, { wrap: string; core: string; bars: string; icon: string }> = {
  // Ended card / small placements.
  sm: { wrap: "h-28 w-28", core: "h-20 w-20", bars: "h-8 gap-1", icon: "h-7 w-7" },
  // In-session: leaves room for the caption and the controls on short phones.
  md: {
    wrap: "h-40 w-40 min-[400px]:h-44 min-[400px]:w-44 sm:h-60 sm:w-60",
    core: "h-28 w-28 min-[400px]:h-32 min-[400px]:w-32 sm:h-44 sm:w-44",
    bars: "h-12 gap-1.5 sm:h-16",
    icon: "h-9 w-9 sm:h-10 sm:w-10",
  },
  // Start screen hero.
  lg: {
    wrap: "h-48 w-48 min-[400px]:h-56 min-[400px]:w-56 sm:h-72 sm:w-72",
    core: "h-36 w-36 min-[400px]:h-40 min-[400px]:w-40 sm:h-52 sm:w-52",
    bars: "h-14 gap-1.5 sm:h-16",
    icon: "h-10 w-10",
  },
};

/**
 * Ari's animated presence (the brand orb).
 * listening → ripples that react to mic level (--level), thinking → slow orbit,
 * speaking → wave bars, muted → still and desaturated, idle/ended → gentle breathing.
 * Reduced motion is handled globally in globals.css.
 */
export function VoiceOrb({ status, id, size = "lg" }: { status: VoiceStatus; id?: string; size?: VoiceOrbSize }) {
  const listening = status === "listening";
  const speaking = status === "speaking";
  const thinking = status === "thinking" || status === "transcribing" || status === "starting";
  const muted = status === "muted";
  const idle = status === "idle" || status === "ended" || status === "error";
  const s = SIZES[size];

  return (
    <div id={id} className={cn("relative flex shrink-0 items-center justify-center", s.wrap)} style={{ ["--level" as string]: 0 }} aria-hidden>
      {/* Ripples while listening */}
      {listening && (
        <>
          <span className="absolute inset-[14%] rounded-full border-2 border-primary/40" style={{ animation: "ripple 2.4s ease-out infinite" }} />
          <span className="absolute inset-[14%] rounded-full border-2 border-lavender/40" style={{ animation: "ripple 2.4s ease-out 1.2s infinite" }} />
        </>
      )}
      {/* Orbit while thinking */}
      {thinking && (
        <span
          className="absolute inset-[6%] rounded-full"
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
        className={cn("absolute inset-[18%] rounded-full blur-2xl transition-opacity duration-500", muted ? "opacity-20" : "opacity-60")}
        style={{ background: "radial-gradient(circle, var(--primary), var(--accent) 70%, transparent)" }}
      />
      {/* Core */}
      <div
        className={cn(
          "bg-orb relative flex items-center justify-center overflow-hidden rounded-full shadow-lift transition-[filter,transform] duration-300 ease-out",
          s.core,
          idle && "animate-breathe",
          muted && "grayscale-[0.7]",
        )}
        style={{ transform: listening ? "scale(calc(1 + var(--level) * 0.12))" : undefined }}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.2),transparent_55%)]" />
        {speaking && (
          <div className={cn("relative flex items-center", s.bars)}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-white/90 sm:w-2"
                style={{ height: `${[40, 70, 100, 70, 40][i]}%`, animation: `wave ${0.9 + (i % 3) * 0.15}s ease-in-out ${i * 0.12}s infinite`, transformOrigin: "center" }}
              />
            ))}
          </div>
        )}
        {muted && <MicOff className={cn("relative text-white/90", s.icon)} strokeWidth={2} />}
      </div>
    </div>
  );
}
