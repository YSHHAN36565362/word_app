"use client";

import { getSupabaseAsync } from "./supabase";
import { StudyStatRecord, WordEntry } from "./types";
import { wordKey } from "./queue";
import { markTodayActive } from "./streak";

/**
 * Supabase에 저장하는 진행 상황/오답노트/통계 데이터 레이어.
 * 모든 함수는 Supabase 미설정 시 조용히 실패(false/null/[])하도록 만들어,
 * 서버 설정 전에도 앱 자체는 정상 동작하게 한다 (기존 Streamlit 앱과 동일한 철학).
 */

export async function saveProgress(userId: string, part: string, data: unknown): Promise<boolean> {
  if (!userId) return false;
  const supabase = await getSupabaseAsync();
  if (!supabase) return false;
  // 파트에 상관없이 "오늘 뭔가 했다"만 기록하면 되므로 여기서 한 번에 처리한다
  // (실패해도 진행 상황 저장 자체는 막지 않도록 await하지 않는다).
  markTodayActive(userId);
  const { error } = await supabase
    .from("progress")
    .upsert({ user_id: userId, part, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,part" });
  return !error;
}

export async function loadProgress<T>(userId: string, part: string): Promise<T | null> {
  if (!userId) return null;
  const supabase = await getSupabaseAsync();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("progress")
    .select("data")
    .eq("user_id", userId)
    .eq("part", part)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as T;
}

export async function deleteProgress(userId: string, part: string): Promise<void> {
  if (!userId) return;
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  await supabase.from("progress").delete().eq("user_id", userId).eq("part", part);
}

export async function loadWrongNotes(userId: string): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase.from("wrong_notes").select("words").eq("user_id", userId).maybeSingle();
  if (error || !data) return [];
  return (data.words as WordEntry[]) || [];
}

export async function saveWrongNotes(userId: string, words: WordEntry[]): Promise<boolean> {
  if (!userId) return false;
  const supabase = await getSupabaseAsync();
  if (!supabase) return false;
  const seen = new Set<string>();
  const deduped: WordEntry[] = [];
  for (const w of words) {
    const key = wordKey(w);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(w);
    }
  }
  const { error } = await supabase
    .from("wrong_notes")
    .upsert({ user_id: userId, words: deduped, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return !error;
}

export async function addWordsToWrongNotes(userId: string, newWords: WordEntry[]): Promise<void> {
  if (!userId || newWords.length === 0) return;
  const existing = await loadWrongNotes(userId);
  await saveWrongNotes(userId, [...existing, ...newWords]);
}

export async function removeWordFromWrongNotes(userId: string, word: WordEntry): Promise<void> {
  if (!userId) return;
  const existing = await loadWrongNotes(userId);
  const key = wordKey(word);
  await saveWrongNotes(
    userId,
    existing.filter((w) => wordKey(w) !== key)
  );
}

export async function appendStudyStat(userId: string, part: "practice" | "exam", total: number, correct: number): Promise<void> {
  if (!userId) return;
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  await supabase.from("study_stats").insert({ user_id: userId, date, part, total, correct });
}

export async function loadStudyStats(userId: string): Promise<StudyStatRecord[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("study_stats")
    .select("date, part, total, correct")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return data as StudyStatRecord[];
}

export async function isSyncEnabled(): Promise<boolean> {
  return (await getSupabaseAsync()) !== null;
}
