"use client";

import { ArrowUpRight, Clock, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { KNOWLEDGE_BASE, KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from "@/lib/knowledge/base";
import { categoryTone } from "@/lib/knowledge/category-tone";
import { retrieveKnowledge } from "@/lib/knowledge/retrieve";
import { cn } from "@/lib/utils";

export function LibraryBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<KnowledgeCategory | "All">("All");
  const [techniquesOnly, setTechniquesOnly] = useState(false);

  const results = useMemo(() => {
    let list = KNOWLEDGE_BASE;
    if (query.trim().length > 1) {
      const hits = retrieveKnowledge(query, 50, 0.5).map((h) => h.entry);
      const textMatch = KNOWLEDGE_BASE.filter((e) => `${e.title} ${e.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
      list = [...new Set([...hits, ...textMatch])];
    }
    if (category !== "All") list = list.filter((e) => e.category === category);
    if (techniquesOnly) list = list.filter((e) => e.technique);
    return list;
  }, [query, category, techniquesOnly]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search the library</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “can't sleep”, “exam stress” or “lonely”"
            className="h-12 w-full rounded-full border border-border bg-surface pl-12 pr-4 text-base shadow-soft outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <button
          type="button"
          aria-pressed={techniquesOnly}
          onClick={() => setTechniquesOnly((v) => !v)}
          className={cn(
            "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors",
            techniquesOnly ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          <Sparkles className="h-4 w-4 text-accent" /> Techniques only
        </button>
      </div>

      <div className="scrollbar-thin -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Filter by category">
        {(["All", ...KNOWLEDGE_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors",
              category === c ? "bg-fg text-bg" : "bg-surface text-muted ring-1 ring-border hover:text-fg",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-subtle" aria-live="polite">
        {results.length} {results.length === 1 ? "article" : "articles"}
      </p>

      {results.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Search className="h-6 w-6" />} title="Nothing matched" description="Try different words, or ask Ari about it in a conversation." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((e, i) => (
            <li key={e.slug} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <Link
                href={`/library/${e.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-border bg-surface/90 p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", categoryTone(e.category))}>{e.category}</span>
                  <ArrowUpRight className="h-4 w-4 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <h2 className="mt-4 font-serif text-lg font-semibold leading-snug">{e.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{e.summary}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {e.readMinutes} min read
                  </span>
                  {e.technique && (
                    <span className="inline-flex items-center gap-1 text-accent">
                      <Sparkles className="h-3.5 w-3.5" /> {e.technique.name}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
