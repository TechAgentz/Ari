"use client";

import { AudioLines, BookOpen, History, House, LifeBuoy, MessageCircle, Settings, SmilePlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { APP } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/chat", label: "Talk", icon: MessageCircle },
  { href: "/voice", label: "Voice", icon: AudioLines },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/mood", label: "Mood", icon: SmilePlus },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];
const MOBILE_NAV = NAV.slice(0, 5);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2" aria-label={`${APP.name} home`}>
          <Logo />
          <div>
            <p className="font-serif text-xl font-semibold leading-none">{APP.name}</p>
            <p className="mt-1 text-xs text-muted">Guest · Demo mode</p>
          </div>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-2xl px-3 text-[0.95rem] font-medium transition-colors duration-200",
                  active ? "bg-primary-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} strokeWidth={1.9} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <Link
            href="/support"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3 text-sm transition-colors hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">Need help now?</span>
              <span className="block text-xs text-muted">Crisis lines, 24/7</span>
            </span>
          </Link>
          <p className="px-2 text-xs leading-relaxed text-subtle">
            {APP.companion} is an AI, not a licensed psychologist. No account, no payments — data stays in this browser.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${APP.name} home`}>
          <Logo size={30} />
          <span className="font-serif text-lg font-semibold">{APP.name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/history" aria-label="Conversation history" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <History className="h-5 w-5" />
          </Link>
          <Link href="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <Settings className="h-5 w-5" />
          </Link>
          <Link href="/support" className="ml-1 flex h-9 items-center gap-1.5 rounded-full bg-danger-soft px-3 text-sm font-semibold text-danger">
            <LifeBuoy className="h-4 w-4" />
            Get help
          </Link>
        </div>
      </header>

      {/* Bottom padding keeps content clear of the fixed mobile nav (0 on desktop). */}
      <main id="main" className="relative z-10 pb-[var(--bottomnav-h)] lg:pl-64">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", active ? "text-primary" : "text-muted")}
                >
                  <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}>
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
