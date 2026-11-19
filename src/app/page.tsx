import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-app" />}>
      <Dashboard />
    </Suspense>
  );
}
