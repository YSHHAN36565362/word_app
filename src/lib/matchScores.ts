"use client";

import { getSupabaseAsync } from "./supabase";

/** 매칭 게임의 파일 조합별 최고 기록(가장 빠른 완료 시간, ms). */

export async function loadBestTime(userId: string, fileKey: string): Promise<number | null> {
  if (!userId) return null;
  const supabase = await getSupabaseAsync();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("match_scores")
    .select("best_ms")
    .eq("user_id", userId)
    .eq("file_key", fileKey)
    .maybeSingle();
  if (error || !data) return null;
  return data.best_ms as number;
}

/** 이전 기록보다 빠를 때만 갱신한다. 갱신됐으면 true를 돌려준다(신기록 표시용). */
export async function saveBestTimeIfFaster(userId: string, fileKey: string, ms: number): Promise<boolean> {
  if (!userId) return false;
  const supabase = await getSupabaseAsync();
  if (!supabase) return false;
  const existing = await loadBestTime(userId, fileKey);
  if (existing !== null && existing <= ms) return false;
  await supabase
    .from("match_scores")
    .upsert({ user_id: userId, file_key: fileKey, best_ms: ms, updated_at: new Date().toISOString() }, { onConflict: "user_id,file_key" });
  return true;
}

export function formatMs(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
