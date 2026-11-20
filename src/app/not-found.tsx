import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-app max-w-md flex-col items-center justify-center px-5 text-center lg:min-h-dvh">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-serif text-3xl font-semibold">This page wandered off</h1>
      <p className="mt-2 text-muted">Let&apos;s get you somewhere calmer.</p>
      <ButtonLink href="/" size="lg" className="mt-6">
        Back home
      </ButtonLink>
    </div>
  );
}
