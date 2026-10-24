import "server-only";
import { getDb, nowIso, one } from "./db";
import { getRepository, repoToken } from "./github/connection";
import { commitToNewBranch, createPullRequest, getAuthenticatedRepoPermission, type FileChange } from "./github/api";
import { computeChanges, requireProject } from "./projects";
import { readFile, snapshotBaseline } from "./workspace/fs";

export type PublishInput = {
  branch: string;
  commitMessage: string;
  prTitle?: string;
  prBody?: string;
  createPr: boolean;
};

export function sanitizeBranchName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[^A-Za-z0-9._/-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!cleaned || cleaned === "HEAD" || cleaned.includes("..") || cleaned.startsWith("/")) {
    throw Object.assign(new Error("Invalid branch name."), { status: 422 });
  }
  return cleaned;
}

/**
 * Publish workspace changes to a NEW GitHub branch. Never writes to the
 * repository default branch, and requires an approved change record.
 */
export async function publishChange(
  userId: string,
  changeId: string,
  input: PublishInput,
): Promise<{ branch: string; commitSha: string; commitUrl: string; prUrl: string | null }> {
  const change = one<any>("SELECT * FROM changes WHERE id = ? AND user_id = ?", changeId, userId);
  if (!change) throw Object.assign(new Error("Change not found."), { status: 404 });
  if (change.status !== "approved") {
    throw Object.assign(
      new Error("This change must be reviewed and approved before it can be published."),
      { status: 409 },
    );
  }
  const project = requireProject(userId, change.project_id);
  if (!project.repository_id) {
    throw Object.assign(new Error("This project is not linked to a GitHub repository. Link one first."), { status: 400 });
  }
  const repository = getRepository(userId, project.repository_id);
  if (!repository) throw Object.assign(new Error("The linked GitHub repository is no longer accessible. Sync repositories first."), { status: 404 });

  const branch = sanitizeBranchName(input.branch);
  if (branch === repository.default_branch) {
    throw Object.assign(
      new Error("Refusing to publish directly to the default branch. Choose a new branch name."),
      { status: 422 },
    );
  }
  if (!input.commitMessage.trim() || input.commitMessage.length > 500) {
    throw Object.assign(new Error("A commit message (1-500 characters) is required."), { status: 422 });
  }

  const token = await repoToken(repository, userId);
  const permission = await getAuthenticatedRepoPermission(token, repository.full_name);
  if (!permission.push) {
    throw Object.assign(
      new Error("Your GitHub authorization does not include write access to this repository. Request read-only mode or update the GitHub App permissions."),
      { status: 403 },
    );
  }

  const diffs = await computeChanges(userId, project.id);
  const publishable = diffs.filter((d) => d.publishable);
  if (!publishable.length) {
    throw Object.assign(new Error("There are no publishable changes. Secret files such as .env are never pushed."), { status: 400 });
  }
  const files: FileChange[] = [];
  for (const diff of publishable) {
    if (diff.status === "deleted") {
      files.push({ path: diff.path, delete: true });
    } else {
      files.push({ path: diff.path, content: await readFile(userId, project.id, diff.path) });
    }
  }

  const committed = await commitToNewBranch(token, repository.full_name, {
    baseBranch: project.default_branch || repository.default_branch,
    newBranch: branch,
    message: `${input.commitMessage.trim()}\n\nGenerated with X-Flex (free-only policy).`,
    files,
  });

  let prUrl: string | null = null;
  if (input.createPr) {
    const pr = await createPullRequest(token, repository.full_name, {
      title: (input.prTitle || input.commitMessage).slice(0, 200),
      head: branch,
      base: project.default_branch || repository.default_branch,
      body:
        input.prBody ??
        `Prepared with X-Flex.\n\nFiles changed: ${publishable.length}.\n\nReview the diff and test output before merging.`,
    });
    prUrl = pr.html_url;
  }

  getDb()
    .prepare(
      `UPDATE changes SET status = 'published', published_at = ?, pr_url = ?, branch = ?, commit_message = ? WHERE id = ?`,
    )
    .run(nowIso(), prUrl, branch, input.commitMessage, changeId);
  await snapshotBaseline(userId, project.id);
  return { branch: committed.branch, commitSha: committed.commitSha, commitUrl: committed.commitUrl, prUrl };
}
