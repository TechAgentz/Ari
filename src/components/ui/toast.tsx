"use client";

import { CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "info";
}

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottomnav-h)_+_1rem)] z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium shadow-lift",
            )}
          >
            {t.tone === "success" ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-success" /> : <Info className="h-4.5 w-4.5 shrink-0 text-primary" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
