"use client";

import {
  Brain,
  ChevronRight,
  Clock,
  CloudSun,
  HeartHandshake,
  type LucideIcon,
  Moon,
  Search,
  Sparkles,
  Users,
  Wind,
  X,
  Leaf,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { KNOWLEDGE_BASE, KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from "@/lib/knowledge/base";
import { categoryTone } from "@/lib/knowledge/category-tone";
import { retrieveKnowledge } from "@/lib/knowledge/retrieve";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<KnowledgeCategory, LucideIcon> = {
  "Stress & Anxiety": Wind,
  "Mood & Emotions": CloudSun,
  "Sleep & Energy": Moon,
  Relationships: Users,
  "Thinking Patterns": Brain,
  "Skills & Practices": Leaf,
  "Getting Support": HeartHandshake,
};

const chipBase =
  "inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  const filtered = query.trim().length > 0 || category !== "All" || techniquesOnly;
  const clearAll = () => {
    setQuery("");
    setCategory("All");
    setTechniquesOnly(false);
  };

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search exercises and guides</span>
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What's on your mind? e.g. can't sleep"
          className="h-14 w-full rounded-full border border-border-strong bg-surface pl-13 pr-14 text-base text-fg shadow-soft outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </label>

      <div className="scrollbar-thin -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by topic">
        {(["All", ...KNOWLEDGE_CATEGORIES] as const).map((c) => {
          const active = category === c;
          const Icon = c === "All" ? null : CATEGORY_ICON[c];
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c)}
              className={cn(chipBase, active ? "bg-primary text-primary-fg shadow-soft" : "bg-surface text-fg ring-1 ring-border-strong hover:bg-surface-2")}
            >
              {Icon && <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
              {c === "All" ? "All topics" : c}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? "result" : "results"}
        </p>
        <button
          type="button"
          aria-pressed={techniquesOnly}
          onClick={() => setTechniquesOnly((v) => !v)}
          className={cn(chipBase, techniquesOnly ? "bg-accent-soft text-fg ring-2 ring-accent" : "bg-transparent text-fg ring-1 ring-border-strong hover:bg-surface-2")}
        >
          <Sparkles className="h-[1.125rem] w-[1.125rem] text-accent" aria-hidden /> Exercises only
        </button>
      </div>

      {results.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Nothing matched"
            description="Try different words, or ask Ari about it in a conversation."
            action={
              filtered ? (
                <Button variant="secondary" onClick={clearAll}>
                  Clear search and filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {results.map((e, i) => {
            const Icon = CATEGORY_ICON[e.category];
            return (
              <li key={e.slug} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                <Link
                  href={`/library/${e.slug}`}
                  className="group flex h-full min-h-28 items-start gap-4 rounded-3xl border border-border bg-surface p-5 shadow-soft transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", categoryTone(e.category))}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1.0625rem] font-semibold leading-snug text-fg">{e.title}</span>
                    <span className="mt-1 line-clamp-2 block text-[0.9375rem] leading-normal text-muted">{e.summary}</span>
                    <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" aria-hidden />
                        {e.technique ? e.technique.duration : `${e.readMinutes} min read`}
                      </span>
                      {e.technique && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                          <Sparkles className="h-4 w-4" aria-hidden /> Exercise
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
