/** JLPT 시험일 (한국 시간 기준, 달은 0-based라 11 = 12월). */
const JLPT_EXAM_DATE_KST = Date.UTC(2026, 11, 6);

/**
 * 오늘(한국 시간 기준 달력 날짜)부터 시험일까지 남은 일수를 계산한다.
 * 보는 사람의 기기가 어느 시간대에 있든 "한국 기준 오늘"로 계산하고,
 * 매일 자정(KST)이 지나면 하루씩 자연스럽게 줄어든다.
 */
export function daysUntilJLPT(now: Date = new Date()): number {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const todayKST = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  return Math.round((JLPT_EXAM_DATE_KST - todayKST) / 86400000);
}
