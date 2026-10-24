import "server-only";
import { GITHUB_API } from "./app";

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type GhOptions = {
  method?: string;
  body?: unknown;
  accept?: string;
  timeoutMs?: number;
};

/** Thin GitHub REST client. Tokens are only ever used server-side. */
export async function gh<T = any>(token: string, path: string, options: GhOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: options.accept ?? "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "CodePilotAI/0.1",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data?.message ??
      (res.status === 401
        ? "GitHub authorization is invalid or expired. Reconnect GitHub."
        : res.status === 403
          ? "GitHub refused the request. Check repository permissions or rate limits."
          : `GitHub request failed (HTTP ${res.status}).`);
    throw new GitHubError(message, res.status);
  }
  return data as T;
}

export type GhUser = { id: number; login: string; avatar_url: string; name?: string };
export type GhInstallation = {
  id: number;
  account: { login: string; type: string; avatar_url?: string };
  suspended?: boolean;
  permissions?: Record<string, string>;
};
export type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  language: string | null;
  permissions?: Record<string, boolean>;
};

export async function getViewer(token: string): Promise<GhUser> {
  return gh<GhUser>(token, "/user");
}

export async function listUserInstallations(token: string): Promise<GhInstallation[]> {
  const out: GhInstallation[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await gh<{ total_count: number; installations: GhInstallation[] }>(
      token,
      `/user/installations?per_page=100&page=${page}`,
    );
    out.push(...(data.installations ?? []));
    if (!data.installations || data.installations.length < 100) break;
  }
  return out;
}

export async function listInstallationRepos(
  token: string,
  installationId: string,
): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await gh<{ total_count: number; repositories: GhRepo[] }>(
      token,
      `/user/installations/${installationId}/repositories?per_page=100&page=${page}`,
    );
    out.push(...(data.repositories ?? []));
    if (!data.repositories || data.repositories.length < 100) break;
  }
  return out;
}

export async function listOAuthRepos(token: string): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await gh<GhRepo[]>(token, `/user/repos?per_page=100&page=${page}&sort=updated`);
    out.push(...data);
    if (data.length < 100) break;
  }
  return out;
}

export async function listBranches(token: string, fullName: string): Promise<string[]> {
  const data = await gh<Array<{ name: string }>>(token, `/repos/${fullName}/branches?per_page=100`);
  return data.map((b) => b.name);
}

export async function getRepo(token: string, fullName: string): Promise<GhRepo> {
  return gh<GhRepo>(token, `/repos/${fullName}`);
}

export async function getTree(
  token: string,
  fullName: string,
  ref: string,
): Promise<Array<{ path: string; type: string; size?: number; sha: string }>> {
  const repo = await getRepo(token, fullName);
  const branch = ref || repo.default_branch;
  const data = await gh<{ tree: Array<any>; truncated: boolean }>(
    token,
    `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  return (data.tree ?? []).filter((e) => e.type === "blob" || e.type === "tree");
}

export async function getFileContent(
  token: string,
  fullName: string,
  filePath: string,
  ref?: string,
): Promise<string> {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const data = await gh<any>(token, `/repos/${fullName}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}${q}`);
  if (Array.isArray(data)) throw new GitHubError("Requested path is a directory.", 400);
  if (data.encoding === "base64") return Buffer.from(data.content, "base64").toString("utf8");
  return String(data.content ?? "");
}

export async function searchCode(
  token: string,
  fullName: string,
  query: string,
): Promise<Array<{ path: string; fragment?: string }>> {
  const q = encodeURIComponent(`${query} repo:${fullName}`);
  try {
    const data = await gh<{ items: Array<any> }>(token, `/search/code?q=${q}&per_page=20`);
    return (data.items ?? []).map((i) => ({ path: i.path, fragment: i.text_matches?.[0]?.fragment }));
  } catch (error) {
    if (error instanceof GitHubError && error.status === 403) {
      throw new Error("GitHub code search is unavailable for this token (permission or rate limit).");
    }
    throw error;
  }
}

export type FileChange = { path: string; content?: string; delete?: boolean };

/**
 * Commit a set of file changes to a NEW branch using the Git Data API.
 * Never writes to the repository default branch.
 */
export async function commitToNewBranch(
  token: string,
  fullName: string,
  input: {
    baseBranch: string;
    newBranch: string;
    message: string;
    files: FileChange[];
  },
): Promise<{ branch: string; commitSha: string; commitUrl: string }> {
  if (!input.files.length) throw new GitHubError("No file changes to commit.", 400);
  const repo = await getRepo(token, fullName);
  if (input.newBranch === repo.default_branch) {
    throw new GitHubError("Refusing to commit directly to the default branch. Create a new branch.", 400);
  }
  const baseRef = await gh<any>(token, `/repos/${fullName}/git/ref/heads/${encodeURIComponent(input.baseBranch)}`);
  const baseSha = baseRef.object.sha;
  const baseCommit = await gh<any>(token, `/repos/${fullName}/git/commits/${baseSha}`);

  const entries = await Promise.all(
    input.files.map(async (file) => {
      if (file.delete) {
        return { path: file.path, mode: "100644", type: "blob", sha: null };
      }
      const blob = await gh<any>(token, `/repos/${fullName}/git/blobs`, {
        method: "POST",
        body: { content: Buffer.from(file.content ?? "", "utf8").toString("base64"), encoding: "base64" },
      });
      return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const tree = await gh<any>(token, `/repos/${fullName}/git/trees`, {
    method: "POST",
    body: { base_tree: baseCommit.tree.sha, tree: entries },
  });
  const commit = await gh<any>(token, `/repos/${fullName}/git/commits`, {
    method: "POST",
    body: { message: input.message, tree: tree.sha, parents: [baseSha] },
  });
  await gh(token, `/repos/${fullName}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${input.newBranch}`, sha: commit.sha },
  });
  return {
    branch: input.newBranch,
    commitSha: commit.sha,
    commitUrl: `https://github.com/${fullName}/commit/${commit.sha}`,
  };
}

export async function createPullRequest(
  token: string,
  fullName: string,
  input: { title: string; head: string; base: string; body?: string; draft?: boolean },
): Promise<{ number: number; html_url: string }> {
  return gh(token, `/repos/${fullName}/pulls`, {
    method: "POST",
    body: { ...input, head: input.head, base: input.base },
  });
}

export async function getAuthenticatedRepoPermission(
  token: string,
  fullName: string,
): Promise<{ admin: boolean; push: boolean; pull: boolean }> {
  const repo = await getRepo(token, fullName);
  return {
    admin: Boolean(repo.permissions?.admin),
    push: Boolean(repo.permissions?.push),
    pull: Boolean(repo.permissions?.pull),
  };
}
