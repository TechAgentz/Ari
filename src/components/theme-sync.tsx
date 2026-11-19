"use client";

import { useEffect } from "react";
import { settingsStore } from "@/lib/storage";

/** Keeps the `dark` class in sync with the theme setting and the OS preference. */
export function ThemeSync() {
  const { theme } = settingsStore.useValue();
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
