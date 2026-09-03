"use client";

import { getSupabaseAsync } from "./supabase";
import { MasteryInfo } from "./mastery";
import { StudyStatRecord } from "./types";

/**
 * 안키의 "카드 상태 분포 / 앞으로의 복습 예정(Future Due)"과 듀오링고의 "오늘의 목표"에
 * 해당하는 통계를 만든다. 전부 이미 불러와 둔 데이터(word_mastery, study_stats,
 * daily_activity)에서 계산만 하는 읽기 전용 모듈이라, 학습 기록에는 아무것도 쓰지 않는다.
 */

function kstDateKey(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
}

export interface MasteryBreakdown {
  mastered: number; // 완벽함(100)
  learned: number; // 조금 앎(60)
  shaky: number; // 헷갈림(40)
  unknown: number; // 모름(0)
  total: number;
}

/** 채점된 단어들이 지금 어떤 상태에 몰려 있는지 — 안키의 카드 상태 분포에 해당한다. */
export function masteryBreakdown(mastery: Map<string, MasteryInfo>): MasteryBreakdown {
  const out: MasteryBreakdown = { mastered: 0, learned: 0, shaky: 0, unknown: 0, total: 0 };
  for (const info of mastery.values()) {
    out.total += 1;
    if (info.score >= 100) out.mastered += 1;
    else if (info.score >= 60) out.learned += 1;
    else if (info.score >= 40) out.shaky += 1;
    else out.unknown += 1;
  }
  return out;
}

/** 지금 바로 복습할 수 있는(복습 예정일이 지난) 단어 수. */
export function dueNowCount(mastery: Map<string, MasteryInfo>): number {
  const now = Date.now();
  let count = 0;
  for (const info of mastery.values()) {
    if (info.score >= 60 && info.nextReviewAt != null && new Date(info.nextReviewAt).getTime() <= now) count += 1;
  }
  return count;
}

export interface DueForecastDay {
  date: string; // YYYY-MM-DD (KST)
  label: string; // 오늘 / 내일 / 9/5 …
  count: number;
}

/**
 * 앞으로 며칠 동안 몇 개씩 복습 예정인지 — 안키의 Future Due 그래프에 해당한다.
 * 이미 예정일이 지난 것은 전부 "오늘"에 합산한다(안키와 같은 방식).
 */
export function dueForecast(mastery: Map<string, MasteryInfo>, days = 7): DueForecastDay[] {
  const today = new Date();
  const buckets = new Map<string, number>();
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const key = kstDateKey(d);
    keys.push(key);
    buckets.set(key, 0);
  }
  const todayKey = keys[0];
  const lastKey = keys[keys.length - 1];

  for (const info of mastery.values()) {
    if (info.score < 60 || info.nextReviewAt == null) continue;
    const key = kstDateKey(new Date(info.nextReviewAt));
    if (key <= todayKey) buckets.set(todayKey, (buckets.get(todayKey) ?? 0) + 1);
    else if (key <= lastKey) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return keys.map((key, i) => ({
    date: key,
    label: i === 0 ? "오늘" : i === 1 ? "내일" : `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
    count: buckets.get(key) ?? 0,
  }));
}

/** 오늘(KST 기준) 채점한 단어 수 — 듀오링고식 "오늘의 목표" 진행률에 쓴다. */
export function studiedTodayCount(mastery: Map<string, MasteryInfo>): number {
  const todayKey = kstDateKey(new Date());
  let count = 0;
  for (const info of mastery.values()) {
    if (info.updatedAt && kstDateKey(new Date(info.updatedAt)) === todayKey) count += 1;
  }
  return count;
}

export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  level: 0 | 1 | 2 | 3 | 4; // 0=기록 없음
  count: number; // 그날 학습한 문항 수(세션 기록 합계)
}

/**
 * 깃허브 잔디 / 안키 리뷰 히트맵에 해당하는 최근 N주치 달력 데이터.
 * study_stats의 문항 수로 진하기를 정하고, 세션 기록이 없더라도 daily_activity에
 * 남아있는 날(예: 학습 파트만 훑어본 날)은 최소 단계(1)로 칠한다.
 */
export function buildHeatmap(activeDates: string[], stats: StudyStatRecord[], weeks = 16): HeatmapCell[] {
  const volume = new Map<string, number>();
  for (const r of stats) volume.set(r.date, (volume.get(r.date) ?? 0) + r.total);
  const active = new Set(activeDates);

  // 이번 주 일요일까지 채워서 마지막 열이 이번 주가 되게 한다.
  const today = new Date();
  const todayKst = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const endOfWeek = new Date(todayKst.getTime() + (6 - todayKst.getDay()) * 86_400_000);
  const start = new Date(endOfWeek.getTime() - (weeks * 7 - 1) * 86_400_000);

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const key = kstDateKey(d);
    const count = volume.get(key) ?? 0;
    let level: HeatmapCell["level"] = 0;
    if (count >= 120) level = 4;
    else if (count >= 60) level = 3;
    else if (count >= 25) level = 2;
    else if (count > 0 || active.has(key)) level = 1;
    cells.push({ date: key, level, count });
  }
  return cells;
}

/** 히트맵용으로 "그날 뭔가 하긴 한 날"의 날짜 목록만 가져온다(읽기 전용). */
export async function loadActivityDates(userId: string): Promise<string[]> {
  if (!userId) return [];
  const supabase = await getSupabaseAsync();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("daily_activity")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(400);
  if (error || !data) return [];
  return (data as { date: string }[]).map((r) => r.date);
}
