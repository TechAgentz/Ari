/** Turn markdown-ish assistant text into something pleasant to read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "the link on screen")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that end in "." without ending the sentence ("e.g. a walk", "Dr. Lee"). */
const ABBREVIATIONS = new Set(["e.g", "i.e", "etc", "vs", "approx", "incl", "mr", "mrs", "ms", "dr", "prof", "st", "jr", "sr"]);

/** Whether the text right before a "." is an abbreviation, initial or dotted acronym (a.m., U.S.). */
function endsWithAbbreviation(before: string): boolean {
  const word = /[A-Za-z][A-Za-z.]*$/.exec(before)?.[0].toLowerCase();
  if (!word) return false;
  return word.length === 1 || /^(?:[a-z]\.)+[a-z]$/.test(word) || ABBREVIATIONS.has(word);
}

/**
 * Accumulates streamed text and emits complete sentences as soon as they're
 * available, so speech can start before the whole reply has arrived.
 * Every character ends up in exactly one emitted chunk: only the boundaries are searched for,
 * and a "." that isn't followed by a space ("7.5", "findahelpline.com") or that ends an
 * abbreviation ("e.g. ", "7 a.m. ") never splits a sentence.
 * Long sentences are split at commas (or spaces) to respect TTS input limits.
 */
export function createSentenceChunker(onSentence: (sentence: string) => void, maxLen = 180) {
  let buffer = "";
  const emit = (raw: string) => {
    const s = speakable(raw);
    if (!s) return;
    if (s.length <= maxLen) return onSentence(s);
    let rest = s;
    while (rest.length > maxLen) {
      const slice = rest.slice(0, maxLen);
      const soft = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "));
      const cut = soft > maxLen / 2 ? soft : slice.lastIndexOf(" ");
      const at = cut > 40 ? cut + 1 : maxLen;
      onSentence(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) onSentence(rest);
  };
  return {
    push(delta: string) {
      buffer += delta;
      const boundary = /[.!?…]+["'”’)\]]*(?=\s)|\n+/g;
      let start = 0;
      let match: RegExpExecArray | null;
      while ((match = boundary.exec(buffer))) {
        const end = match.index + match[0].length;
        if (end >= buffer.length) break; // wait to see what follows
        if (match[0] === ".") {
          const before = buffer.slice(start, match.index);
          if (endsWithAbbreviation(before) || /^\s*\d+$/.test(before)) continue; // "e.g. ", list number "1. "
        }
        emit(buffer.slice(start, end));
        start = end;
      }
      if (start) buffer = buffer.slice(start);
    },
    flush() {
      if (buffer.trim()) emit(buffer);
      buffer = "";
    },
  };
}
