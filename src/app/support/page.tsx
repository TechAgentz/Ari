import { ExternalLink, HeartHandshake, Phone, ShieldAlert, Wind } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/primitives";
import { APP } from "@/lib/config";
import { ABUSE_RESOURCES, CRISIS_RESOURCES, EMERGENCY_NUMBERS, type CrisisResource } from "@/lib/safety/resources";

export const metadata: Metadata = { title: "Get help now" };

function ResourceList({ items }: { items: CrisisResource[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((r) => (
        <li key={`${r.region}-${r.name}`}>
          <Card className="h-full p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{r.region}</p>
            <h3 className="mt-1 font-semibold">{r.name}</h3>
            <p className="mt-1 text-sm text-muted">{r.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.actions.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  target={a.href.startsWith("http") ? "_blank" : undefined}
                  rel={a.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-danger-soft px-4 text-sm font-semibold text-danger transition-opacity hover:opacity-85"
                >
                  {a.href.startsWith("http") ? <ExternalLink className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
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
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader
        eyebrow="Get help now"
        title="You deserve support from a real person"
        description={`${APP.companion} is a ${APP.role} and can't help in an emergency. These free, confidential services can — any time of day or night.`}
      />

      <div role="alert" className="flex items-start gap-4 rounded-3xl border border-danger/30 bg-danger-soft p-5 sm:p-6">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
        <div>
          <h2 className="font-semibold">If you or someone else is in immediate danger</h2>
          <p className="mt-1 text-sm leading-relaxed">Call your local emergency number now, or go to the nearest emergency department.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {EMERGENCY_NUMBERS.map((e) => (
              <li key={e.region}>
                <a href={`tel:${e.number}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-semibold text-danger">
                  <Phone className="h-3.5 w-3.5" /> {e.number} <span className="font-normal text-muted">{e.region}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold">Crisis & emotional support lines</h2>
        <ResourceList items={CRISIS_RESOURCES} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold">If you&apos;re experiencing abuse</h2>
        <ResourceList items={ABUSE_RESOURCES} />
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <Wind className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Need to steady yourself first?</h2>
          <p className="mt-1 text-sm text-muted">A slow-breathing guide can help your body settle while you decide what to do next.</p>
          <Link href="/library/paced-breathing" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            Open the breathing guide →
          </Link>
        </Card>
        <Card className="p-6">
          <HeartHandshake className="h-6 w-6 text-accent" />
          <h2 className="mt-3 font-semibold">Worried about someone else?</h2>
          <p className="mt-1 text-sm text-muted">It&apos;s okay to ask directly if they&apos;re thinking about suicide — it doesn&apos;t put the idea in their head.</p>
          <Link href="/library/supporting-someone" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            How to support someone →
          </Link>
        </Card>
      </section>

      <p className="mt-10 text-xs leading-relaxed text-subtle">
        Numbers listed were verified against each service&apos;s official information for this demo (November 2026). Services can change — if a number doesn&apos;t work, use findahelpline.com or your local emergency number.
      </p>
    </div>
  );
}
