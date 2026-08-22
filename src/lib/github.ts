import "server-only";

/**
 * GitHub Contents API 래퍼. 반드시 서버(Route Handler)에서만 import 할 것.
 * word_test 저장소가 public이라 토큰 없이도 읽기는 되지만, 토큰을 넣어두면
 * 시간당 요청 한도가 60회 -> 5,000회로 늘어나 30명이 몰려도 안전하다.
 * 쓰기(단어장 추가, 부수 사전 편집)는 토큰이 반드시 필요하다.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  return v;
}

function owner() {
  return requireEnv("GITHUB_OWNER");
}
function repo() {
  return requireEnv("GITHUB_REPO");
}
function branch() {
  return process.env.GITHUB_BRANCH || "main";
}
function token() {
  return process.env.GITHUB_TOKEN || "";
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  const t = token();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export interface GhContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
}

export async function githubGetContents(
  path: string,
  revalidateSeconds = 300
): Promise<{ status: number; data: GhContentItem[] | (GhContentItem & { content?: string }) | null }> {
  const url = `https://api.github.com/repos/${owner()}/${repo()}/contents/${encodePath(
    path
  )}?ref=${encodeURIComponent(branch())}`;
  try {
    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: revalidateSeconds },
    });
    if (res.status !== 200) return { status: res.status, data: null };
    const data = await res.json();
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

export async function getDirNames(path: string): Promise<string[]> {
  const { status, data } = await githubGetContents(path);
  if (status !== 200 || !Array.isArray(data)) return [];
  return data
    .filter((item) => item.type === "dir")
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function getTxtFiles(path: string): Promise<string[]> {
  const { status, data } = await githubGetContents(path);
  if (status !== 200 || !Array.isArray(data)) return [];
  return data
    .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".txt"))
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function getFileContent(path: string, revalidateSeconds = 300): Promise<string> {
  const { status, data } = await githubGetContents(path, revalidateSeconds);
  if (status !== 200 || !data || Array.isArray(data) || !("content" in data) || !data.content) return "";
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/** 캐시를 타지 않고 항상 최신 sha를 조회한다 (덮어쓰기 직전에 필수). */
async function getRemoteFileSha(path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner()}/${repo()}/contents/${encodePath(
    path
  )}?ref=${encodeURIComponent(branch())}`;
  try {
    const res = await fetch(url, { headers: headers(), cache: "no-store" });
    if (res.status !== 200) return null;
    const data = await res.json();
    return data.sha ?? null;
  } catch {
    return null;
  }
}

export async function uploadTextToGithub(
  folderPath: string,
  fileName: string,
  textContent: string
): Promise<{ ok: boolean; status: number; path: string; message?: string }> {
  const repoPath = `${folderPath.trim()}/${fileName.trim()}`;
  const url = `https://api.github.com/repos/${owner()}/${repo()}/contents/${encodePath(repoPath)}`;
  const contentB64 = Buffer.from(textContent, "utf-8").toString("base64");

  const existingSha = await getRemoteFileSha(repoPath);

  const buildBody = (sha: string | null) => ({
    message: `${sha ? "Update" : "Add"} file: ${repoPath}`,
    content: contentB64,
    branch: branch(),
    ...(sha ? { sha } : {}),
  });

  let res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(existingSha)),
  });

  if (res.status === 422) {
    const text = await res.text();
    if (text.toLowerCase().includes("sha")) {
      const retrySha = await getRemoteFileSha(repoPath);
      if (retrySha && retrySha !== existingSha) {
        res = await fetch(url, {
          method: "PUT",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(buildBody(retrySha)),
        });
      }
    }
  }

  if (res.status === 200 || res.status === 201) {
    return { ok: true, status: res.status, path: repoPath };
  }
  const message = await res.text().catch(() => "");
  return { ok: false, status: res.status, path: repoPath, message: message.slice(0, 300) };
}

export async function deleteFileFromGithub(repoPath: string): Promise<boolean> {
  const sha = await getRemoteFileSha(repoPath);
  if (!sha) return false;
  const url = `https://api.github.com/repos/${owner()}/${repo()}/contents/${encodePath(repoPath)}`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Remove file: ${repoPath}`, sha, branch: branch() }),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}
