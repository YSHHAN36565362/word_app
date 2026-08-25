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

// ---------------------------------------------------------------------------
// localStorage 보조 저장소.
//
// Supabase 요청이 네트워크 문제 등으로 실패하거나 오래 걸리는 동안에도, 최소한 이
// 기기에서는 방금 쌓은 완료 기록이 사라지지 않도록 파일 조합별로 이 기기에 즉시
// 남겨둔다. Supabase가 정상 응답하면 그쪽 데이터가 진실의 원천(source of truth)이고,
// 이 로컬 사본은 "서버 응답을 못 받았거나 아직 동기화가 안 된 최신 값"을 보충하는
// 용도로만 쓴다 — updated_at을 비교해서 더 최신인 쪽을 항상 우선한다.
// ---------------------------------------------------------------------------

const LS_PREFIX = "learning_log_";

interface LsRecord extends LearningLogEntry {
  part: Part;
}

function lsKey(userId: string, part: Part, fileKey: string): string {
  return `${LS_PREFIX}${userId}_${part}_${fileKey}`;
}

function writeLsRecord(userId: string, part: Part, fileKey: string, entry: LearningLogEntry): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(userId, part, fileKey), JSON.stringify({ ...entry, part } as LsRecord));
  } catch {
    // localStorage가 꽉 찼거나(시크릿 모드 등) 비활성화된 경우 — 보조 저장소일 뿐이니 조용히 무시한다.
  }
}

function removeLsRecord(userId: string, part: Part, fileKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lsKey(userId, part, fileKey));
  } catch {
    /* 무시 */
  }
}

/** 이 사용자의 로컬 보조 기록 전부(또는 특정 파트만)를 읽는다. 키 파싱에 기대지 않고, 저장된 값 자체의 part/fileKey를 사용한다. */
function readAllLsRecords(userId: string, part?: Part): LsRecord[] {
  if (typeof window === "undefined") return [];
  const prefix = `${LS_PREFIX}${userId}_`;
  const out: LsRecord[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const rec = JSON.parse(raw) as LsRecord;
        if (!part || rec.part === part) out.push(rec);
      } catch {
        /* 손상된 항목은 건너뛴다 */
      }
    }
  } catch {
    return out;
  }
  return out;
}

/** 같은 fileKey가 양쪽에 있으면 updated_at이 더 최신인 쪽을 남긴다. */
function mergeByFileKey(remote: LearningLogEntry[], local: LearningLogEntry[]): LearningLogEntry[] {
  const map = new Map<string, LearningLogEntry>();
  for (const r of remote) map.set(r.fileKey, r);
  for (const l of local) {
    const existing = map.get(l.fileKey);
    if (!existing || new Date(l.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      map.set(l.fileKey, l);
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function mergeByPartAndFileKey(remote: LearningLogEntryWithPart[], local: LsRecord[]): LearningLogEntryWithPart[] {
  const map = new Map<string, LearningLogEntryWithPart>();
  for (const r of remote) map.set(`${r.part}::${r.fileKey}`, r);
  for (const l of local) {
    const key = `${l.part}::${l.fileKey}`;
    const existing = map.get(key);
    if (!existing || new Date(l.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      map.set(key, l);
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 로컬에만 있고 서버보다 최신인 기록을 뒤늦게 서버로 밀어넣는다 — 다른 기기에서도 보이게 한다. 실패해도 화면엔 영향 없다. */
function backgroundSyncLocalToRemote(
  userId: string,
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAsync>>>,
  local: LsRecord[],
  remoteByKey: Map<string, LearningLogEntry>
): void {
  for (const l of local) {
    const key = `${l.part}::${l.fileKey}`;
    const r = remoteByKey.get(key);
    if (r && new Date(r.updatedAt).getTime() >= new Date(l.updatedAt).getTime()) continue;
    supabase
      .from("learning_log")
      .upsert(
        {
          user_id: userId,
          part: l.part,
          file_key: l.fileKey,
          file_summary: l.fileSummary,
          total_count: l.totalCount,
          done_count: l.doneCount,
          mode: l.mode,
          updated_at: l.updatedAt,
        },
        { onConflict: "user_id,part,file_key" }
      )
      .then(({ error }) => {
        if (error) console.error("[learningLog] background sync failed", error);
      });
  }
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
  const entry: LearningLogEntry = {
    fileKey,
    fileSummary,
    totalCount,
    doneCount,
    updatedAt: new Date().toISOString(),
    mode,
  };
  // Supabase 요청 완료를 기다리지 않고 이 기기에는 즉시 남겨둔다 — 네트워크가 느리거나
  // 실패해도 이 기기 안에서는 방금 쌓은 완료 기록이 사라지지 않는다.
  writeLsRecord(userId, part, fileKey, entry);

  const chainKey = `${userId}::${part}::${fileKey}`;
  const prior = upsertChains.get(chainKey) ?? Promise.resolve();

  const run = prior
    .catch(() => {})
    .then(async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) return;
      const { error } = await supabase.from("learning_log").upsert(
        {
          user_id: userId,
          part,
          file_key: fileKey,
          file_summary: entry.fileSummary,
          total_count: entry.totalCount,
          done_count: entry.doneCount,
          mode: entry.mode,
          updated_at: entry.updatedAt,
        },
        { onConflict: "user_id,part,file_key" }
      );
      if (error) console.error("[learningLog] upsert failed, kept in localStorage as fallback", error);
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
 * 놓치지 않고 보여줘야 하기 때문이다. Supabase 결과와 이 기기의 로컬 보조 기록을
 * 파일 조합(fileKey)별로 병합해서, 서버에 아직 반영 안 된 최신 완료 기록도 빠지지
 * 않고 보이게 한다.
 */
export async function listLearningLogs(userId: string, part: Part): Promise<LearningLogEntry[]> {
  if (!userId) return [];
  const local = readAllLsRecords(userId, part);
  const supabase = await getSupabaseAsync();
  if (!supabase) return mergeByFileKey([], local).slice(0, 30);

  const { data, error } = await supabase
    .from("learning_log")
    .select("file_key, file_summary, total_count, done_count, updated_at, mode")
    .eq("user_id", userId)
    .eq("part", part)
    .order("updated_at", { ascending: false })
    .limit(30);
  const remote = !error && data ? (data as Parameters<typeof mapRow>[0][]).map(mapRow) : [];

  const remoteByKey = new Map(remote.map((r) => [`${part}::${r.fileKey}`, r]));
  backgroundSyncLocalToRemote(userId, supabase, local, remoteByKey);

  return mergeByFileKey(remote, local).slice(0, 30);
}

/** 이 사용자의 모든 파트를 통틀어 저장된 학습 기록 전부를 최근 순으로 돌려준다 (설정 페이지 관리용). */
export async function listAllLearningLogs(userId: string): Promise<LearningLogEntryWithPart[]> {
  if (!userId) return [];
  const local = readAllLsRecords(userId);
  const supabase = await getSupabaseAsync();
  if (!supabase) return mergeByPartAndFileKey([], local).slice(0, 100);

  const { data, error } = await supabase
    .from("learning_log")
    .select("part, file_key, file_summary, total_count, done_count, updated_at, mode")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  const remote: LearningLogEntryWithPart[] =
    !error && data ? (data as (Parameters<typeof mapRow>[0] & { part: Part })[]).map((r) => ({ ...mapRow(r), part: r.part })) : [];

  const remoteByKey = new Map(remote.map((r) => [`${r.part}::${r.fileKey}`, r]));
  backgroundSyncLocalToRemote(userId, supabase, local, remoteByKey);

  return mergeByPartAndFileKey(remote, local).slice(0, 100);
}

/** 학습 기록 하나를 삭제한다(리셋). 진행률/최근 학습 시간이 그 파일 조합에서 사라진다. */
export async function deleteLearningLog(userId: string, part: Part, fileKey: string): Promise<void> {
  if (!userId) return;
  removeLsRecord(userId, part, fileKey);
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  const { error } = await supabase.from("learning_log").delete().eq("user_id", userId).eq("part", part).eq("file_key", fileKey);
  if (error) console.error("[learningLog] delete failed", error);
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
