"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc to close).
 * Phones (< 640px): a bottom sheet that slides up (rounded top, max 90dvh, scrolls).
 * Larger screens: a centred card. `footer` stays pinned to the bottom of the sheet/card.
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
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
  /** Optional action area pinned to the bottom (e.g. the main button), always visible while the body scrolls. */
  footer?: ReactNode;
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
        // Phone: bottom sheet.
        "fixed m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl rounded-b-none border border-b-0 border-border bg-surface p-0 text-left text-fg shadow-lift",
        "backdrop:bg-black/45 backdrop:backdrop-blur-[2px] open:animate-sheet-up",
        // Tablet and up: centred card.
        "sm:m-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(100%-2rem,34rem)] sm:rounded-3xl sm:border-b sm:open:animate-fade-up",
        className,
      )}
    >
      {open && (
        <>
          <div className={cn("px-5 pt-3 sm:px-7 sm:pt-7", footer ? "pb-5" : "pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7")}>
            {/* Grab handle: a visual cue that this is a sheet (phones only). */}
            <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="pt-1.5 font-serif text-2xl font-semibold leading-tight">
                {title}
              </h2>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-2 flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <X className="h-6 w-6" strokeWidth={2} />
                </button>
              )}
            </div>
            {description && <div className="mt-2 text-base leading-relaxed text-muted">{description}</div>}
            <div className="mt-5">{children}</div>
          </div>
          {footer && (
            <div className="sticky bottom-0 border-t border-border bg-surface px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7 sm:pb-6">
              {footer}
            </div>
          )}
        </>
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
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-14 cursor-pointer rounded-full border border-border-strong bg-surface px-6 text-base font-semibold hover:bg-surface-2 sm:h-12"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "h-14 cursor-pointer rounded-full px-6 text-base font-semibold sm:h-12",
            tone === "primary" ? "bg-primary text-primary-fg hover:bg-primary-hover" : "bg-danger text-white hover:opacity-90 dark:text-bg",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
