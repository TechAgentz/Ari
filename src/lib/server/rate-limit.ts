import "server-only";
import { getServerEnv } from "./env";

/** Request guards for the API routes: a tiny in-memory rate limiter (enough for a local demo) and a bounded body reader. */

const MAX_BUCKETS = 5000;
const buckets = new Map<string, { count: number; reset: number }>();

/** Fixed-window rate limiter. */
export function rateLimit(key: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.delete(key);
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
      // Still full: drop the oldest windows (a Map keeps insertion order).
      for (const k of buckets.keys()) {
        if (buckets.size < MAX_BUCKETS) break;
        buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, retryAfter: Math.ceil((bucket.reset - now) / 1000) };
}

/**
 * Rate-limit key. Clients can send any X-Forwarded-For or X-Real-IP header, so they are
 * trusted only behind a reverse proxy that sets them (TRUST_PROXY=1), and then the right-most
 * hop, the address that proxy saw, is used. Otherwise every request shares one bucket,
 * which suits a local, single-user demo.
 */
export function clientKey(req: Request, scope: string): string {
  if (!getServerEnv().trustProxy) return `${scope}:local`;
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  const ip = hops[hops.length - 1] || req.headers.get("x-real-ip")?.trim();
  return `${scope}:${ip || "local"}`;
}

/**
 * Reads a request body, stopping as soon as it passes `maxBytes`, whether or not a
 * Content-Length was sent (a chunked upload has none). Returns null when it is too large.
 */
export async function readBody(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
