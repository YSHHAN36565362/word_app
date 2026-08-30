import { StudyMode, WordEntry } from "./types";

// 연습을 몇 개 단위 "라운드"로 쪼개는 기준 (practice/page.tsx의 라운드 완료 화면도
// 이 값을 그대로 쓴다 — round.ts류로 따로 빼기엔 이 상수 하나뿐이라 여기 둔다).
export const ROUND_SIZE = 15;

// 방금 채점한 단어가 다시 나오기 전에 최소 이만큼의 "다른" 단어가 사이에 껴야 한다.
// 이게 없으면(특히 모름 0점일 때) 재삽입 위치가 우연히 맨 앞으로 뽑혀서 방금 본 단어가
// 바로 다음 카드로 또 나오는 경우가 생긴다 — 암기 확인이 아니라 그냥 "방금 본 걸
// 그대로 따라 말하기"가 되어버려서, 최소 간격을 강제한다.
const MIN_GAP = 3;

/**
 * 망각 곡선 큐: 채점 점수가 낮을수록 큐의 앞쪽(더 가까운 위치) 구간에 재삽입한다.
 * 완벽함(100)·조금 앎(60)은 큐에서 완전히 제거된다 — "조금 앎"까지는 이번 세션에서
 * 충분히 안 것으로 보고 완료율에도 반영한다(예전에는 100만 완료로 쳐서 완료율이
 * 잘 안 올라간다는 피드백이 있었다). 헷갈림(40)·모름(0)만 다시 꽂아 넣는다.
 *
 * 모름(0)은 "이번 라운드 안에서 반드시 다시 만나야" 하므로, ROUND_SIZE 턴 이내의
 * 위치 중 무작위로 고른다. 헷갈림(40)은 그보다 여유를 둬서, 다음 라운드(2번째) 안에
 * 넣을지 그보다 나중인 3~5번째 라운드 안에 넣을지를 반반 확률로 고른 뒤 그 구간
 * 안에서 무작위 위치를 고른다 — 고정 위치가 아니라 구간에서 무작위로 뽑아 사용자가
 * "순서"를 외워버리는 것을 방지한다. 두 경우 모두 MIN_GAP보다 가까운 위치는 절대
 * 뽑히지 않는다.
 */
export function requeuePosition(queueLen: number, level: 40 | 0): number {
  if (queueLen === 0) return 0;
  // splice 삽입 위치는 0(맨 앞)부터 queueLen(맨 끝에 추가)까지 전부 유효하다 — 남은
  // 단어가 아주 적을 때도(예: 1개) "그 단어 다음"에 꽂을 수 있도록 queueLen까지 허용한다.
  const clamp = (n: number) => Math.max(0, Math.min(n, queueLen));

  if (level === 0) {
    const loIdx = clamp(MIN_GAP);
    const hiIdx = Math.max(loIdx, clamp(ROUND_SIZE - 1));
    return loIdx + Math.floor(Math.random() * (hiIdx - loIdx + 1));
  }

  const nextRound: [number, number] = [ROUND_SIZE, ROUND_SIZE * 2 - 1];
  const laterRounds: [number, number] = [ROUND_SIZE * 2, ROUND_SIZE * 5 - 1];
  const [lo, hi] = Math.random() < 0.5 ? nextRound : laterRounds;
  const loIdx = clamp(Math.max(lo, MIN_GAP));
  const hiIdx = Math.max(loIdx, clamp(hi));
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
