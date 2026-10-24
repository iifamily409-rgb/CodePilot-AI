import type { Metadata } from "next";
import { RepoList } from "@/components/repos/repo-list";

export const metadata: Metadata = { title: "Repositories" };

export default function RepositoriesPage() {
  return <RepoList />;
}
