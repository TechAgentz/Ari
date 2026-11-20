"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc to close).
 * A non-dismissible dialog stays open: browsers may close a modal without a
 * cancelable event (Esc before any click, Android back), so it is re-opened.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        // Stops the close request before it starts (no flicker); the close handler below is the fallback.
        if (e.key === "Escape" && !dismissible) e.preventDefault();
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClose={() => {
        // The browser closed the dialog by itself (Esc before any click, Android back).
        // Our own close() only runs once `open` is false, so this is a no-op then.
        const el = ref.current;
        if (!open || !el) return;
        if (dismissible) onClose();
        else if (!el.open && el.isConnected) {
          try {
            el.showModal();
          } catch {
            /* already open or detached */
          }
        }
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(100%-2rem,34rem)] text-left max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-border bg-surface p-0 text-fg shadow-lift backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-fade-up",
        className,
      )}
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-serif text-2xl font-semibold leading-tight">
              {title}
            </h2>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {description && <div className="mt-2 text-sm leading-relaxed text-muted">{description}</div>}
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  /** "primary" for agreeing to something (e.g. consent), "danger" for destructive actions. */
  tone?: "danger" | "primary";
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-full border border-border px-5 font-medium hover:bg-surface-2">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "h-11 cursor-pointer rounded-full px-5 font-medium",
            tone === "primary" ? "bg-primary text-primary-fg hover:bg-primary-hover" : "bg-danger text-white hover:opacity-90 dark:text-bg",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
