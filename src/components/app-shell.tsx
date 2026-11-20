"use client";

import {
  AudioLines,
  BookOpen,
  ChevronRight,
  History,
  House,
  LifeBuoy,
  type LucideIcon,
  Menu,
  MessageCircle,
  Monitor,
  Moon,
  Settings,
  SmilePlus,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { APP } from "@/lib/config";
import { settingsStore, updateSettings } from "@/lib/storage";
import type { Settings as AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { Dialog } from "./ui/dialog";

type NavItem = { href: string; label: string; icon: LucideIcon; /** Extra routes that also light this item up. */ also?: string[] };

/** Phone bottom tabs: the four things people do most. */
const TABS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/voice", label: "Talk", icon: AudioLines, also: ["/chat"] },
  { href: "/library", label: "Exercises", icon: BookOpen },
  { href: "/mood", label: "Mood", icon: SmilePlus },
];

/** Desktop sidebar: everything, as text plus icons. */
const SIDEBAR: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/voice", label: "Talk", icon: AudioLines },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/library", label: "Exercises", icon: BookOpen },
  { href: "/mood", label: "Mood", icon: SmilePlus },
  { href: "/history", label: "Past conversations", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Items in the phone "More" sheet. */
const MORE: (NavItem & { hint: string; tone?: "danger" })[] = [
  { href: "/history", label: "Past conversations", hint: "Pick up where you left off", icon: History },
  { href: "/settings", label: "Settings", hint: "Voice, privacy and your data", icon: Settings },
  { href: "/support", label: "Crisis support", hint: "Phone lines open 24/7", icon: LifeBuoy, tone: "danger" },
];

const THEMES: { value: AppSettings["theme"]; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

function matches(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, item: NavItem) {
  return matches(pathname, item.href) || (item.also ?? []).some((h) => matches(pathname, h));
}

const HONESTY_NOTE = `${APP.companion} is a ${APP.role} that works alongside ${APP.careTeam}. ${APP.companion} is not a psychologist and can't help in an emergency. No account needed: your data stays in this browser.`;

function ThemeToggle() {
  const { theme } = settingsStore.useValue();
  return (
    <fieldset>
      <legend className="mb-2 text-base font-semibold text-fg">Appearance</legend>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
        {THEMES.map(({ value, label, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => updateSettings({ theme: value })}
              className={cn(
                "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full text-[0.9375rem] font-medium transition-colors duration-200",
                selected ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg",
              )}
            >
              <Icon className={cn("h-5 w-5", selected && "text-primary")} strokeWidth={2} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The sheet remembers the page it was opened on, so it closes by itself after any navigation.
  const [moreOpenOn, setMoreOpenOn] = useState<string | null>(null);
  const moreOpen = moreOpenOn === pathname;
  const closeMore = () => setMoreOpenOn(null);

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-surface focus:px-5 focus:py-3 focus:font-semibold focus:shadow-lift"
      >
        Skip to content
      </a>

      {/* ───────── Desktop sidebar ───────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-3 rounded-2xl px-2 py-1" aria-label={`${APP.name} home`}>
          <Logo size={40} />
          <span className="font-serif text-xl font-semibold leading-none">{APP.name}</span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {SIDEBAR.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-2xl px-3.5 text-base font-medium transition-colors duration-200",
                  active ? "bg-primary-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className={cn("h-[22px] w-[22px]", active && "text-primary")} strokeWidth={2} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-4">
          <Link
            href="/support"
            className="flex items-center gap-3 rounded-3xl border border-border bg-danger-soft/60 p-3.5 transition-colors hover:bg-danger-soft"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger-soft text-danger">
              <LifeBuoy className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-fg">Need help now?</span>
              <span className="block text-sm text-muted">Crisis lines, 24/7</span>
            </span>
          </Link>
          <p className="px-2 text-sm leading-relaxed text-muted">
            {APP.companion} is a {APP.role}, not a psychologist. Your data stays in this browser.
          </p>
        </div>
      </aside>

      {/* ───────── Phone top bar ───────── */}
      <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] items-center justify-between gap-2 border-b border-border bg-bg/90 pl-5 pr-3 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex min-h-12 items-center gap-2.5 rounded-2xl" aria-label={`${APP.name} home`}>
          <Logo size={32} />
          <span className="font-serif text-xl font-semibold">{APP.name}</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/support"
            className="flex h-12 items-center gap-1.5 rounded-full bg-danger-soft px-4 text-[0.9375rem] font-semibold text-danger transition-colors hover:bg-danger hover:text-white dark:hover:text-bg"
          >
            <LifeBuoy className="h-5 w-5" strokeWidth={2} aria-hidden />
            Get help
          </Link>
          <button
            type="button"
            onClick={() => setMoreOpenOn(pathname)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="flex h-12 min-w-12 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
            <span className="sr-only min-[380px]:not-sr-only">More</span>
          </button>
        </div>
      </header>

      {/* Bottom padding keeps content clear of the fixed phone tab bar (0 on desktop). */}
      <main id="main" className="relative z-10 pb-[var(--bottomnav-h)] lg:pl-64">
        {children}
      </main>

      {/* ───────── Phone bottom tab bar ───────── */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-4 px-2">
          {TABS.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-[0.8125rem] font-semibold transition-colors duration-200",
                    active ? "text-primary" : "text-muted hover:text-fg",
                  )}
                >
                  <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200", active && "bg-primary-soft")}>
                    <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ───────── Phone "More" sheet ───────── */}
      <Dialog open={moreOpen} onClose={closeMore} title="More">
        <nav aria-label="More">
          <ul className="space-y-2">
            {MORE.map(({ href, label, hint, icon: Icon, tone }) => {
              const active = matches(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={closeMore}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 items-center gap-4 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-surface-2",
                      active && "border-primary bg-primary-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        tone === "danger" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
                      )}
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-fg">{label}</span>
                      <span className="block text-sm text-muted">{hint}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6">
          <ThemeToggle />
        </div>
        <p className="mt-6 rounded-2xl bg-surface-2 p-4 text-[0.9375rem] leading-relaxed text-muted">{HONESTY_NOTE}</p>
      </Dialog>
    </div>
  );
}
