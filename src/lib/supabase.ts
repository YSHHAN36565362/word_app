"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; key: string }> | null = null;

/**
 * Supabase는 진행 상황/오답노트/통계를 기기 간 동기화하는 용도로만 쓴다.
 * 환경변수가 설정되지 않았거나 값이 잘못된 경우에는 null을 반환하고,
 * 호출부에서 항상 null 체크 후 "동기화 불가" 안내로 대체한다.
 *
 * 브라우저 클라이언트이므로 서버(빌드 시 prerender 포함)에서는 절대 만들지 않는다 —
 * createClient()는 URL 형식이 잘못되면 즉시 예외를 던지는데, 렌더링 도중(컴포넌트
 * 바디)에서 호출되면 그 예외가 그대로 next build의 정적 페이지 생성을 실패시킨다.
 */
async function resolveConfig(): Promise<{ url: string; key: string }> {
  // 가장 흔한 경우: NEXT_PUBLIC_ 접두사로 설정돼 있으면 빌드 시 이미 번들에 박혀있으니
  // 네트워크 요청 없이 바로 씀.
  const buildUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const buildKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (buildUrl && buildKey) return { url: buildUrl, key: buildKey };

  // Vercel Integration이 다른 이름(STORAGE_ 접두사 등)으로 심어준 경우는 클라이언트
  // 번들에 아예 안 들어있으므로, 서버가 대신 읽어서 알려주는 /api/config에 물어본다.
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return { url: "", key: "" };
    const data = await res.json();
    return { url: data.supabaseUrl || "", key: data.supabaseAnonKey || "" };
  } catch {
    return { url: "", key: "" };
  }
}

/** 비동기 버전. progress.ts의 모든 함수가 이미 async라 여기로 통일했다. */
export async function getSupabaseAsync(): Promise<SupabaseClient | null> {
  if (typeof window === "undefined") return null;
  if (client) return client;
  if (!configPromise) configPromise = resolveConfig();
  const { url, key } = await configPromise;
  if (!url || !key) return null;
  try {
    client = createClient(url, key);
  } catch (e) {
    console.error("[Supabase] createClient 실패 — URL/키 형식을 확인하세요:", e);
    return null;
  }
  return client;
}

/**
 * "번호를 저장했는데 이어하기/동기화가 안 된다"는 문제는 대부분 여기 로그 한 줄로
 * 원인이 드러난다 — 지금까지는 upsert/select 실패 시 반환값(false/null)만 조용히
 * 돌려줘서, 브라우저 콘솔을 봐도 아무 단서가 없었다(예: progress 테이블의 기본키가
 * 예전 스키마(user_id, part)로 남아있는데 코드는 (user_id, part, file_key)로 upsert를
 * 시도하면 Postgrest가 "on conflict 대상과 일치하는 제약이 없다"는 에러를 주지만,
 * 그 에러가 어디에도 찍히지 않았다). 앞으로는 실패할 때마다 콘솔에 원인을 남긴다.
 */
export function logSupabaseError(context: string, error: { message?: string; code?: string; details?: string } | null): void {
  if (!error) return;
  console.error(`[Supabase] ${context} 실패:`, error.code ? `(${error.code}) ${error.message}` : error, error.details ?? "");
}
