import type { Metadata } from "next";
import { HistoryScreen } from "@/components/history-screen";

export const metadata: Metadata = { title: "Past conversations" };

export default function HistoryPage() {
  return <HistoryScreen />;
}
