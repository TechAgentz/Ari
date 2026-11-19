import type { Metadata } from "next";
import { Suspense } from "react";
import { MoodScreen } from "@/components/mood/mood-screen";

export const metadata: Metadata = { title: "Daily mood check-in" };

export default function MoodPage() {
  return (
    <Suspense fallback={<div className="min-h-app" />}>
      <MoodScreen />
    </Suspense>
  );
}
