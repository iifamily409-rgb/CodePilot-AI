import type { Metadata } from "next";
import { getAuth } from "@/lib/auth";
import { githubConfigured } from "@/lib/github/app";
import { ProjectList } from "@/components/projects/project-list";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  await getAuth();
  return <ProjectList githubConfigured={githubConfigured()} />;
}
