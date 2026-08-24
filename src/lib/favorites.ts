"use client";

import { getSupabaseAsync } from "./supabase";
import { WordEntry } from "./types";
import { wordKey } from "./queue";

/**
 * 즐겨찾기(별표) 단어. Quizlet의 "starred terms"와 같은 개념 — 오답 노트와 달리
 * 자동으로 쌓이지 않고, 사용자가 학습/연습 중 별표를 눌러 직접 고른 단어만 들어간다.
 */

export async function loadFavorites(userId: string): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("favorites")
    .select("word, meaning, hint")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as WordEntry[];
}

export async function loadFavoriteKeys(userId: string): Promise<Set<string>> {
  const words = await loadFavorites(userId);
  return new Set(words.map(wordKey));
}

// 별표를 빠르게 두 번 누르면(추가 -> 바로 해제 등) 응답이 뒤바뀌어 도착해 반대
// 상태로 남을 수 있어, 같은 단어에 대한 호출은 순서대로 처리한다.
const favoriteChains = new Map<string, Promise<void>>();

function chain(key: string, fn: () => Promise<void>): Promise<void> {
  const prior = favoriteChains.get(key) ?? Promise.resolve();
  const run = prior.catch(() => {}).then(fn);
  favoriteChains.set(key, run);
  return run;
}

export async function addFavorite(userId: string, word: WordEntry): Promise<void> {
  if (!userId) return;
  const chainKey = `${userId}::${wordKey(word)}`;
  await chain(chainKey, async () => {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;
    await supabase.from("favorites").upsert(
      { user_id: userId, word_key: wordKey(word), word: word.word, meaning: word.meaning, hint: word.hint },
      { onConflict: "user_id,word_key" }
    );
  });
}

export async function removeFavorite(userId: string, word: WordEntry): Promise<void> {
  if (!userId) return;
  const chainKey = `${userId}::${wordKey(word)}`;
  await chain(chainKey, async () => {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;
    await supabase.from("favorites").delete().eq("user_id", userId).eq("word_key", wordKey(word));
  });
}
