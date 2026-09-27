import "server-only";

/**
 * word_list 데이터는 word_test 저장소(GITHUB_OWNER/GITHUB_REPO)에 있고,
 * word_app 로컬 파일시스템에는 복사본이 없다. 그래서 tree/route.ts와 동일하게
 * GitHub Contents API로 실시간 조회한다.
 *
 * 함수 이름(getDirNamesLocal 등)은 기존 호출부(route.ts, script/route.ts)를
 * 건드리지 않기 위해 그대로 유지했다 — 내부 구현만 "로컬 파일" -> "GitHub API"로 바뀜.
 *
 * Next.js의 fetch 캐시(revalidate: 300)를 사용하므로, 같은 경로에 대한 요청은
 * 5분에 한 번 정도만 실제 GitHub 호출로 이어진다.
 */

const OWNER = process.env.GITHUB_OWNER || "";
const REPO = process.env.GITHUB_REPO || "";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN || "";

interface GithubEntry {
  name: string;
  type: "file" | "dir";
  path: string;
}

interface GithubFileContent {
  content?: string;
  encoding?: string;
}

interface ContentsResult {
  status: number;
  data: GithubEntry[] | GithubFileContent | null;
}

function apiHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

async function fetchContents(relPath: string): Promise<ContentsResult> {
  if (!OWNER || !REPO) return { status: 500, data: null };

  const encodedPath = relPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}?ref=${encodeURIComponent(
    BRANCH
  )}`;

  try {
    const res = await fetch(url, {
      headers: apiHeaders(),
      next: { revalidate: 300 },
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

export async function getDirNamesLocal(relPath: string): Promise<string[]> {
  const { status, data } = await fetchContents(relPath);
  if (status !== 200 || !Array.isArray(data)) return [];
  return data
    .filter((e) => e.type === "dir")
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function getTxtFilesLocal(relPath: string): Promise<string[]> {
  const { status, data } = await fetchContents(relPath);
  if (status !== 200 || !Array.isArray(data)) return [];
  return data
    .filter((e) => e.type === "file" && e.name.toLowerCase().endsWith(".txt"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function getFileContentLocal(relPath: string): Promise<string> {
  const { status, data } = await fetchContents(relPath);
  if (status !== 200 || !data || Array.isArray(data)) return "";
  const file = data as GithubFileContent;
  if (!file.content) return "";
  try {
    return Buffer.from(file.content, (file.encoding as BufferEncoding) || "base64").toString(
      "utf-8"
    );
  } catch {
    return "";
  }
}

export async function pathExistsLocal(relPath: string): Promise<boolean> {
  const { status } = await fetchContents(relPath);
  return status === 200;
}
