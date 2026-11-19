import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";

export const metadata: Metadata = { title: "Talk with Ari" };

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-app lg:h-dvh" aria-busy="true" />}>
      <ChatScreen />
    </Suspense>
  );
}
