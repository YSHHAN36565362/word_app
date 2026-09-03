"use client";

/**
 * 단어장 힌트는 `[읽기] …`, `[한자1] …`, `· 음독: …`, `[치트키] …`처럼 구간이 일정한
 * 형식으로 되어 있다. 사람마다 필요한 구간이 다른데(예: 한자 분해는 이미 아는 사람,
 * 예문만 보고 싶은 사람) 지금까지는 전부 한 덩어리 회색 텍스트로 나왔다.
 * 여기서 구간을 식별해두고, 사용자가 구간별로 색/크기/표시 여부를 정할 수 있게 한다.
 */

export type HintSectionKey =
  | "reading"
  | "kanji"
  | "kanjiHeader"
  | "summary"
  | "mnemonic"
  | "scene"
  | "example"
  | "conjugation"
  | "confusable"
  | "etc";

export interface HintSectionDef {
  key: HintSectionKey;
  label: string; // 설정 화면에 보여줄 이름
  sample: string; // 설정 화면 미리보기용 예시
}

/** 설정 화면에 이 순서대로 보여준다(힌트 본문에 나오는 순서와 같게). */
export const HINT_SECTIONS: HintSectionDef[] = [
  { key: "reading", label: "읽기 · 악센트", sample: "[읽기] 従=したが + う → したがう (훈독)" },
  {
    key: "kanjiHeader",
    label: "한자 항목 제목 강조 (한자1, 한자2 …)",
    sample: "[한자1] 従 (좇을 종 / 따르다)  ← 이 줄만 별도 색상",
  },
  { key: "kanji", label: "한자 분해 내용 (음독/훈독/어원)", sample: "· 음독: ジュウ  · 훈독: ★したが-う" },
  { key: "summary", label: "종합 설명", sample: "[종합] 윗사람의 명령이나 정해진 규칙을…" },
  { key: "mnemonic", label: "암기 치트키", sample: "[치트키] \"시타가우! 시타(아래) 가우…\"" },
  { key: "scene", label: "장면 이미지", sample: "[장면] 어미 오리가 앞장서서 걷고…" },
  { key: "example", label: "예문", sample: "[예문] 規則に従う(키소쿠니 시타가우)" },
  { key: "conjugation", label: "활용형", sample: "[활용] ます형: 従います · ない형: 従わない" },
  { key: "confusable", label: "헷갈리는 단어", sample: "[헷갈리는 단어] 負ける(まける) - …" },
  { key: "etc", label: "그 외", sample: "[유래] Machine (머신) = 기계" },
];

export interface HintSectionStyle {
  // 대부분의 구간에서는 "이 구간을 아예 표시할지"를 뜻한다. 다만 kanjiHeader는
  // 예외로, 이 값은 "[한자1]/[한자2]… 제목 줄에 별도 강조를 적용할지"를 뜻한다 —
  // 꺼도 그 줄이 사라지지 않고, 그냥 kanji 구간과 같은 스타일로 섞여 보일 뿐이다
  // (한자 소제목만 없애면 그 아래 음독/훈독이 어느 한자 것인지 알 수 없게 되므로).
  visible: boolean;
  color: string; // CSS 색상 값(빈 문자열이면 본문 기본색)
  scale: number; // 글자 크기 배율 0.8 ~ 1.6
}

export type HintTheme = Record<HintSectionKey, HintSectionStyle>;

export const HINT_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "기본", value: "" },
  { label: "초록", value: "var(--accent)" },
  { label: "파랑", value: "var(--blue)" },
  { label: "노랑", value: "var(--amber)" },
  { label: "빨강", value: "var(--red)" },
  { label: "흐리게", value: "var(--text-muted)" },
];

export const HINT_SCALE_MIN = 0.8;
export const HINT_SCALE_MAX = 1.6;
export const HINT_SCALE_STEP = 0.1;

/** 기본 테마: 전부 보이되, 자주 찾는 구간(치트키·예문)에만 색을 준다. */
export const DEFAULT_HINT_THEME: HintTheme = {
  reading: { visible: true, color: "var(--blue)", scale: 1 },
  // 한자1/한자2가 화면에서 멀리 떨어져 있어 어디부터 새 한자인지 훑어보기 어렵다는
  // 요청으로, 제목 줄만 본문(kanji)과 다른 색으로 강조해 눈에 잘 띄게 한다.
  kanjiHeader: { visible: true, color: "var(--red-dark)", scale: 1.05 },
  kanji: { visible: true, color: "", scale: 1 },
  summary: { visible: true, color: "", scale: 1 },
  mnemonic: { visible: true, color: "var(--accent)", scale: 1 },
  scene: { visible: true, color: "", scale: 1 },
  example: { visible: true, color: "var(--amber)", scale: 1 },
  conjugation: { visible: true, color: "", scale: 1 },
  confusable: { visible: true, color: "var(--red)", scale: 1 },
  etc: { visible: true, color: "", scale: 1 },
};

// 대괄호 태그 → 구간. 숫자가 붙는 태그(한자1, 예문2)는 숫자를 떼고 비교한다.
const TAG_TO_SECTION: Record<string, HintSectionKey> = {
  읽기: "reading",
  악센트: "reading",
  한자: "kanji",
  종합: "summary",
  치트키: "mnemonic",
  장면: "scene",
  예문: "example",
  활용: "conjugation",
  "헷갈리는 단어": "confusable",
  유래: "etc",
};

const TAG_LINE = /^\s*\[([^\]]+)\]/;

/**
 * 힌트 한 줄이 어느 구간인지 판단한다. 태그가 없는 줄(`· 음독: …`이나 이어지는 본문)은
 * 바로 앞 줄의 구간을 그대로 물려받는다 — 그래야 여러 줄짜리 종합 설명이나 한자
 * 하위 항목이 통째로 같이 숨겨지고 같이 강조된다.
 */
export function sectionOfLine(line: string, prev: HintSectionKey): HintSectionKey {
  const m = line.match(TAG_LINE);
  if (!m) return prev;
  const tag = m[1].replace(/\d+$/, "").trim();
  return TAG_TO_SECTION[tag] ?? "etc";
}

const STORAGE_KEY = "word_app_hint_theme";

export function loadHintTheme(): HintTheme {
  if (typeof window === "undefined") return DEFAULT_HINT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HINT_THEME;
    const parsed = JSON.parse(raw) as Partial<HintTheme>;
    // 저장된 값이 일부만 있거나 옛 버전이어도 기본값 위에 덮어써서 항상 완전한 형태로.
    const out = { ...DEFAULT_HINT_THEME };
    for (const s of HINT_SECTIONS) {
      const v = parsed[s.key];
      if (v && typeof v.visible === "boolean" && typeof v.scale === "number" && typeof v.color === "string") {
        out[s.key] = { visible: v.visible, color: v.color, scale: Math.min(HINT_SCALE_MAX, Math.max(HINT_SCALE_MIN, v.scale)) };
      }
    }
    return out;
  } catch {
    return DEFAULT_HINT_THEME;
  }
}

export function saveHintTheme(theme: HintTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // 저장 실패(사생활 보호 모드 등)해도 이번 세션 표시에는 문제없으니 조용히 넘어간다.
  }
}
