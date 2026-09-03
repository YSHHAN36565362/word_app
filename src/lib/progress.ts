"use client";

import { getSupabaseAsync, logSupabaseError } from "./supabase";
import { StudyStatRecord, WordEntry } from "./types";
import { wordKey } from "./queue";
import { markTodayActive } from "./streak";

/**
 * Supabase에 저장하는 진행 상황/오답노트/통계 데이터 레이어.
 * 모든 함수는 Supabase 미설정 시 조용히 실패(false/null/[])하도록 만들어,
 * 서버 설정 전에도 앱 자체는 정상 동작하게 한다 (기존 Streamlit 앱과 동일한 철학).
 */

// ---------------------------------------------------------------------------
// localStorage 보조 저장소 ("이어서 연습하기"용).
//
// learningLog.ts(최근 학습 요약)는 처음부터 이 기기 로컬 사본을 갖고 있어서, Supabase가
// 설정되지 않았거나(로컬 개발, 환경변수 누락) 일시적으로 응답이 없어도 "학습 기록
// 관리" 목록은 정상적으로 보인다 — 그래서 "진행 상황은 저장되는 것 같은데 이어하기만
// 안 된다"는 제보로 이어졌다. 실제로는 이 파일(progress.ts)의 저장/조회 함수들이
// Supabase가 없으면 곧바로 null/[]/false만 돌려주고 로컬 대체 수단이 전혀 없었던
// 것이 원인 — learningLog가 "다 되는 것처럼" 보여줘서 실제로는 죽어있는 이어하기
// 기능을 가려온 셈이다. learningLog와 같은 패턴(로컬에 즉시 기록 + 서버 응답과
// updated_at 기준으로 병합)을 여기도 적용해 같은 기기 안에서는 Supabase 상태와
// 무관하게 이어하기가 항상 동작하게 한다. 다른 기기 간 동기화는 여전히 Supabase가
// 필요하다.
// ---------------------------------------------------------------------------

const LS_PROGRESS_PREFIX = "word_app_progress_";

function progressLsKey(userId: string, part: string, fileKey: string): string {
  return `${LS_PROGRESS_PREFIX}${userId}_${part}_${fileKey}`;
}

interface LsProgressRecord {
  fileKey: string;
  data: unknown;
  updatedAt: string;
}

function writeLsProgress(userId: string, part: string, fileKey: string, data: unknown, updatedAt: string): void {
  if (typeof window === "undefined") return;
  try {
    const rec: LsProgressRecord = { fileKey, data, updatedAt };
    window.localStorage.setItem(progressLsKey(userId, part, fileKey), JSON.stringify(rec));
  } catch {
    // localStorage가 꽉 찼거나 비활성화된 경우 — 이 기기 안 이어하기만 못 쓰게 될 뿐,
    // Supabase 저장은 별도로 시도되므로 조용히 무시한다.
  }
}

function readLsProgress(userId: string, part: string, fileKey: string): LsProgressRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(progressLsKey(userId, part, fileKey));
    if (!raw) return null;
    return JSON.parse(raw) as LsProgressRecord;
  } catch {
    return null;
  }
}

function removeLsProgress(userId: string, part: string, fileKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(progressLsKey(userId, part, fileKey));
  } catch {
    /* 무시 */
  }
}

/** 이 사용자·파트의 로컬 사본 전부를 읽는다(연습 파트처럼 파일 조합별로 여러 개 있을 수 있음). */
function readAllLsProgress(userId: string, part: string): LsProgressRecord[] {
  if (typeof window === "undefined") return [];
  const prefix = `${LS_PROGRESS_PREFIX}${userId}_${part}_`;
  const out: LsProgressRecord[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as LsProgressRecord);
      } catch {
        /* 손상된 항목은 건너뛴다 */
      }
    }
  } catch {
    return out;
  }
  return out;
}

// (user, part, fileKey)별로 직전 저장/삭제가 끝난 뒤에만 다음 것을 보내도록 체인으로
// 묶는다. 단어를 빠르게 넘길 때마다 saveProgress가 fire-and-forget으로 연달아
// 호출되는데, 네트워크 응답이 보낸 순서와 다르게 도착하면 늦게 도착한 "이전" 응답이
// 방금 저장된 "최신" 진행 상황을 덮어써 진행이 되돌아가거나(연습/시험 이어하기가 옛
// 지점으로 돌아감), 완료 후 deleteProgress로 지운 행을 뒤늦게 되살리는 문제가 있었다.
const progressChains = new Map<string, Promise<void>>();

function progressChainKey(userId: string, part: string, fileKey: string): string {
  return `${userId}::${part}::${fileKey}`;
}

// fileKey를 생략하면(기본값 "") 파트당 슬롯이 하나뿐이던 예전 방식 그대로 동작한다
// (학습/시험/지문 파트가 이 방식을 그대로 씀). 연습 파트처럼 파일 조합별로 각각
// "이어하기" 지점을 남기고 싶으면 fileKeyOf(paths) 값을 넘긴다.
export async function saveProgress(userId: string, part: string, data: unknown, fileKey = ""): Promise<boolean> {
  if (!userId) return false;
  // Supabase 응답을 기다리지 않고 이 기기에는 즉시 남겨둔다 — 동기화 저장소가
  // 설정되지 않았거나 일시적으로 실패해도, 최소한 이 기기에서는 "이어서 연습하기"가
  // 항상 되게 하기 위함이다(learningLog.ts의 로컬 사본과 같은 패턴).
  const nowIso = new Date().toISOString();
  writeLsProgress(userId, part, fileKey, data, nowIso);

  const key = progressChainKey(userId, part, fileKey);
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
        .upsert(
          { user_id: userId, part, file_key: fileKey, data, updated_at: nowIso },
          { onConflict: "user_id,part,file_key" }
        );
      logSupabaseError(`progress 저장(${part})`, error);
      ok = !error;
    });
  progressChains.set(key, run);
  await run;
  return ok;
}

export async function loadProgress<T>(userId: string, part: string, fileKey = ""): Promise<T | null> {
  if (!userId) return null;
  const supabase = await getSupabaseAsync();
  const local = readLsProgress(userId, part, fileKey);
  if (!supabase) return (local?.data as T) ?? null;
  const { data, error } = await supabase
    .from("progress")
    .select("data, updated_at")
    .eq("user_id", userId)
    .eq("part", part)
    .eq("file_key", fileKey)
    .maybeSingle();
  logSupabaseError(`progress 불러오기(${part})`, error);
  const remote = !error && data ? { data: data.data as T, updatedAt: data.updated_at as string } : null;
  // 로컬/서버 둘 다 있으면 더 최신인 쪽(예: 다른 기기에서 더 나중에 저장한 경우 서버가
  // 이길 수도 있음)을 쓴다. 서버가 아예 응답을 못 했거나 행이 없으면 로컬로 대체한다.
  if (remote && local) {
    return new Date(remote.updatedAt).getTime() >= new Date(local.updatedAt).getTime() ? remote.data : (local.data as T);
  }
  return remote?.data ?? ((local?.data as T) ?? null);
}

export async function deleteProgress(userId: string, part: string, fileKey = ""): Promise<void> {
  if (!userId) return;
  removeLsProgress(userId, part, fileKey);
  const key = progressChainKey(userId, part, fileKey);
  const prior = progressChains.get(key) ?? Promise.resolve();
  const run = prior
    .catch(() => {})
    .then(async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) return;
      const { error } = await supabase.from("progress").delete().eq("user_id", userId).eq("part", part).eq("file_key", fileKey);
      logSupabaseError(`progress 삭제(${part})`, error);
    });
  progressChains.set(key, run);
  await run;
}

export interface SavedProgressEntry<T> {
  fileKey: string;
  data: T;
  updatedAt: string;
}

/**
 * 이 파트에서 아직 안 끝낸(완료 시 deleteProgress로 지워지는) 진행 지점을 파일 조합별로
 * 전부 최근 순으로 돌려준다. 연습 파트의 "이어서 연습하기" 목록에 쓴다.
 */
export async function listSavedProgress<T>(userId: string, part: string): Promise<SavedProgressEntry<T>[]> {
  if (!userId) return [];
  const local = readAllLsProgress(userId, part);
  const supabase = await getSupabaseAsync();

  let remote: SavedProgressEntry<T>[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from("progress")
      .select("file_key, data, updated_at")
      .eq("user_id", userId)
      .eq("part", part)
      .order("updated_at", { ascending: false })
      .limit(20);
    logSupabaseError(`이어서 하기 목록(${part})`, error);
    if (!error && data) {
      remote = (data as { file_key: string; data: T; updated_at: string }[]).map((r) => ({
        fileKey: r.file_key,
        data: r.data,
        updatedAt: r.updated_at,
      }));
    }
  }

  // 같은 fileKey가 양쪽에 있으면 더 최신인 쪽을 남긴다(learningLog.ts의 병합과 동일한 방식).
  const map = new Map<string, SavedProgressEntry<T>>();
  for (const r of remote) map.set(r.fileKey, r);
  for (const l of local) {
    const existing = map.get(l.fileKey);
    if (!existing || new Date(l.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      map.set(l.fileKey, { fileKey: l.fileKey, data: l.data as T, updatedAt: l.updatedAt });
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function loadWrongNotes(userId: string): Promise<WordEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase.from("wrong_notes").select("words").eq("user_id", userId).maybeSingle();
  logSupabaseError("오답 노트 불러오기", error);
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
  logSupabaseError("오답 노트 저장", error);
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
  const { error } = await supabase.from("study_stats").insert({ user_id: userId, date, part, total, correct });
  logSupabaseError("학습 통계 기록", error);
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
  logSupabaseError("학습 통계 불러오기", error);
  if (error || !data) return [];
  return data as StudyStatRecord[];
}

export async function isSyncEnabled(): Promise<boolean> {
  return (await getSupabaseAsync()) !== null;
}
