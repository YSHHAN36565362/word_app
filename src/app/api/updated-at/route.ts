import { NextResponse } from "next/server";
import { githubLastCommitDate } from "@/lib/github";

export const revalidate = 600;

// word_list 폴더가 아닌 나머지(앱 코드·설정)를 대표하는 경로들. GitHub 커밋 API는 "이 경로를
// 제외하고"를 지원하지 않아서, 최상위 항목을 직접 나열해 그중 가장 늦은 커밋 시각을 쓴다.
const PROGRAM_PATHS = ["src", "public", "supabase", "scripts", "next.config.ts", "package.json"];

/**
 * 화면 오른쪽 위에 보이는 "단어장 / 프로그램" 마지막 수정 시각.
 * word_list 안의 파일이 바뀐 커밋 → 단어장, 그 밖의 파일이 바뀐 커밋 → 프로그램.
 * GitHub API를 못 쓰면(환경변수 없음, 한도 초과 등) 빌드 때 계산해 둔 값으로 대신한다.
 */
export async function GET() {
  const [wordlist, program] = await Promise.all([
    githubLastCommitDate(["word_list"]),
    githubLastCommitDate(PROGRAM_PATHS),
  ]);
  return NextResponse.json({
    wordlist: wordlist || process.env.NEXT_PUBLIC_WORDLIST_UPDATED_AT || "",
    program: program || process.env.NEXT_PUBLIC_PROGRAM_UPDATED_AT || "",
  });
}
