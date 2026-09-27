import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * word_list 폴더가 이제 이 저장소(word_app) 루트에 직접 들어있으므로,
 * GitHub API를 거치지 않고 Node.js 파일시스템으로 바로 읽는다.
 * 토큰도, 네트워크 요청도 필요 없다. 로컬 개발과 Vercel 배포 양쪽에서 동작한다.
 *
 * 주의(읽기 전용): 이 함수들은 읽기만 한다. Vercel의 서버리스 함수는 배포 후
 * 파일시스템이 읽기 전용이라, 단어장 업로드처럼 "쓰기"가 필요한 기능은
 * 여전히 github.ts의 uploadTextToGithub()로 GitHub API를 통해 해야 한다.
 */

function resolvePath(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

export async function getDirNamesLocal(relPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(resolvePath(relPath), { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function getTxtFilesLocal(relPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(resolvePath(relPath), { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function getFileContentLocal(relPath: string): Promise<string> {
  try {
    return await fs.readFile(resolvePath(relPath), "utf-8");
  } catch {
    return "";
  }
}

export async function pathExistsLocal(relPath: string): Promise<boolean> {
  try {
    await fs.access(resolvePath(relPath));
    return true;
  } catch {
    return false;
  }
}