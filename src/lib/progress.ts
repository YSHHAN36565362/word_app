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

// (user, part)별로 직전 저장/삭제가 끝난 뒤에만 다음 것을 보내도록 체인으로 묶는다.
// 단어를 빠르게 넘길 때마다 saveProgress가 fire-and-forget으로 연달아 호출되는데,
// 네트워크 응답이 보낸 순서와 다르게 도착하면 늦게 도착한 "이전" 응답이 방금 저장된
// "최신" 진행 상황을 덮어써 진행이 되돌아가거나(연습/시험 이어하기가 옛 지점으로
// 돌아감), 완료 후 deleteProgress로 지운 행을 뒤늦게 되살리는 문제가 있었다.
const progressChains = new Map<string, Promise<void>>();

function progressChainKey(userId: string, part: string): string {
  return `${userId}::${part}`;
}

export async function saveProgress(userId: string, part: string, data: unknown): Promise<boolean> {
  if (!userId) return false;
  const key = progressChainKey(userId, part);
  const prior = progressChains.get(key) ?? Promise.resolve();
  let ok = false;
  const run = prior
    .catch(() => {})
    .then(async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) return;
      // 파트에 상관없이 "오늘 뭔가 했다"만 기록하면 되므로 여기서 한 번에 처리한다
      // (실패해도 진행 상황 저장 자체는 막지 않도록 await하지 않는다).
      markTodayActive(userId);
      const { error } = await supabase
        .from("progress")
        .upsert({ user_id: userId, part, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,part" });
      ok = !error;
    });
  progressChains.set(key, run);
  await run;
  return ok;
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
  const key = progressChainKey(userId, part);
  const prior = progressChains.get(key) ?? Promise.resolve();
  const run = prior
    .catch(() => {})
    .then(async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) return;
      await supabase.from("progress").delete().eq("user_id", userId).eq("part", part);
    });
  progressChains.set(key, run);
  await run;
}

export async function loadWrongNotes(userId: string): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase.from("wrong_notes").select("words").eq("user_id", userId).maybeSingle();
  if (error || !data) return [];
  return (data.words as WordEntry[]) || [];
}

function dedupeWords(words: WordEntry[]): WordEntry[] {
  const seen = new Set<string>();
  const deduped: WordEntry[] = [];
  for (const w of words) {
    const key = wordKey(w);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(w);
    }
  }
  return deduped;
}

async function writeWrongNotes(userId: string, words: WordEntry[]): Promise<boolean> {
  const supabase = await getSupabaseAsync();
  if (!supabase) return false;
  const { error } = await supabase
    .from("wrong_notes")
    .upsert({ user_id: userId, words: dedupeWords(words), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return !error;
}

// wrong_notes는 "읽고 -> 고치고 -> 통째로 다시 쓰기" 방식이라, 두 호출이 겹치면
// (예: 시험에서 틀린 단어가 연달아 추가되거나, 오답 노트 화면에서 여러 개를 빠르게
// "암기완료" 누를 때) 나중에 시작한 호출이 먼저 시작한 호출의 결과를 덮어써
// 방금 한 변경이 사라질 수 있다. 사용자당 체인으로 묶어 항상 순서대로 처리한다.
const wrongNotesChains = new Map<string, Promise<void>>();

function chainWrongNotes<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prior = wrongNotesChains.get(userId) ?? Promise.resolve();
  let result: T | undefined;
  const run = prior
    .catch(() => {})
    .then(async () => {
      result = await fn();
    });
  wrongNotesChains.set(userId, run);
  return run.then(() => result as T);
}

export async function saveWrongNotes(userId: string, words: WordEntry[]): Promise<boolean> {
  if (!userId) return false;
  return chainWrongNotes(userId, () => writeWrongNotes(userId, words));
}

export async function addWordsToWrongNotes(userId: string, newWords: WordEntry[]): Promise<void> {
  if (!userId || newWords.length === 0) return;
  await chainWrongNotes(userId, async () => {
    const existing = await loadWrongNotes(userId);
    await writeWrongNotes(userId, [...existing, ...newWords]);
  });
}

export async function removeWordFromWrongNotes(userId: string, word: WordEntry): Promise<void> {
  if (!userId) return;
  const key = wordKey(word);
  await chainWrongNotes(userId, async () => {
    const existing = await loadWrongNotes(userId);
    await writeWrongNotes(
      userId,
      existing.filter((w) => wordKey(w) !== key)
    );
  });
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
