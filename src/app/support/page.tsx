import { ChevronRight, ExternalLink, HeartHandshake, MessageSquareText, Phone, ShieldAlert, Wind } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { APP } from "@/lib/config";
import { ABUSE_RESOURCES, CRISIS_RESOURCES, EMERGENCY_NUMBERS, type CrisisResource } from "@/lib/safety/resources";

export const metadata: Metadata = { title: "Get help now" };

/** The first phone action of each crisis line, shown as a big "call now" card. */
const CALL_NOW = CRISIS_RESOURCES.flatMap((r) => {
  const call = r.actions.find((a) => a.href.startsWith("tel:"));
  return call ? [{ resource: r, call }] : [];
});

function ActionIcon({ href }: { href: string }) {
  if (href.startsWith("tel:")) return <Phone className="h-4 w-4" aria-hidden="true" />;
  if (href.startsWith("sms:")) return <MessageSquareText className="h-4 w-4" aria-hidden="true" />;
  return <ExternalLink className="h-4 w-4" aria-hidden="true" />;
}

function ResourceList({ items }: { items: CrisisResource[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((r) => (
        <li key={`${r.region}-${r.name}`}>
          <Card className="h-full p-5">
            <p className="text-sm font-medium text-muted">{r.region}</p>
            <h3 className="mt-0.5 text-lg font-semibold text-fg">{r.name}</h3>
            <p className="mt-1 text-base leading-relaxed text-muted">{r.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.actions.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  target={a.href.startsWith("http") ? "_blank" : undefined}
                  rel={a.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-danger-soft px-5 text-[0.9375rem] font-semibold text-danger transition-colors hover:bg-danger hover:text-white dark:hover:text-bg"
                >
                  <ActionIcon href={a.href} />
                  {a.label}
                </a>
              ))}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader
        eyebrow="Get help now"
        title="You deserve support from a real person"
        description={`${APP.companion} is a ${APP.role} and can't help in an emergency. These free, confidential services can, any time of day or night.`}
      />

      {/* Emergency numbers first: the fastest path for someone in danger. */}
      <section role="alert" aria-labelledby="emergency-title" className="rounded-3xl border border-danger/30 bg-danger-soft p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <h2 id="emergency-title" className="text-lg font-semibold text-fg">
              If you or someone else is in immediate danger
            </h2>
            <p className="mt-1 text-base leading-relaxed text-fg/85">Call your local emergency number now, or go to the nearest emergency department.</p>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EMERGENCY_NUMBERS.map((e) => (
            <li key={e.region}>
              <a
                href={`tel:${e.number}`}
                aria-label={`Call ${e.number}, emergency number for ${e.region}`}
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-soft transition-shadow hover:shadow-lift"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger text-white dark:text-bg">
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-bold leading-tight tabular-nums text-danger">{e.number}</span>
                  <span className="block truncate text-sm text-muted">{e.region}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Big call cards for the crisis lines. */}
      <section className="mt-8" aria-labelledby="call-now">
        <SectionTitle id="call-now" title="Talk to someone now" />
        <p className="-mt-1 mb-4 text-base text-muted">Free and confidential. Tap a card to call.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CALL_NOW.map(({ resource: r, call }) => (
            <li key={`${r.region}-${r.name}`}>
              <a
                href={call.href}
                className="flex min-h-20 items-center gap-4 rounded-3xl border border-border bg-surface p-4 shadow-soft transition-[box-shadow,border-color] duration-200 hover:border-danger/40 hover:shadow-lift"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold leading-snug text-fg">{call.label}</span>
                  <span className="block text-[0.9375rem] text-muted">
                    {r.name} · {r.region}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="all-lines">
        <SectionTitle id="all-lines" title="All crisis and support lines" />
        <p className="-mt-1 mb-4 text-base text-muted">Prefer to text or chat? Every option is here.</p>
        <ResourceList items={CRISIS_RESOURCES} />
      </section>

      <section className="mt-10" aria-labelledby="abuse-lines">
        <SectionTitle id="abuse-lines" title="If you're experiencing abuse" />
        <ResourceList items={ABUSE_RESOURCES} />
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link href="/library/paced-breathing" className="block">
          <Card interactive className="flex h-full items-start gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Wind className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold text-fg">Need to steady yourself first?</span>
              <span className="mt-1 block text-base leading-relaxed text-muted">A slow-breathing guide can help your body settle while you decide what to do next.</span>
              <span className="mt-2 inline-flex items-center gap-1 font-semibold text-primary">
                Open the breathing guide <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </span>
          </Card>
        </Link>
        <Link href="/library/supporting-someone" className="block">
          <Card interactive className="flex h-full items-start gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <HeartHandshake className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold text-fg">Worried about someone else?</span>
              <span className="mt-1 block text-base leading-relaxed text-muted">
                It&apos;s okay to ask directly if they&apos;re thinking about suicide. It doesn&apos;t put the idea in their head.
              </span>
              <span className="mt-2 inline-flex items-center gap-1 font-semibold text-primary">
                How to support someone <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </span>
          </Card>
        </Link>
      </section>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        Numbers listed were verified against each service&apos;s official information for this demo (November 2026). Services can change. If a number doesn&apos;t work, use findahelpline.com or your local emergency number.
      </p>
    </div>
  );
}
