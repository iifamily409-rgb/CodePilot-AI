import type { Metadata } from "next";
import { ResearchPanel } from "@/components/research/research-panel";

export const metadata: Metadata = { title: "Web research" };

export default function ResearchPage() {
  return <ResearchPanel />;
}
