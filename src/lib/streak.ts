"use client";

import { getSupabaseAsync } from "./supabase";

const DAY_MS = 86_400_000;

function todayKst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
}

/** "YYYY-MM-DD"(KST 달력 날짜)를 타임존과 무관한 정수 일련번호로 바꾼다. */
function toDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

// 브라우저 세션 안에서 (userId, 오늘 날짜)당 한 번만 실제로 upsert를 보낸다.
// saveProgress()가 단어를 넘길 때마다 호출되므로, 매번 네트워크 요청을 보내지
// 않도록 방어한다.
let lastMarked = "";

/**
 * 오늘 무언가(학습/연습/시험/지문)를 했다는 기록을 남긴다. 어떤 파트에서 호출해도
 * 같은 테이블에 하루 한 행만 쌓이므로, saveProgress()에서 파트 구분 없이 호출한다.
 */
export async function markTodayActive(userId: string): Promise<void> {
  if (!userId) return;
  const today = todayKst();
  const cacheKey = `${userId}::${today}`;
  if (lastMarked === cacheKey) return;
  lastMarked = cacheKey;
  const supabase = await getSupabaseAsync();
  if (!supabase) return;
  await supabase.from("daily_activity").upsert({ user_id: userId, date: today }, { onConflict: "user_id,date" });
}

export interface StreakInfo {
  current: number;
  activeToday: boolean;
}

/**
 * 오늘(오늘 아직 학습 전이면 어제)부터 거슬러 며칠 연속으로 학습했는지 센다.
 * Duolingo류 앱의 "연속 학습일" 스트릭과 같은 개념.
 */
export async function loadStreak(userId: string): Promise<StreakInfo> {
  if (!userId) return { current: 0, activeToday: false };
  const supabase = await getSupabaseAsync();
  if (!supabase) return { current: 0, activeToday: false };
  const { data, error } = await supabase
    .from("daily_activity")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(400);
  if (error || !data || data.length === 0) return { current: 0, activeToday: false };

  const dayNumbers = new Set((data as { date: string }[]).map((r) => toDayNumber(r.date)));
  const todayNum = toDayNumber(todayKst());
  const activeToday = dayNumbers.has(todayNum);

  let cursor = activeToday ? todayNum : todayNum - 1;
  let count = 0;
  while (dayNumbers.has(cursor)) {
    count += 1;
    cursor -= 1;
  }
  return { current: count, activeToday };
}
