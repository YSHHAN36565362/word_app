//import type { NextConfig } from "next";

//const nextConfig: NextConfig = {
  /* config options here */
//};

//export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // word_list는 fs.readFile(런타임 문자열 경로)로 읽기 때문에, Vercel의 정적 분석이
  // 이 폴더를 자동으로 감지하지 못한다. 명시적으로 포함시키지 않으면 로컬에선
  // 정상 동작하다가 배포본에서만 "파일을 찾을 수 없음"으로 실패한다.
  outputFileTracingIncludes: {
    "/api/wordlist/**": ["./word_list/**/*"],
  },
};

export default nextConfig;