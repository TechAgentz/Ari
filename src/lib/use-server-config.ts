"use client";

import { useEffect, useState } from "react";
import type { ServerConfig } from "./types";

export type PublicConfig = ServerConfig & { requestedProvider: string; misconfigured: boolean };

let cached: PublicConfig | null = null;
let inflight: Promise<PublicConfig | null> | null = null;

/** Last fetched config (null until loaded). */
export function getCachedServerConfig(): PublicConfig | null {
  return cached;
}

export function fetchServerConfig(force = false): Promise<PublicConfig | null> {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight && !force) return inflight;
  inflight = fetch("/api/config", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PublicConfig>) : null))
    .then((c) => {
      cached = c;
      return c;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Server AI configuration (provider, model, voice capabilities). Never contains secrets. */
export function useServerConfig(): { config: PublicConfig | null; loading: boolean } {
  const [config, setConfig] = useState<PublicConfig | null>(cached);
  const [loading, setLoading] = useState(!cached);
  useEffect(() => {
    let alive = true;
    fetchServerConfig().then((c) => {
      if (!alive) return;
      setConfig(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { config, loading };
}
