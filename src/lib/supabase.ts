"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Supabase는 진행 상황/오답노트/통계를 기기 간 동기화하는 용도로만 쓴다.
 * 환경변수가 설정되지 않은 경우(로컬 개발 초기 등)에는 null을 반환하고,
 * 호출부에서 항상 null 체크 후 "동기화 불가" 안내로 대체한다.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}
