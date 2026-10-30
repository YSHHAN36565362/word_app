import "server-only";

/**
 * GitHub Contents API 래퍼. 반드시 서버(Route Handler)에서만 import 할 것.
 * word_test 저장소가 public이라 토큰 없이도 읽기는 되지만, 토큰을 넣어두면
 * 시간당 요청 한도가 60회 -> 5,000회로 늘어나 30명이 몰려도 안전하다.
 * 쓰기(단어장 추가)는 토큰이 반드시 필요하다.
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
): Promise<{ status: number; data: GhContentItem[] | (GhContentItem & { content?: string }) | null; error?: string }> {
  let url: string;
  try {
    // owner()/repo()가 필요한 환경변수(GITHUB_OWNER/GITHUB_REPO)를 요구하는데, 이 호출을
    // try 밖에 두면 env가 비어있을 때 던지는 예외가 라우트 핸들러까지 그대로 올라가
    // API 전체가 500으로 죽는다(빈 목록이 아니라 페이지 자체가 깨짐). 여기서 잡아서
    // 항상 {status, data} 형태로만 돌려주도록 한다.
    url = `https://api.github.com/repos/${owner()}/${repo()}/contents/${encodePath(
      path
    )}?ref=${encodeURIComponent(branch())}`;
  } catch (e) {
    return { status: -1, data: null, error: e instanceof Error ? e.message : "GitHub 설정 오류" };
  }
  try {
    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: revalidateSeconds },
    });
    if (res.status !== 200) {
      let error: string | undefined;
      try {
        const body = await res.json();
        error = body?.message;
      } catch {
        /* 응답이 JSON이 아니면 무시 */
      }
      return { status: res.status, data: null, error };
    }
    const data = await res.json();
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null, error: "GitHub API 요청에 실패했습니다 (네트워크 오류)." };
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

/**
 * 지정한 경로(들) 중 하나라도 바꾼 가장 최근 커밋의 시각(ISO)을 돌려준다. 실패하면 null.
 * 경로마다 커밋 목록을 1건씩 조회해서 그중 가장 늦은 값을 쓴다.
 *
 * 저장소는 Vercel이 자동으로 넣어 주는 VERCEL_GIT_REPO_OWNER/SLUG(= 지금 배포 중인 앱의 저장소)를
 * 먼저 쓰고, 없으면 GITHUB_OWNER/GITHUB_REPO를 쓴다. 토큰이 잘못돼 401이 나면 토큰 없이 한 번 더
 * 시도한다(공개 저장소는 토큰 없이도 읽힌다).
 */
export async function githubLastCommitDate(paths: string[], revalidateSeconds = 600): Promise<string | null> {
  let base: string;
  try {
    const o = process.env.VERCEL_GIT_REPO_OWNER || owner();
    const r = process.env.VERCEL_GIT_REPO_SLUG || repo();
    base = `https://api.github.com/repos/${o}/${r}/commits`;
  } catch {
    return null;
  }
  const query = async (p: string, withToken: boolean): Promise<Response> => {
    const h = headers();
    if (!withToken) delete h.Authorization;
    return fetch(`${base}?sha=${encodeURIComponent(branch())}&path=${encodeURIComponent(p)}&per_page=1`, {
      headers: h,
      next: { revalidate: revalidateSeconds },
    });
  };
  const dates = await Promise.all(
    paths.map(async (p) => {
      try {
        let res = await query(p, true);
        if (res.status === 401) res = await query(p, false);
        if (res.status !== 200) return null;
        const list = await res.json();
        return (list?.[0]?.commit?.committer?.date as string | undefined) ?? null;
      } catch {
        return null;
      }
    })
  );
  const valid = dates.filter((d): d is string => !!d).sort();
  return valid.length ? valid[valid.length - 1] : null;
}
