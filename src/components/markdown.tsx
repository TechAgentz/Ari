import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe markdown renderer for assistant messages:
 * paragraphs, numbered/bulleted lists, **bold** and *italic*. No raw HTML.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) out.push(<strong key={`${key}-${i++}`} className="font-semibold">{token.slice(2, -2)}</strong>);
    else out.push(<em key={`${key}-${i++}`}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="prose-calm">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isOl = lines.length > 0 && lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        const isUl = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (isOl || isUl) {
          const Tag = isOl ? "ol" : "ul";
          return (
            <Tag key={bi} className={isOl ? "list-decimal space-y-1 pl-5 marker:text-subtle" : "list-disc space-y-1 pl-5 marker:text-subtle"}>
              {lines.map((l, li) => (
                <li key={li} className="pl-1">
                  {inline(l.replace(/^\s*(\d+[.)]|[-*•])\s+/, ""), `${bi}-${li}`)}
                </li>
              ))}
            </Tag>
          );
        }
        // A heading line followed by a list in the same block.
        const firstListIdx = lines.findIndex((l) => /^\s*(\d+[.)]|[-*•])\s+/.test(l));
        if (firstListIdx > 0 && lines.slice(firstListIdx).every((l) => /^\s*(\d+[.)]|[-*•])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[firstListIdx]);
          const Tag = ordered ? "ol" : "ul";
          return (
            <Fragment key={bi}>
              <p>{inline(lines.slice(0, firstListIdx).join(" "), `${bi}-h`)}</p>
              <Tag className={ordered ? "mt-1.5 list-decimal space-y-1 pl-5 marker:text-subtle" : "mt-1.5 list-disc space-y-1 pl-5 marker:text-subtle"}>
                {lines.slice(firstListIdx).map((l, li) => (
                  <li key={li} className="pl-1">
                    {inline(l.replace(/^\s*(\d+[.)]|[-*•])\s+/, ""), `${bi}-${li}`)}
                  </li>
                ))}
              </Tag>
            </Fragment>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
