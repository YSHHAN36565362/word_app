"use client";

import { getSupabaseAsync } from "./supabase";
import { WordEntry } from "./types";
import { wordKey } from "./queue";

const UNSEEN_PRIORITY = 50; // 한 번도 채점 기록이 없는 단어. 0/40(약함)보다는 뒤, 60/100(잘 앎)보다는 앞.

// userId -> 진행 중인/최근 완료된 조회 Promise. 같은 사용자에 대해 짧은 시간 안에 여러 곳
// (연습 시작, 시험 파일목록 로드 등)에서 동시에 부르더라도 실제 네트워크 요청은 한 번만 나가게 한다.
const cache = new Map<string, { promise: Promise<Map<string, number>>; at: number }>();
const CACHE_TTL_MS = 15000;

// (user, word_key)별로 직전 upsert가 끝난 뒤에만 다음 upsert를 보내도록 체인으로 묶는다.
// 같은 단어가 한 세션 안에서 여러 번 채점될 때(오답 후 재출제 등) fire-and-forget 호출이
// 겹치면 응답이 보낸 순서와 다르게 도착해 더 오래된(낮은) 점수가 최신 점수를 덮어쓸 수 있다.
const saveChains = new Map<string, Promise<void>>();

/**
 * 이 사용자의 모든 단어별 최신 점수를 한 번에 불러온다. 어떤 단어들이 필요한지 미리
 * 알 필요가 없어서(word_key로 필터하지 않음), 단어 목록을 불러오는 fetchWords()와
 * Promise.all로 동시에 실행할 수 있다 — 이전에는 단어 목록을 먼저 받은 뒤에야 그 안의
 * word_key로 필터링해서 조회했기 때문에, 두 네트워크 요청이 순서대로(waterfall) 실행돼
 * 진입 속도가 느려지는 원인이었다.
 */
export async function loadAllMastery(userId: string): Promise<Map<string, number>> {
  if (!userId) return new Map();

  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    const map = new Map<string, number>();
    const supabase = await getSupabaseAsync();
    if (!supabase) return map;
    const { data, error } = await supabase.from("word_mastery").select("word_key, score").eq("user_id", userId);
    if (error || !data) return map;
    for (const row of data as { word_key: string; score: number }[]) map.set(row.word_key, row.score);
    return map;
  })();

  cache.set(userId, { promise, at: Date.now() });
  return promise;
}

/** 채점 직후 그 단어의 최신 점수를 저장한다. 실패해도 학습 흐름은 막지 않는다(fire-and-forget로 호출). */
export async function saveWordMastery(userId: string, word: WordEntry, score: 0 | 40 | 60 | 100): Promise<void> {
  if (!userId) return;
  cache.delete(userId); // 다음 세션을 시작할 때는 방금 저장한 점수가 바로 반영되어야 한다.

  const chainKey = `${userId}::${wordKey(word)}`;
  const prior = saveChains.get(chainKey) ?? Promise.resolve();
  const run = prior
    .catch(() => {})
    .then(async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) return;
      // word/meaning/hint도 함께 저장해둔다 — "복습" 목록에서 점수 이력만이 아니라
      // 실제 단어 내용을 다시 보여주려면 원문이 필요하기 때문이다.
      await supabase.from("word_mastery").upsert(
        {
          user_id: userId,
          word_key: wordKey(word),
          score,
          word: word.word,
          meaning: word.meaning,
          hint: word.hint,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_key" }
      );
    });
  saveChains.set(chainKey, run);
  return run;
}

/**
 * 완벽함(100)·조금 앎(60)으로 채점해 "잘 아는 단어"로 분류된 것들을 최근 순으로
 * 돌려준다. 설정의 "복습" 화면에서 사용한다. word_mastery에 원문(word/meaning/hint)이
 * 저장되기 전(이 기능 추가 이전)에 채점된 항목은 원문이 없어 목록에서 제외된다.
 */
export async function loadMasteredWords(userId: string, minScore = 60): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("word_mastery")
    .select("word, meaning, hint")
    .eq("user_id", userId)
    .gte("score", minScore)
    .not("word", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data as WordEntry[];
}

/** 단어의 숙련도 기록을 지운다 — 다음 연습부터는 "아직 안 본 단어"처럼 다시 우선 출제된다. */
export async function resetWordMastery(userId: string, word: WordEntry): Promise<void> {
  if (!userId) return;
  cache.delete(userId);
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  await supabase.from("word_mastery").delete().eq("user_id", userId).eq("word_key", wordKey(word));
}

// 점수 구간은 딱 5가지 값(0·40·50·60·100)뿐이라, 지터 없이 우선순위 그대로 정렬하면
// 같은 단어 묶음을 반복 연습할 때마다 "약한 단어 뭉치 → 안 본 단어 → 잘 아는 단어"라는
// 뭉치의 경계가 매번 정확히 똑같아져서, 전체적으로 항상 비슷한 순서로 보이는 문제가
// 있었다. 인접 구간(간격 10: 40↔50↔60)끼리는 종종 뒤섞이되, 멀리 떨어진 구간(0↔40,
// 60↔100, 간격 40)까지 역전되지는 않을 정도로 지터 폭을 잡아서, "약한 단어가 대체로
// 먼저 나온다"는 취지는 지키면서도 세션마다 눈에 띄게 다른 순서가 되게 한다.
const PRIORITY_JITTER = 12;

/**
 * 이미 섞인(shuffle된) 목록을 받아, 점수가 낮은(모름/헷갈림) 단어가 앞쪽에 오도록
 * 정렬한다. 우선순위에 매번 새로운 무작위 지터를 더해서 정렬하므로, 인접 구간끼리는
 * 세션마다 순서가 달라지고 같은 구간 안에서는 원래(셔플된) 순서를 유지한다.
 */
export function prioritizeByMastery<T extends WordEntry>(shuffled: T[], mastery: Map<string, number>): T[] {
  return shuffled
    .map((w, i) => ({
      w,
      i,
      p: (mastery.get(wordKey(w)) ?? UNSEEN_PRIORITY) + (Math.random() * PRIORITY_JITTER * 2 - PRIORITY_JITTER),
    }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.w);
}
