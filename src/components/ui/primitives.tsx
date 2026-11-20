import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 24px radius surface. `interactive` adds a hover lift for cards that are links or buttons. */
export function Card({ className, interactive, ...props }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface shadow-soft",
        interactive && "transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

/** Section heading inside a page (18px semibold) with an optional trailing action. */
export function SectionTitle({ title, action, id, className }: { title: string; action?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 id={id} className="text-lg font-semibold text-fg">
        {title}
      </h2>
      {action}
    </div>
  );
}

export type BadgeTone = "neutral" | "primary" | "accent" | "warm" | "danger" | "success";

export function Badge({ className, tone = "neutral", ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    primary: "bg-primary-soft text-fg",
    accent: "bg-accent-soft text-fg",
    warm: "bg-warm-soft text-fg",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-fg",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-medium leading-5", tones[tone], className)} {...props} />;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1.5 text-[0.9375rem] font-medium text-primary">{eyebrow}</p>}
        <h1 className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-fg lg:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-base leading-relaxed text-muted sm:text-[1.0625rem]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
  id: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-base font-medium text-fg">
          {label}
        </label>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          // The visible track is 32x52; the transparent ring pads the touch target to 48px tall.
          "relative inline-flex h-8 w-[3.25rem] shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] disabled:cursor-not-allowed disabled:opacity-45",
          checked ? "border-primary bg-primary" : "border-border-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-base leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
