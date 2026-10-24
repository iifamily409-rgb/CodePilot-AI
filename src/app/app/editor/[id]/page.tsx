import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { requireProject } from "@/lib/projects";
import { CodeEditor } from "@/components/editor/code-editor";

export const metadata: Metadata = { title: "Editor" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  requireProject(auth.user.id, id);
  return <CodeEditor projectId={id} />;
}
