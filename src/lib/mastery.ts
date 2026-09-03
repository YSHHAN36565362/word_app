"use client";

import { getSupabaseAsync, logSupabaseError } from "./supabase";
import { ScoreLevel, WordEntry } from "./types";
import { wordKey } from "./queue";

const UNSEEN_PRIORITY = 50; // 한 번도 채점 기록이 없는 단어. 0/40(약함)보다는 뒤, 60/100(잘 앎)보다는 앞.

export interface MasteryInfo {
  score: number; // 가장 최근 채점 점수 (0/40/60/100)
  wrongCount: number; // 지금까지 헷갈림(40)·모름(0)으로 채점된 누적 횟수 — "자주 틀리는 단어" 배지에 쓴다.
  unknownCount: number; // 지금까지 모름(0)으로만 채점된 누적 횟수 — "연습 복습" 노출 기준.
  intervalDays: number; // SRS(간격 반복) 다음 복습까지의 간격(일)
  repetition: number; // 연속으로 60점 이상 맞힌 횟수(틀리면 0으로 리셋)
  nextReviewAt: string | null; // 다음 복습 예정 시각(ISO). 아직 한 번도 채점 안 됐으면 null.
  updatedAt: string | null; // 마지막으로 채점한 시각(ISO). "오늘 몇 개 외웠나" 집계에 쓴다.
}

// userId -> 진행 중인/최근 완료된 조회 Promise. 같은 사용자에 대해 짧은 시간 안에 여러 곳
// (연습 시작, 시험 파일목록 로드 등)에서 동시에 부르더라도 실제 네트워크 요청은 한 번만 나가게 한다.
const cache = new Map<string, { promise: Promise<Map<string, MasteryInfo>>; at: number }>();
const CACHE_TTL_MS = 15000;

// (user, word_key)별로 직전 upsert가 끝난 뒤에만 다음 upsert를 보내도록 체인으로 묶는다.
// 같은 단어가 한 세션 안에서 여러 번 채점될 때(오답 후 재출제 등) fire-and-forget 호출이
// 겹치면 응답이 보낸 순서와 다르게 도착해 더 오래된(낮은) 점수가 최신 점수를 덮어쓸 수 있다.
const saveChains = new Map<string, Promise<void>>();

/**
 * 이 사용자의 모든 단어별 최신 점수/SRS 상태를 한 번에 불러온다. 어떤 단어들이 필요한지
 * 미리 알 필요가 없어서(word_key로 필터하지 않음), 단어 목록을 불러오는 fetchWords()와
 * Promise.all로 동시에 실행할 수 있다.
 */
export async function loadAllMastery(userId: string): Promise<Map<string, MasteryInfo>> {
  if (!userId) return new Map();

  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    const map = new Map<string, MasteryInfo>();
    const supabase = await getSupabaseAsync();
    if (!supabase) return map;
    const { data, error } = await supabase
      .from("word_mastery")
      .select("word_key, score, wrong_count, unknown_count, interval_days, repetition, next_review_at, updated_at")
      .eq("user_id", userId);
    logSupabaseError("숙련도 불러오기", error);
    if (error || !data) return map;
    for (const row of data as {
      word_key: string;
      score: number;
      wrong_count: number | null;
      unknown_count: number | null;
      interval_days: number | null;
      repetition: number | null;
      next_review_at: string | null;
      updated_at: string | null;
    }[]) {
      map.set(row.word_key, {
        score: row.score,
        wrongCount: row.wrong_count ?? 0,
        unknownCount: row.unknown_count ?? 0,
        intervalDays: row.interval_days ?? 0,
        repetition: row.repetition ?? 0,
        nextReviewAt: row.next_review_at ?? null,
        updatedAt: row.updated_at ?? null,
      });
    }
    return map;
  })();

  cache.set(userId, { promise, at: Date.now() });
  return promise;
}

// 채점 점수별 다음 복습까지의 고정 간격(일). 조금 앎·완벽함은 안키처럼 "오늘은
// 완료 처리하고, 정해진 날짜가 되면 다음 세션의 큐 위쪽으로 올라오게" 한다(예전의
// SM-2식 반복 횟수에 따라 점점 늘어나는 간격 대신 점수별 고정값을 쓴다).
// 모름·헷갈림은 굳이 다음날까지 미루면 오늘 안에 다시 볼 기회가 없어져 버려서
// 오히려 학습에 방해가 된다 — 그래서 간격을 0으로 둬 "항상 지금 다시 봐야 하는
// 상태"로 유지하고, 실제로 얼마나 빨리 다시 만나는지는 queue.ts의 requeuePosition
// (이번 세션 안에서 모름은 5~15%, 헷갈림은 20~40% 위치에 재삽입)이 정한다.
const FIXED_INTERVAL_DAYS: Record<ScoreLevel, number> = {
  0: 0,
  40: 0,
  60: 3,
  100: 7,
};

/**
 * 방금 채점한 점수로부터 다음 SRS 상태를 계산한다. next_review_at이 지나기 전까지는
 * excludeNotDue가 이 단어를 그날의 연습 스택에서 아예 제외해두므로, "오늘 채점한
 * 단어는 정해진 날짜가 될 때까지 다음 세션들에 안 나타나다가, 그날이 되면 다시
 * 나타난다"는 동작이 별도 로직 없이 자연히 만들어진다. 세션 내에서 틀린 단어를
 * 몇 번 더 재출제할지는 이 SRS 간격과 무관하게 queue.ts의
 * requeuePosition이 따로 처리한다(간격 반복은 "며칠 뒤에 또 볼지"를 정하고, requeue는
 * "이번 세션 안에서 언제 다시 만날지"를 정한다).
 */
export function computeNextMastery(prev: MasteryInfo | undefined, score: ScoreLevel): MasteryInfo {
  const wrongCount = score < 60 ? (prev?.wrongCount ?? 0) + 1 : (prev?.wrongCount ?? 0);
  const unknownCount = score === 0 ? (prev?.unknownCount ?? 0) + 1 : (prev?.unknownCount ?? 0);
  const repetition = score >= 60 ? (prev?.repetition ?? 0) + 1 : 0;
  const intervalDays = FIXED_INTERVAL_DAYS[score];
  const now = Date.now();
  const nextReviewAt = new Date(now + intervalDays * 24 * 60 * 60 * 1000).toISOString();
  return { score, wrongCount, unknownCount, repetition, intervalDays, nextReviewAt, updatedAt: new Date(now).toISOString() };
}

/** 채점 직후 그 단어의 최신 SRS 상태를 저장한다. 실패해도 학습 흐름은 막지 않는다(fire-and-forget로 호출). */
export async function saveWordMastery(userId: string, word: WordEntry, info: MasteryInfo): Promise<void> {
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
      const { error } = await supabase.from("word_mastery").upsert(
        {
          user_id: userId,
          word_key: wordKey(word),
          score: info.score,
          word: word.word,
          meaning: word.meaning,
          hint: word.hint,
          wrong_count: info.wrongCount,
          unknown_count: info.unknownCount,
          interval_days: info.intervalDays,
          repetition: info.repetition,
          next_review_at: info.nextReviewAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_key" }
      );
      logSupabaseError("숙련도 저장", error);
    });
  saveChains.set(chainKey, run);
  return run;
}

/** loadMasteredWords가 돌려주는 항목 — 복습 화면에서 "완벽"/"조금 앎" 배지와
 * 다음 복습 예정일을 보여주려면 원문 외에 채점 점수·SRS 상태도 함께 필요하다. */
export interface MasteredWordEntry extends WordEntry {
  score: number;
  nextReviewAt: string | null;
}

/**
 * 완벽함(100)·조금 앎(60)으로 채점해 "잘 아는 단어"로 분류된 것들을 최근 순으로
 * 돌려준다. 설정의 "복습" 화면에서 사용한다. word_mastery에 원문(word/meaning/hint)이
 * 저장되기 전(이 기능 추가 이전)에 채점된 항목은 원문이 없어 목록에서 제외된다.
 */
export async function loadMasteredWords(userId: string, minScore = 60): Promise<MasteredWordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("word_mastery")
    .select("word, meaning, hint, score, next_review_at")
    .eq("user_id", userId)
    .gte("score", minScore)
    .not("word", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  logSupabaseError("복습 목록 불러오기", error);
  if (error || !data) return [];
  return (data as { word: string; meaning: string; hint: string; score: number; next_review_at: string | null }[]).map((row) => ({
    word: row.word,
    meaning: row.meaning,
    hint: row.hint,
    score: row.score,
    nextReviewAt: row.next_review_at,
  }));
}

/**
 * 간격 반복(SRS) 주기가 다 되어 "지금 복습할 때"인 단어들을 돌려준다(복습 예정일이
 * 지났거나 오늘인 것들). 복습 화면에서 "오늘의 복습"으로 우선 추천하는 데 쓴다.
 */
export async function loadDueReviewWords(userId: string): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("word_mastery")
    .select("word, meaning, hint")
    .eq("user_id", userId)
    .gte("score", 60)
    .lte("next_review_at", nowIso)
    .not("word", "is", null)
    .order("next_review_at", { ascending: true })
    .limit(200);
  logSupabaseError("오늘의 복습 목록 불러오기", error);
  if (error || !data) return [];
  return data as WordEntry[];
}

/**
 * "모름(0)"으로 threshold번 이상 채점된, 유독 안 외워지는 단어만 모아 돌려준다.
 * "연습 복습" 화면(한자만 보고 탭하면 뜻이 나오는 아주 가벼운 복습용)에서 사용한다.
 */
export async function loadFrequentlyUnknownWords(userId: string, threshold = 5): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("word_mastery")
    .select("word, meaning, hint")
    .eq("user_id", userId)
    .gte("unknown_count", threshold)
    .not("word", "is", null)
    .order("unknown_count", { ascending: false })
    .limit(200);
  logSupabaseError("자주 틀리는 단어 목록 불러오기", error);
  if (error || !data) return [];
  return data as WordEntry[];
}

/** 단어의 숙련도 기록을 지운다 — 다음 연습부터는 "아직 안 본 단어"처럼 다시 우선 출제된다. */
export async function resetWordMastery(userId: string, word: WordEntry): Promise<void> {
  if (!userId) return;
  cache.delete(userId);
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  const { error } = await supabase.from("word_mastery").delete().eq("user_id", userId).eq("word_key", wordKey(word));
  logSupabaseError("숙련도 초기화", error);
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
 * SRS 복습일이 아직 안 된 단어를 어떻게 할지는 이 함수의 관심사가 아니다 — 세션을
 * 시작하기 전에 excludeNotDue로 아예 걸러내고, 여기엔 "오늘 다룰 단어"만 넘긴다.
 */
export function prioritizeByMastery<T extends WordEntry>(shuffled: T[], mastery: Map<string, MasteryInfo>): T[] {
  return shuffled
    .map((w, i) => {
      const info = mastery.get(wordKey(w));
      return { w, i, p: (info?.score ?? UNSEEN_PRIORITY) + (Math.random() * PRIORITY_JITTER * 2 - PRIORITY_JITTER) };
    })
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.w);
}

export interface DueSplit<T> {
  due: T[]; // 오늘 다룰 단어(안 본 단어 + 모름/헷갈림 + SRS 복습일이 지난 완벽함/조금 앎)
  excludedMastered: number; // 완벽함(100)인데 아직 7일이 안 지나 제외한 개수
  excludedLearned: number; // 조금 앎(60)인데 아직 3일이 안 지나 제외한 개수
}

/**
 * 완벽함(100)·조금 앎(60)으로 채점된 단어 중 SRS 복습 예정일(nextReviewAt)이 아직
 * 안 지난 것은 "오늘의 스택"에서 아예 제외한다.
 *
 * 예전에는 prioritizeByMastery가 이런 단어를 뒤로 미루기만 했다(NOT_DUE_PUSH) — 큰
 * 단어장에서는 사실상 안 보이는 것과 비슷했지만, 단어 수가 적은 단어장에서는 여전히
 * 같은 세션 안에 다시 나오거나(며칠 뒤가 아니라 "그날 바로") 밀어내는 정도가 부족해
 * 바로 다음 카드로 또 나오는 경우가 있었다 — "완벽함을 눌러도 7일 후가 적용 안 되는 것
 * 같다"는 제보의 원인. 이제는 세션을 시작하기 전에 이 함수로 완전히 걸러낸다.
 *
 * 다만 걸러낸 결과가 너무 적으면(< MIN_DUE_FLOOR) 그날 연습할 단어가 하나도 없어
 * 세션을 아예 시작 못 하는 게 더 나쁜 경험이라, 그럴 때는 복습일이 가장 임박한
 * 순서로 부족한 만큼만 다시 채워 넣는다(대신 excludedMastered/excludedLearned
 * 카운트에는 그대로 반영해, 화면에서 "그래도 N개는 아직 복습일 전이지만 채웠다"는
 * 걸 알 수 있게 한다 — 정확히는 UI에서 "복습일이 남았지만 부족해서 포함" 문구로 안내).
 */
const MIN_DUE_FLOOR = 5;

export function excludeNotDue<T extends WordEntry>(list: T[], mastery: Map<string, MasteryInfo>): DueSplit<T> {
  const now = Date.now();
  const due: T[] = [];
  const notDue: { w: T; info: MasteryInfo; nextReviewAt: number }[] = [];

  for (const w of list) {
    const info = mastery.get(wordKey(w));
    const notDueYet = !!info && info.nextReviewAt != null && new Date(info.nextReviewAt).getTime() > now;
    if (notDueYet) {
      notDue.push({ w, info: info!, nextReviewAt: new Date(info!.nextReviewAt!).getTime() });
    } else {
      due.push(w);
    }
  }

  let excludedMastered = notDue.filter((x) => x.info.score === 100).length;
  let excludedLearned = notDue.filter((x) => x.info.score === 60).length;

  if (due.length < MIN_DUE_FLOOR && notDue.length > 0) {
    // 복습일이 가장 임박한(가까운) 것부터 부족한 만큼만 채운다.
    notDue.sort((a, b) => a.nextReviewAt - b.nextReviewAt);
    const need = Math.min(MIN_DUE_FLOOR - due.length, notDue.length);
    for (let i = 0; i < need; i++) {
      due.push(notDue[i].w);
      if (notDue[i].info.score === 100) excludedMastered--;
      else if (notDue[i].info.score === 60) excludedLearned--;
    }
  }

  return { due, excludedMastered, excludedLearned };
}
