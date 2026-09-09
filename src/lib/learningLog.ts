"use client";

import { getSupabaseAsync } from "./supabase";
import { getDeviceId, getDeviceLabel } from "./device";

export type Part = "study" | "practice" | "exam" | "script";

export interface LearningLogEntry {
  fileKey: string;
  fileSummary: string;
  totalCount: number;
  doneCount: number;
  updatedAt: string; // ISO
  mode: string | null; // 연습 모드(word_only/meaning_only/random) 등, 없으면 null
  // 같은 번호를 여러 기기에서 쓸 때 이 기록을 남긴 기기(device.ts 참고). 예전(기기
  // 구분 이전) 기록은 빈 문자열.
  deviceId: string;
  deviceLabel: string;
  isThisDevice: boolean;
}

export interface LearningLogEntryWithPart extends LearningLogEntry {
  part: Part;
}

/** 파일 경로 목록을 순서와 무관하게 항상 같은 문자열로 만든다 (같은 조합 = 같은 key). */
export function fileKeyOf(paths: string[]): string {
  return [...paths].sort().join("|");
}

/** 이 조합의 파일 중 하나라도 지금 목록에 없으면(그 뒤 삭제·이름 변경됨) 다시
 * 시작할 수 없다 — "학습 기록 관리"/연습 화면에서 그런 기록을 알아보고 지우기
 * 쉽게 표시하는 데 쓴다. */
export function isFileKeyMissing(fileKey: string, existingPaths: Set<string>): boolean {
  if (!fileKey) return false;
  return fileKey.split("|").some((p) => !existingPaths.has(p));
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

/** device_id가 기본키에 추가되기 전(마이그레이션 이전)에 남은 device_id=''
 * 레거시 행이, 이후 실제 기기가 같은 조합을 이어서 저장해도 지워지지 않고 화면에
 * 중복으로 남는 문제를 없앤다 — 같은 (그룹키)에 진행 개수가 레거시 기록 이상인
 * 기기별 행이 하나라도 있으면 그 레거시 행은 이미 따라잡힌 것이므로 숨긴다.
 * 어떤 기기도 레거시 기록만큼 진행하지 못했다면(레거시 쪽이 더 앞서 있다면) 정보
 * 손실을 막기 위해 그대로 남겨둔다. */
function dropSupersededLegacyRows<T extends { fileKey: string; deviceId: string; doneCount: number }>(
  entries: T[],
  groupKeyOf: (e: T) => string
): T[] {
  const bestByGroup = new Map<string, number>();
  for (const e of entries) {
    if (!e.deviceId) continue;
    const key = groupKeyOf(e);
    bestByGroup.set(key, Math.max(bestByGroup.get(key) ?? -1, e.doneCount));
  }
  return entries.filter((e) => {
    if (e.deviceId) return true;
    const best = bestByGroup.get(groupKeyOf(e));
    return best === undefined || best < e.doneCount;
  });
}

/** 같은 (fileKey, deviceId) 조합이 양쪽에 있으면 updated_at이 더 최신인 쪽을
 * 남긴다 — 다른 기기의 기록은 절대 하나로 합치지 않고 전부 별도 항목으로 둔다. */
function mergeByFileKey(remote: LearningLogEntry[], local: LearningLogEntry[]): LearningLogEntry[] {
  const map = new Map<string, LearningLogEntry>();
  for (const r of remote) map.set(`${r.fileKey}::${r.deviceId}`, r);
  for (const l of local) {
    const key = `${l.fileKey}::${l.deviceId}`;
    const existing = map.get(key);
    if (!existing || new Date(l.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      map.set(key, l);
    }
  }
  const merged = dropSupersededLegacyRows(Array.from(map.values()), (e) => e.fileKey);
  return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function mergeByPartAndFileKey(remote: LearningLogEntryWithPart[], local: LsRecord[]): LearningLogEntryWithPart[] {
  const map = new Map<string, LearningLogEntryWithPart>();
  for (const r of remote) map.set(`${r.part}::${r.fileKey}::${r.deviceId}`, r);
  for (const l of local) {
    const key = `${l.part}::${l.fileKey}::${l.deviceId}`;
    const existing = map.get(key);
    if (!existing || new Date(l.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      map.set(key, l);
    }
  }
  const merged = dropSupersededLegacyRows(Array.from(map.values()), (e) => `${e.part}::${e.fileKey}`);
  return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 로컬에만 있고 서버보다 최신인 기록을 뒤늦게 서버로 밀어넣는다 — 다른 기기에서도 보이게 한다. 실패해도 화면엔 영향 없다. */
function backgroundSyncLocalToRemote(
  userId: string,
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAsync>>>,
  local: LsRecord[],
  remoteByKey: Map<string, LearningLogEntry>
): void {
  for (const l of local) {
    const key = `${l.part}::${l.fileKey}::${l.deviceId}`;
    const r = remoteByKey.get(key);
    if (r && new Date(r.updatedAt).getTime() >= new Date(l.updatedAt).getTime()) continue;
    supabase
      .from("learning_log")
      .upsert(
        {
          user_id: userId,
          part: l.part,
          file_key: l.fileKey,
          device_id: l.deviceId,
          device_label: l.deviceLabel,
          file_summary: l.fileSummary,
          total_count: l.totalCount,
          done_count: l.doneCount,
          mode: l.mode,
          updated_at: l.updatedAt,
        },
        { onConflict: "user_id,part,file_key,device_id" }
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
  const deviceId = getDeviceId();
  const deviceLabel = getDeviceLabel();
  const entry: LearningLogEntry = {
    fileKey,
    fileSummary,
    totalCount,
    doneCount,
    updatedAt: new Date().toISOString(),
    mode,
    deviceId,
    deviceLabel,
    isThisDevice: true,
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
          device_id: deviceId,
          device_label: deviceLabel,
          file_summary: entry.fileSummary,
          total_count: entry.totalCount,
          done_count: entry.doneCount,
          mode: entry.mode,
          updated_at: entry.updatedAt,
        },
        { onConflict: "user_id,part,file_key,device_id" }
      );
      if (error) console.error("[learningLog] upsert failed, kept in localStorage as fallback", error);
    });

  upsertChains.set(chainKey, run);
  return run;
}

function mapRow(
  r: {
    file_key: string;
    file_summary: string;
    total_count: number;
    done_count: number;
    updated_at: string;
    mode: string | null;
    device_id: string | null;
    device_label: string | null;
  },
  myDeviceId: string
): LearningLogEntry {
  return {
    fileKey: r.file_key,
    fileSummary: r.file_summary,
    totalCount: r.total_count,
    doneCount: r.done_count,
    updatedAt: r.updated_at,
    mode: r.mode ?? null,
    deviceId: r.device_id ?? "",
    deviceLabel: r.device_label || "예전 기록(기기 정보 없음)",
    isThisDevice: r.device_id === myDeviceId,
  };
}

/**
 * 이 사용자가 이 파트에서 공부한 모든 파일 조합을 기기별로 최근 순으로 돌려준다
 * (드롭다운용). 캐시하지 않고 항상 Supabase에서 바로 조회한다 — 대시보드가 방금
 * 저장된 진행률을 놓치지 않고 보여줘야 하기 때문이다. Supabase 결과와 이 기기의
 * 로컬 보조 기록을 (파일 조합, 기기)별로 병합해서, 서버에 아직 반영 안 된 최신
 * 완료 기록도 빠지지 않고 보이게 한다 — 다른 기기의 기록은 하나로 합치지 않는다.
 */
export async function listLearningLogs(userId: string, part: Part): Promise<LearningLogEntry[]> {
  if (!userId) return [];
  const myDeviceId = getDeviceId();
  const local = readAllLsRecords(userId, part);
  const supabase = await getSupabaseAsync();
  if (!supabase) return mergeByFileKey([], local).slice(0, 60);

  const { data, error } = await supabase
    .from("learning_log")
    .select("file_key, file_summary, total_count, done_count, updated_at, mode, device_id, device_label")
    .eq("user_id", userId)
    .eq("part", part)
    .order("updated_at", { ascending: false })
    .limit(60);
  const remote = !error && data ? (data as Parameters<typeof mapRow>[0][]).map((r) => mapRow(r, myDeviceId)) : [];

  const remoteByKey = new Map(remote.map((r) => [`${part}::${r.fileKey}::${r.deviceId}`, r]));
  backgroundSyncLocalToRemote(userId, supabase, local, remoteByKey);

  return mergeByFileKey(remote, local).slice(0, 60);
}

/** 이 사용자의 모든 파트를 통틀어 저장된 학습 기록 전부를 기기별로 최근 순으로 돌려준다 (설정 페이지 관리용). */
export async function listAllLearningLogs(userId: string): Promise<LearningLogEntryWithPart[]> {
  if (!userId) return [];
  const myDeviceId = getDeviceId();
  const local = readAllLsRecords(userId);
  const supabase = await getSupabaseAsync();
  if (!supabase) return mergeByPartAndFileKey([], local).slice(0, 200);

  const { data, error } = await supabase
    .from("learning_log")
    .select("part, file_key, file_summary, total_count, done_count, updated_at, mode, device_id, device_label")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const remote: LearningLogEntryWithPart[] =
    !error && data ? (data as (Parameters<typeof mapRow>[0] & { part: Part })[]).map((r) => ({ ...mapRow(r, myDeviceId), part: r.part })) : [];

  const remoteByKey = new Map(remote.map((r) => [`${r.part}::${r.fileKey}::${r.deviceId}`, r]));
  backgroundSyncLocalToRemote(userId, supabase, local, remoteByKey);

  return mergeByPartAndFileKey(remote, local).slice(0, 200);
}

/** 학습 기록 하나를 삭제한다(리셋). deviceId를 생략하면 "이 기기"의 기록만 지운다.
 * 다른 기기의 기록을 지우려면(사용자가 목록에서 직접 골라 "삭제"를 누른 경우)
 * deviceId를 넘긴다. */
export async function deleteLearningLog(userId: string, part: Part, fileKey: string, deviceId?: string): Promise<void> {
  if (!userId) return;
  const targetDeviceId = deviceId ?? getDeviceId();
  // device_id=''(레거시) 로컬 사본은 이 기기가 device_id를 갖기 전에 이 기기 자신이
  // 남긴 것일 수밖에 없다(localStorage는 기기 간에 공유되지 않으므로) — 그러니 이
  // 기기 기록과 마찬가지로 로컬에서도 지운다.
  if (targetDeviceId === getDeviceId() || targetDeviceId === "") removeLsRecord(userId, part, fileKey);
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  const { error } = await supabase
    .from("learning_log")
    .delete()
    .eq("user_id", userId)
    .eq("part", part)
    .eq("file_key", fileKey)
    .eq("device_id", targetDeviceId);
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
