import type { Metadata } from "next";
import { ModelExplorer } from "@/components/models/model-explorer";

export const metadata: Metadata = { title: "Model explorer" };

export default function ModelsPage() {
  return <ModelExplorer />;
}
