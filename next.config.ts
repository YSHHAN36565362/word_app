//import type { NextConfig } from "next";

//const nextConfig: NextConfig = {
  /* config options here */
//};

//export default nextConfig;

import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// 화면 오른쪽 위에 표시할 "마지막 단어장 업데이트" 시각(ISO). word_list 폴더를 마지막으로 바꾼
// 커밋의 시각을 쓰고, git 이력이 없는 빌드 환경이면 파일 수정 시각 중 가장 늦은 값으로 대신한다.
function wordListUpdatedAt(): string {
  try {
    const iso = execSync("git log -1 --format=%cI -- word_list", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (iso) return iso;
  } catch {
    /* git이 없거나 이력이 없으면 아래 대체 경로 */
  }
  let latest = 0;
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else latest = Math.max(latest, fs.statSync(full).mtimeMs);
    }
  };
  try {
    walk(path.join(process.cwd(), "word_list"));
  } catch {
    /* word_list가 없으면 표시하지 않는다 */
  }
  return latest ? new Date(latest).toISOString() : "";
}

// 프로그램(앱 코드) 마지막 수정 시각: 단어장·로그 폴더를 뺀 나머지를 바꾼 가장 최근 커밋의 시각.
function programUpdatedAt(): string {
  try {
    return execSync("git log -1 --format=%cI -- . ':(exclude)word_list' ':(exclude)log'", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_PROGRAM_UPDATED_AT: programUpdatedAt(),
    NEXT_PUBLIC_WORDLIST_UPDATED_AT: wordListUpdatedAt(),
  },
  // word_list는 fs.readFile(런타임 문자열 경로)로 읽기 때문에, Vercel의 정적 분석이
  // 이 폴더를 자동으로 감지하지 못한다. 명시적으로 포함시키지 않으면 로컬에선
  // 정상 동작하다가 배포본에서만 "파일을 찾을 수 없음"으로 실패한다.
  outputFileTracingIncludes: {
    "/api/wordlist/**": ["./word_list/**/*"],
  },
};

export default nextConfig;