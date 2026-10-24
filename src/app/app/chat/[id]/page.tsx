import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/chat/workspace";

export const metadata: Metadata = { title: "AI Chat" };

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatWorkspace initialChatId={id} />;
}
