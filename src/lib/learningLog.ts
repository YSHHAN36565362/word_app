"use client";

import { getSupabaseAsync } from "./supabase";

export type Part = "study" | "practice" | "exam" | "script";

export interface LearningLogEntry {
  fileKey: string;
  fileSummary: string;
  totalCount: number;
  doneCount: number;
  updatedAt: string; // ISO
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

/** 진행 상황이 바뀔 때마다(세션 시작/단어 넘어감/완료) 호출해서 그 파일 조합의 최신 상태를 남긴다. */
export async function upsertLearningLog(
  userId: string,
  part: Part,
  paths: string[],
  fileSummary: string,
  totalCount: number,
  doneCount: number
): Promise<void> {
  if (!userId || paths.length === 0) return;
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  await supabase.from("learning_log").upsert(
    {
      user_id: userId,
      part,
      file_key: fileKeyOf(paths),
      file_summary: fileSummary,
      total_count: totalCount,
      done_count: doneCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,part,file_key" }
  );
}

/** 이 사용자가 이 파트에서 공부한 모든 파일 조합을 최근 순으로 돌려준다 (드롭다운용). */
export async function listLearningLogs(userId: string, part: Part): Promise<LearningLogEntry[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learning_log")
    .select("file_key, file_summary, total_count, done_count, updated_at")
    .eq("user_id", userId)
    .eq("part", part)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return (data as { file_key: string; file_summary: string; total_count: number; done_count: number; updated_at: string }[]).map((r) => ({
    fileKey: r.file_key,
    fileSummary: r.file_summary,
    totalCount: r.total_count,
    doneCount: r.done_count,
    updatedAt: r.updated_at,
  }));
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
