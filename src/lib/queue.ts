import { StudyMode, WordEntry } from "./types";

// 연습을 몇 개 단위 "라운드"로 쪼개는 기본값. 사용자가 연습 화면의 설정(⚙)에서
// 5~50개 사이로 바꿀 수 있고(useRoundSize), 바꾼 값은 requeuePosition에도 그대로
// 전달된다 — 여기 상수는 "아직 아무것도 고르지 않았을 때의 기본값" 역할만 한다.
export const ROUND_SIZE = 15;

// 방금 채점한 단어가 다시 나오기 전에 최소 이만큼의 "다른" 단어가 사이에 껴야 한다.
// 이게 없으면(특히 모름 0점일 때) 재삽입 위치가 우연히 맨 앞으로 뽑혀서 방금 본 단어가
// 바로 다음 카드로 또 나오는 경우가 생긴다 — 암기 확인이 아니라 그냥 "방금 본 걸
// 그대로 따라 말하기"가 되어버려서, 최소 간격을 강제한다.
const MIN_GAP = 3;

/**
 * 조금 앎(60)/헷갈림(40)/모름(0)을 다시 꽂아 넣을 목표 구간(lo~hi번째 카드 뒤)을
 * 계산한다. `requeuePosition`이 실제 재삽입 위치를 뽑을 때도, 채점 버튼에 "몇 번째쯤
 * 다시 나오는지" 라벨을 보여줄 때도 이 함수 하나만 쓴다 — 라벨에 적힌 숫자와 실제
 * 동작이 어긋나는 일(예전에 "7일 후"라고 적어놓고 실제로는 아니었던 것과 같은 문제)이
 * 다시는 생기지 않도록, 숫자의 출처를 하나로 합쳤다.
 */
export function requeueRangeBounds(level: 60 | 40 | 0, roundSize: number = ROUND_SIZE): { lo: number; hi: number } {
  if (level === 0) {
    const lo = MIN_GAP;
    const hi = Math.max(lo, roundSize - 1);
    return { lo, hi };
  }
  const nextRound: [number, number] = [roundSize, roundSize * 2 - 1];
  const laterRounds: [number, number] = [roundSize * 2, roundSize * 5 - 1];
  if (level === 60) {
    // 조금 앎(60)은 헷갈림보다 이미 더 잘 아는 단어라, 다음 라운드 안처럼 너무 이르게
    // 다시 만나지 않도록 항상 laterRounds(3~5번째 라운드) 구간에서만 고른다. 헷갈림의
    // 범위와 겹쳐도 괜찮다 — 어차피 헷갈림도 절반 확률로 같은 laterRounds를 쓴다.
    const lo = Math.max(laterRounds[0], MIN_GAP);
    const hi = Math.max(lo, laterRounds[1]);
    return { lo, hi };
  }
  // 헷갈림(40)은 다음 라운드(2번째) 안에 넣을지, 그보다 나중인 3~5번째 라운드 안에
  // 넣을지를 반반 확률로 고른다 — 라벨은 두 구간을 합친 전체 범위(최솟값~최댓값)로 보여준다.
  const lo = Math.max(Math.min(nextRound[0], laterRounds[0]), MIN_GAP);
  const hi = Math.max(nextRound[1], laterRounds[1]);
  return { lo, hi };
}

/**
 * 망각 곡선 큐: 채점 점수가 낮을수록 큐의 앞쪽(더 가까운 위치) 구간에 재삽입한다.
 * 완벽함(100)만 큐에서 완전히 제거된다(완료로 집계). 조금 앎(60)·헷갈림(40)·
 * 모름(0)은 전부 다시 꽂아 넣어 이번 세션 안에서 한 번 더 만나게 한다 — "조금
 * 앎"도 즉시 스택에서 빠지는 게 아쉽다는 피드백으로, 완벽함만 즉시 완료 처리하도록
 * 바꿨다.
 *
 * 모름(0)은 "이번 라운드 안에서 반드시 다시 만나야" 하므로, ROUND_SIZE 턴 이내의
 * 위치 중 무작위로 고른다. 헷갈림(40)은 그보다 여유를 둬서, 다음 라운드(2번째) 안에
 * 넣을지 그보다 나중인 3~5번째 라운드 안에 넣을지를 반반 확률로 고른 뒤 그 구간
 * 안에서 무작위 위치를 고른다. 조금 앎(60)은 헷갈림보다도 여유를 둬서 항상 3~5번째
 * 라운드 구간에서만 고른다 — 고정 위치가 아니라 구간에서 무작위로 뽑아 사용자가
 * "순서"를 외워버리는 것을 방지한다. 세 경우 모두 MIN_GAP보다 가까운 위치는 절대
 * 뽑히지 않는다.
 */
export function requeuePosition(queueLen: number, level: 60 | 40 | 0, roundSize: number = ROUND_SIZE): number {
  if (queueLen === 0) return 0;
  // splice 삽입 위치는 0(맨 앞)부터 queueLen(맨 끝에 추가)까지 전부 유효하다 — 남은
  // 단어가 아주 적을 때도(예: 1개) "그 단어 다음"에 꽂을 수 있도록 queueLen까지 허용한다.
  const clamp = (n: number) => Math.max(0, Math.min(n, queueLen));

  if (level === 0) {
    const { lo, hi } = requeueRangeBounds(0, roundSize);
    const loIdx = clamp(lo);
    const hiIdx = Math.max(loIdx, clamp(hi));
    return loIdx + Math.floor(Math.random() * (hiIdx - loIdx + 1));
  }

  if (level === 60) {
    const { lo, hi } = requeueRangeBounds(60, roundSize);
    const loIdx = clamp(lo);
    const hiIdx = Math.max(loIdx, clamp(hi));
    return loIdx + Math.floor(Math.random() * (hiIdx - loIdx + 1));
  }

  const nextRound: [number, number] = [roundSize, roundSize * 2 - 1];
  const laterRounds: [number, number] = [roundSize * 2, roundSize * 5 - 1];
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

/** 선택한 단어가 전부 `#순서대로` 파일의 것이면 true (섞지 않는다). 다른 파일이 하나라도 섞이면 false. */
export function isOrderedList(list: WordEntry[]): boolean {
  return list.length > 0 && list.every((w) => w.ordered);
}

/**
 * 면접 카드 앞머리의 묶음 번호를 읽는다: "【9 질문】…"은 묶음 9의 첫 카드(tail 0),
 * "【9-2 꼬리질문】…"은 묶음 9의 2번째 꼬리질문(tail 2). 표시가 없으면 null.
 */
export function chainOf(w: WordEntry): { chain: number; tail: number } | null {
  const m = w.word.match(/^【(\d+)(?:-(\d+))?\s*(?:질문|꼬리질문)】/);
  if (!m) return null;
  return { chain: Number(m[1]), tail: m[2] ? Number(m[2]) : 0 };
}

/**
 * 순서 고정(면접) 파일용 섞기: 질문 묶음(9, 9-1, 9-2 …)은 번호 순서를 그대로 두고,
 * 묶음끼리만 랜덤으로 섞는다. 묶음 표시가 없는 카드는 혼자 한 묶음으로 친다.
 */
export function chainShuffle<T extends WordEntry>(list: T[]): T[] {
  const groups: T[][] = [];
  for (const w of list) {
    const c = chainOf(w);
    const last = groups[groups.length - 1];
    const lastChain = last ? chainOf(last[0]) : null;
    if (c && c.tail > 0 && lastChain && lastChain.chain === c.chain) last.push(w);
    else groups.push([w]);
  }
  return shuffle(groups).flat();
}

/** 면접 카드 앞면이 한 줄로 너무 길어서, 화면에서만 질문/답변을 나누고 문장마다 줄을 바꿔 보여준다. */
export function formatInterviewFront(text: string): string {
  return text.replace(/\s*【답변】\s*/, "\n\n【답변】\n").replace(/([.?!])\s+(?=\S)/g, "$1\n");
}

/** 면접 카드 앞면에 적는 "키워드 + 동사" 한 묶음. 예: 규칙→지키다 */
export interface FrontKeyword {
  kw: string;
  verb: string;
}

// 카드 앞면 형식: "【1 질문】 질문? 【키워드】 규칙→지키다 / 도전→하다 【답변】 …{1|규칙을 지키}면서 …"
// - 【키워드】 칸: 키워드→동사를 " / "로 나눠 적는다(순서대로 1번, 2번 … 색이 정해진다).
// - 답변 속 {번호|문구}: 그 번호 키워드와 같은 색으로 칠한다.
const KEYWORD_BLOCK = /\s*【키워드】\s*([^【]*?)\s*(?=【답변】)/;
const INLINE_KEYWORD = /\{(\d+)\|([^}]*)\}/g;

/** 앞면 글에서 【키워드】 칸을 떼어 내고, 키워드 목록과 나머지 본문을 돌려준다. 없으면 목록이 빈 배열이다. */
export function parseFrontKeywords(text: string): { keywords: FrontKeyword[]; body: string } {
  const m = text.match(KEYWORD_BLOCK);
  if (!m) return { keywords: [], body: text };
  const keywords = m[1]
    .split("/")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [kw, verb] = x.split("→").map((y) => y.trim());
      return { kw, verb: verb ?? "" };
    });
  return { keywords, body: text.replace(KEYWORD_BLOCK, "") };
}

/** 【키워드】 칸과 {번호|…} 표시를 걷어 낸 보통 글(읽어 주기·목록 표시용). */
export function plainFront(text: string): string {
  if (!text.includes("{") && !text.includes("【키워드】")) return text;
  return parseFrontKeywords(text).body.replace(INLINE_KEYWORD, "$2");
}

/** 본문을 {번호|문구} 기준으로 나눈다. n이 있으면 키워드 문구(n번 색), 없으면 보통 글. */
export function splitInlineKeywords(text: string): { s: string; n?: number }[] {
  const out: { s: string; n?: number }[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_KEYWORD)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ s: text.slice(last, i) });
    out.push({ s: m[2], n: Number(m[1]) });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ s: text.slice(last) });
  return out;
}

/** list[index]가 속한 질문 묶음(대 질문 + 꼬리질문들)이 끝나는 다음 위치를 돌려준다. */
export function chainBlockEnd(list: WordEntry[], index: number): number {
  const c = list[index] ? chainOf(list[index]) : null;
  if (!c) return index + 1;
  let i = index + 1;
  while (i < list.length) {
    const x = chainOf(list[i]);
    if (x && x.chain === c.chain && x.tail > c.tail) i += 1;
    else break;
  }
  return i;
}

/** 순서 고정 파일이면 묶음 단위로만 섞고, 아니면 전체를 섞어서 돌려준다. */
export function shuffleUnlessOrdered<T extends WordEntry>(list: T[]): T[] {
  return isOrderedList(list) ? chainShuffle(list) : shuffle(list);
}

export function wordKey(w: WordEntry): string {
  return `${w.word}|${w.meaning}|${w.hint}`;
}

/**
 * 원본 단어장 파일에 같은 단어(같은 word/meaning/hint)가 두 번 이상 등재돼 있으면,
 * 큐에도 별개의 카드로 두 번 이상 들어간다. 방금 완벽함/조금 앎으로 "이제 안다"고
 * 답한 단어의 다른 사본이 큐에 남아 있으면, 몇 장 뒤(심하면 바로 다음 장)에 똑같은
 * 카드를 또 물어보게 되어 "완벽함을 눌렀는데 바로 다음에 또 나온다"는 문제로
 * 이어진다. 채점 직후 같은 key를 가진 나머지 사본을 큐에서 모두 제거해 이를 막는다.
 */
export function withoutKey<T extends WordEntry>(queue: T[], key: string): { queue: T[]; removed: number } {
  const kept = queue.filter((w) => wordKey(w) !== key);
  return { queue: kept, removed: queue.length - kept.length };
}
