import { NextResponse } from "next/server";
import { getDirNamesLocal, getTxtFilesLocal, pathExistsLocal } from "@/lib/wordlist-fs";
import { CategoryNode, FileRef } from "@/lib/types";

export const revalidate = 300;

/**
 * word_list 폴더 전체를 순회해서 { 대분류 -> [세부카테고리 -> 파일들]} 트리를 만든다.
 * word_list는 이 저장소(word_app) 루트에 들어 있으므로 GitHub API 없이 파일시스템으로 읽는다.
 *
 * word_list 폴더가 없으면(배포에 포함되지 않았거나 경로가 틀린 경우) 이유를 함께 돌려준다 —
 * 그냥 "폴더 없음"으로 보이면 원인을 알 수 없기 때문.
 */
export async function GET() {
  if (!(await pathExistsLocal("word_list"))) {
    return NextResponse.json(
      { categories: [], error: "word_list 폴더를 찾을 수 없습니다 (word_app 루트에 word_list 폴더가 있는지 확인하세요)." },
      { status: 200 }
    );
  }

  const mainCats = (await getDirNamesLocal("word_list")).sort((a, b) => {
    // "Japanese"를 항상 맨 앞에 둔다 (가장 자주 쓰는 카테고리라 기본 선택도 이걸로 감).
    // 나머지는 원래대로 이름순.
    if (a === "Japanese") return -1;
    if (b === "Japanese") return 1;
    return a.localeCompare(b);
  });
  const categories: CategoryNode[] = [];

  for (const main of mainCats) {
    const subNames = await getDirNamesLocal(`word_list/${main}`);
    if (subNames.length > 0) {
      const subfolders = [];
      for (const sub of subNames) {
        const path = `word_list/${main}/${sub}`;
        const files = await getTxtFilesLocal(path);
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
      const files = await getTxtFilesLocal(path);
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
