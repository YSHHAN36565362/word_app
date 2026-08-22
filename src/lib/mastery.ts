"use client";

import { getSupabaseAsync } from "./supabase";
import { WordEntry } from "./types";
import { wordKey } from "./queue";

const UNSEEN_PRIORITY = 50; // 한 번도 채점 기록이 없는 단어. 0/40(약함)보다는 뒤, 60/100(잘 앎)보다는 앞.

/** 주어진 단어들 중, 이 사용자가 이전에 채점한 기록이 있는 것만 word_key -> 최신 점수로 돌려준다. */
export async function loadMasteryMap(userId: string, words: WordEntry[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!userId || words.length === 0) return map;
  const supabase = await getSupabaseAsync();
  if (!supabase) return map;
  const keys = Array.from(new Set(words.map(wordKey)));
  const { data, error } = await supabase.from("word_mastery").select("word_key, score").eq("user_id", userId).in("word_key", keys);
  if (error || !data) return map;
  for (const row of data as { word_key: string; score: number }[]) map.set(row.word_key, row.score);
  return map;
}

/** 채점 직후 그 단어의 최신 점수를 저장한다. 실패해도 학습 흐름은 막지 않는다(fire-and-forget로 호출). */
export async function saveWordMastery(userId: string, word: WordEntry, score: 0 | 40 | 60 | 100): Promise<void> {
  if (!userId) return;
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  await supabase
    .from("word_mastery")
    .upsert({ user_id: userId, word_key: wordKey(word), score, updated_at: new Date().toISOString() }, { onConflict: "user_id,word_key" });
}

/**
 * 이미 섞인(shuffle된) 목록을 받아, 점수가 낮은(모름/헷갈림) 단어가 앞쪽에 오도록
 * 안정 정렬한다. 같은 점수 구간 안에서는 원래(셔플된) 순서를 그대로 유지하므로
 * "약한 단어 우선 + 그 안에서는 무작위"가 된다.
 */
export function prioritizeByMastery<T extends WordEntry>(shuffled: T[], mastery: Map<string, number>): T[] {
  return shuffled
    .map((w, i) => ({ w, i, p: mastery.get(wordKey(w)) ?? UNSEEN_PRIORITY }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.w);
}
