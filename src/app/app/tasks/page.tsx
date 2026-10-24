import type { Metadata } from "next";
import { TaskPanel } from "@/components/tasks/task-panel";

export const metadata: Metadata = { title: "Agent tasks" };

export default function TasksPage() {
  return <TaskPanel />;
}
