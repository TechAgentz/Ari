import { KNOWLEDGE_BASE, type KnowledgeEntry } from "./base";

const STOPWORDS = new Set(
  "a an the and or but if so to of in on at for with about from by as is are was were be been being i me my we our you your it its this that these those just really very can could would should do does did have has had not no yes im i'm ive i've dont don't am get got feel feeling bit lot like".split(
    " ",
  ),
);

export function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function stem(word: string): string {
  return word
    .replace(/'s$/, "")
    .replace(/(ing|ed|ly|es|s)$/, "")
    .replace(/(.)\1$/, "$1");
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

interface Indexed {
  entry: KnowledgeEntry;
  phrases: string[];
  /** Library names (title, technique name) — the most specific signal. */
  names: string[];
  /** All-caps technique names (e.g. "STOP"), matched case-sensitively. */
  acronyms: RegExp[];
  titleTokens: Set<string>;
  summaryTokens: Set<string>;
}

/**
 * Names users type or paste from the library ("guide me through Worry postponement"):
 * the title and technique name, with and without dashes or quotes. A bare common
 * word ("STOP") only counts when written as the acronym.
 */
function indexNames(entry: KnowledgeEntry, phrases: string[]): Pick<Indexed, "names" | "acronyms"> {
  const raw = [entry.title, entry.technique?.name].filter((n): n is string => Boolean(n));
  const names = raw
    .flatMap((n) => [n, n.replace(/[–—]/g, "-"), n.replace(/['’‘"“”]/g, "")])
    .map(normalize)
    .filter((p) => !/^[a-z]+$/.test(p.trim()) && !phrases.includes(p));
  const acronyms = raw.filter((n) => /^[A-Z]{2,}$/.test(n)).map((n) => new RegExp(`\\b${n}\\b`));
  return { names: [...new Set(names)], acronyms };
}

const INDEX: Indexed[] = KNOWLEDGE_BASE.map((entry) => {
  const phrases = entry.keywords.map((k) => normalize(k));
  return {
    entry,
    phrases,
    ...indexNames(entry, phrases),
    titleTokens: new Set(tokens(entry.title)),
    summaryTokens: new Set(tokens(entry.summary)),
  };
});

/** How a request is phrased ("walk me through …") says nothing about its topic. */
const REQUEST_PHRASING = /\b(walk|talk|guide|take|run)(ing)? (me|you|us) through\b/gi;

export interface RetrievalHit {
  entry: KnowledgeEntry;
  score: number;
}

/**
 * Lightweight keyword retrieval over the hardcoded knowledge base.
 * Library names score highest, then multi-word keyword phrases, then title and summary overlap.
 */
export function retrieveKnowledge(query: string, k = 3, minScore = 2): RetrievalHit[] {
  const text = query.replace(REQUEST_PHRASING, " ");
  const q = normalize(text);
  if (q.trim().length < 2) return [];
  const qTokens = tokens(text);

  const hits: RetrievalHit[] = [];
  for (const item of INDEX) {
    let score = 0;
    for (const phrase of item.phrases) {
      if (q.includes(phrase)) score += phrase.trim().includes(" ") ? 4 : 3;
    }
    for (const name of item.names) {
      if (q.includes(name)) score += 5;
    }
    for (const re of item.acronyms) {
      if (re.test(text)) score += 5;
    }
    for (const t of qTokens) {
      if (item.titleTokens.has(t)) score += 1.5;
      if (item.summaryTokens.has(t)) score += 0.5;
    }
    if (score >= minScore) hits.push({ entry: item.entry, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

/** Compact reference notes injected into the LLM system prompt. */
export function formatKnowledgeForPrompt(hits: RetrievalHit[], voice: boolean): string {
  return hits
    .map(({ entry }) => {
      const lines = [`• ${entry.title} [${entry.slug}]: ${entry.insight}`];
      if (entry.technique) {
        lines.push(
          voice
            ? `  Technique "${entry.technique.name}" (${entry.technique.duration}): ${entry.technique.voiceScript}`
            : `  Technique "${entry.technique.name}" (${entry.technique.duration}): ${entry.technique.steps.join(" ")}`,
        );
      }
      if (entry.seekHelp) lines.push(`  When to seek help: ${entry.seekHelp}`);
      return lines.join("\n");
    })
    .join("\n");
}
