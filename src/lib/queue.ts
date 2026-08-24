import { StudyMode, WordEntry } from "./types";

/**
 * 망각 곡선 큐: 채점 점수가 낮을수록 큐의 앞쪽(더 가까운 위치) 구간에 재삽입한다.
 * 완벽함(100)·조금 앎(60)은 큐에서 완전히 제거된다 — "조금 앎"까지는 이번 세션에서
 * 충분히 안 것으로 보고 완료율에도 반영한다(예전에는 100만 완료로 쳐서 완료율이
 * 잘 안 올라간다는 피드백이 있었다). 헷갈림(40)·모름(0)만 다시 꽂아 넣는다.
 * 고정 위치가 아니라 구간에서 무작위로 뽑아 사용자가 "순서"를 외워버리는 것을 방지한다.
 */
const REQUEUE_RANGES: Record<number, [number, number]> = {
  40: [0.2, 0.4],
  0: [0.05, 0.15],
};

export function requeuePosition(queueLen: number, level: 40 | 0): number {
  if (queueLen <= 1) return 0;
  const [lo, hi] = REQUEUE_RANGES[level];
  const loIdx = Math.max(0, Math.floor(queueLen * lo));
  const hiIdx = Math.max(loIdx, Math.floor(queueLen * hi));
  return loIdx + Math.floor(Math.random() * (hiIdx - loIdx + 1));
}

export function getDisplaySide(mode: StudyMode): 0 | 1 {
  if (mode === "random") return Math.random() < 0.5 ? 0 : 1;
  return mode === "meaning_only" ? 0 : 1;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function wordKey(w: WordEntry): string {
  return `${w.word}|${w.meaning}|${w.hint}`;
}
