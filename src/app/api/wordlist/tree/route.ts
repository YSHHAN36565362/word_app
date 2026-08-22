import { NextResponse } from "next/server";
import { getDirNames, getTxtFiles } from "@/lib/github";
import { CategoryNode, FileRef } from "@/lib/types";

export const revalidate = 300;

/**
 * word_list 폴더 전체를 순회해서 { 대분류 -> [세부카테고리 -> 파일들]} 트리를 만든다.
 * Next.js의 fetch 캐시(revalidate)가 요청을 공유하므로, 학생 30명이 동시에 접속해도
 * 실제 GitHub 호출은 5분에 한 번 정도만 일어난다.
 */
export async function GET() {
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
