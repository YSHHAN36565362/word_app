import { NextResponse } from "next/server";
import { githubGetContents, getDirNames, getTxtFiles } from "@/lib/github";
import { CategoryNode, FileRef } from "@/lib/types";

export const revalidate = 300;

/**
 * word_list 폴더 전체를 순회해서 { 대분류 -> [세부카테고리 -> 파일들]} 트리를 만든다.
 * Next.js의 fetch 캐시(revalidate)가 요청을 공유하므로, 학생 30명이 동시에 접속해도
 * 실제 GitHub 호출은 5분에 한 번 정도만 일어난다.
 *
 * 최상위 word_list 조회가 실패하면(환경변수 누락, GitHub API 요청 한도 초과 등) 이유를
 * 함께 돌려준다 — 그냥 "폴더 없음"으로 보이면 원인을 알 수 없기 때문.
 */
export async function GET() {
  const top = await githubGetContents("word_list");
  if (top.status !== 200 || !Array.isArray(top.data)) {
    const reason =
      top.error ??
      (top.status === 403
        ? "GitHub API 요청 한도를 초과했습니다. GITHUB_TOKEN 환경변수를 설정하면 한도가 늘어납니다."
        : top.status === 404
        ? "word_list 폴더를 찾을 수 없습니다 (GITHUB_OWNER/GITHUB_REPO/GITHUB_BRANCH 설정을 확인하세요)."
        : `GitHub API 오류가 발생했습니다 (status: ${top.status}).`);
    return NextResponse.json({ categories: [], error: reason }, { status: 200 });
  }

  const mainCats = await getDirNames("word_list");
  const categories: CategoryNode[] = [];

  for (const main of mainCats) {
    const subNames = await getDirNames(`word_list/${main}`);
    if (subNames.length > 0) {
      const subfolders = [];
      for (const sub of subNames) {
        const path = `word_list/${main}/${sub}`;
        const files = await getTxtFiles(path);
        const fileRefs: FileRef[] = files.map((f) => ({
          path: `${path}/${f}`,
          label: `[${sub}] ${f}`,
          filename: f,
        }));
        subfolders.push({ name: sub, files: fileRefs });
      }
      categories.push({ name: main, subfolders, files: [] });
    } else {
      const path = `word_list/${main}`;
      const files = await getTxtFiles(path);
      const fileRefs: FileRef[] = files.map((f) => ({
        path: `${path}/${f}`,
        label: f,
        filename: f,
      }));
      categories.push({ name: main, subfolders: [], files: fileRefs });
    }
  }

  return NextResponse.json({ categories });
}
