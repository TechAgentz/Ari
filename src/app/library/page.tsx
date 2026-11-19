import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/library/library-browser";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Psychology knowledge library" };

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader
        eyebrow="Psychology knowledge library"
        title="Understand what you're feeling"
        description="Short, evidence-informed guides and practical techniques, drawn from public health sources like the NHS, NIMH, WHO and APA. Ari uses this same library during conversations. Educational only — not medical advice."
      />
      <LibraryBrowser />
    </div>
  );
}
