"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Supabase는 진행 상황/오답노트/통계를 기기 간 동기화하는 용도로만 쓴다.
 * 환경변수가 설정되지 않았거나(로컬 개발 초기 등) 값이 잘못된 경우에는 null을 반환하고,
 * 호출부에서 항상 null 체크 후 "동기화 불가" 안내로 대체한다.
 *
 * 브라우저 클라이언트이므로 서버(빌드 시 prerender 포함)에서는 절대 만들지 않는다 —
 * createClient()는 URL 형식이 잘못되면(예: NEXT_PUBLIC_SUPABASE_URL에 https:// 누락) 즉시
 * 예외를 던지는데, 이 함수가 렌더링 도중(컴포넌트 바디)에서 호출되면 그 예외가 그대로
 * Next.js의 정적 페이지 생성(next build)을 실패시킨다. typeof window 가드 + try/catch로
 * 둘 다 방어한다.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    client = createClient(url, key);
  } catch {
    return null;
  }
  return client;
}
