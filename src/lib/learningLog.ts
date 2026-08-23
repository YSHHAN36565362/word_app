"use client";

import { getSupabaseAsync } from "./supabase";

export type Part = "study" | "practice" | "exam" | "script";

export interface LearningLogEntry {
  fileKey: string;
  fileSummary: string;
  totalCount: number;
  doneCount: number;
  updatedAt: string; // ISO
  mode: string | null; // 연습 모드(word_only/meaning_only/random) 등, 없으면 null
}

export interface LearningLogEntryWithPart extends LearningLogEntry {
  part: Part;
}

/** 파일 경로 목록을 순서와 무관하게 항상 같은 문자열로 만든다 (같은 조합 = 같은 key). */
export function fileKeyOf(paths: string[]): string {
  return [...paths].sort().join("|");
}

/** "파일명 외 N개 선택됨" 형태의 요약 라벨을 만든다. */
export function fileSummaryOf(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} 외 ${labels.length - 1}개`;
}

// (user, part, fileKey)별로 직전 upsert가 끝난 뒤에만 다음 upsert를 보내도록 체인으로
// 묶는다. fire-and-forget으로 연달아 호출되면(단어를 빠르게 넘길 때) 네트워크 응답이
// 보낸 순서와 다르게 도착할 수 있어, 늦게 도착한 "이전" 응답이 방금 저장된 "최신"
// done_count를 덮어써 진행률이 되돌아가 보이는 문제가 있었다.
const upsertChains = new Map<string, Promise<void>>();

/** 진행 상황이 바뀔 때마다(세션 시작/단어 넘어감/완료) 호출해서 그 파일 조합의 최신 상태를 남긴다. */
export async function upsertLearningLog(
  userId: string,
  part: Part,
  paths: string[],
  fileSummary: string,
  totalCount: number,
  doneCount: number,
  mode: string | null = null
): Promise<void> {
  if (!userId || paths.length === 0) return;
  const fileKey = fileKeyOf(paths);
  const chainKey = `${userId}::${part}::${fileKey}`;
  const prior = upsertChains.get(chainKey) ?? Promise.resolve();

  const run = prior
    .catch(() => {})
    .then(async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) return;
      await supabase.from("learning_log").upsert(
        {
          user_id: userId,
          part,
          file_key: fileKey,
          file_summary: fileSummary,
          total_count: totalCount,
          done_count: doneCount,
          mode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,part,file_key" }
      );
    });

  upsertChains.set(chainKey, run);
  return run;
}

function mapRow(r: {
  file_key: string;
  file_summary: string;
  total_count: number;
  done_count: number;
  updated_at: string;
  mode: string | null;
}): LearningLogEntry {
  return {
    fileKey: r.file_key,
    fileSummary: r.file_summary,
    totalCount: r.total_count,
    doneCount: r.done_count,
    updatedAt: r.updated_at,
    mode: r.mode ?? null,
  };
}

/**
 * 이 사용자가 이 파트에서 공부한 모든 파일 조합을 최근 순으로 돌려준다 (드롭다운용).
 * 캐시하지 않고 항상 Supabase에서 바로 조회한다 — 대시보드가 방금 저장된 진행률을
 * 놓치지 않고 보여줘야 하기 때문이다.
 */
export async function listLearningLogs(userId: string, part: Part): Promise<LearningLogEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learning_log")
    .select("file_key, file_summary, total_count, done_count, updated_at, mode")
    .eq("user_id", userId)
    .eq("part", part)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return (data as Parameters<typeof mapRow>[0][]).map(mapRow);
}

/** 이 사용자의 모든 파트를 통틀어 저장된 학습 기록 전부를 최근 순으로 돌려준다 (설정 페이지 관리용). */
export async function listAllLearningLogs(userId: string): Promise<LearningLogEntryWithPart[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learning_log")
    .select("part, file_key, file_summary, total_count, done_count, updated_at, mode")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return (data as (Parameters<typeof mapRow>[0] & { part: Part })[]).map((r) => ({ ...mapRow(r), part: r.part }));
}

/** 학습 기록 하나를 삭제한다(리셋). 진행률/최근 학습 시간이 그 파일 조합에서 사라진다. */
export async function deleteLearningLog(userId: string, part: Part, fileKey: string): Promise<void> {
  if (!userId) return;
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  await supabase.from("learning_log").delete().eq("user_id", userId).eq("part", part).eq("file_key", fileKey);
}

/** "YYYY.MM.DD HH:mm" 형태로 표시한다 (한국 시간 기준). */
export function formatKstDateTime(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}
