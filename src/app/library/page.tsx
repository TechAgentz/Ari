import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/library/library-browser";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Exercises & guides" };

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader
        title="Exercises & guides"
        description="Short guides and calming exercises you can try right now. Based on trusted public health sources. For learning only, not medical advice."
      />
      <LibraryBrowser />
    </div>
  );
}
