/**
 * Data minimisation: strips contact details and identifiers before a message
 * leaves the device (and again on the server, as defence in depth).
 */
const RULES: { pattern: RegExp; replace: string | ((m: string) => string) }[] = [
  { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replace: "[email removed]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replace: "[id removed]" },
  {
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replace: "[number removed]",
  },
  {
    // Phone-like sequences with at least 9 digits.
    pattern: /(?:\+?\d[\d\s().-]{7,}\d)/g,
    replace: (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone removed]" : m),
  },
  {
    pattern:
      /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|close)\b\.?/gi,
    replace: "[address removed]",
  },
  { pattern: /\b(?:password|passcode|pin)\s*(?:is|:)\s*\S+/gi, replace: "[credential removed]" },
];

export function redactPII(text: string): string {
  let out = text;
  for (const rule of RULES) {
    out = typeof rule.replace === "string" ? out.replace(rule.pattern, rule.replace) : out.replace(rule.pattern, rule.replace);
  }
  return out;
}
