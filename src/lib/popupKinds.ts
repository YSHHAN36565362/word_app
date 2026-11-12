/**
 * 문장 속 단어를 누르면 뜨는 팝업의 종류. 종류마다 켜고 끌 수 있다(학습·연습 화면의 설정).
 * - kanji: 한자가 들어간 단어 → 읽기 + 한자별 정보 + 예시 단어
 * - 나머지: 한자 없이 쓰인 단어 → 뜻(한국어·영어)과 한자 표기
 * 종류를 정하는 규칙은 src/app/api/furigana/route.ts 의 kindOf 에 있다.
 */
export const POPUP_KINDS = [
  { id: "kanji", label: "한자" },
  { id: "adv", label: "부사" },
  { id: "conj", label: "접속사" },
  { id: "verb", label: "동사" },
  { id: "adj", label: "형용사" },
  { id: "noun", label: "명사" },
  { id: "kata", label: "가타카나" },
] as const;

export type PopupKind = (typeof POPUP_KINDS)[number]["id"];

const KEY = "word_app_popup_kinds_off";
export const POPUP_KINDS_EVENT = "word_app_popup_kinds_change";

const VALID = new Set<string>(POPUP_KINDS.map((k) => k.id));

/** 꺼 둔 종류 목록을 읽는다(저장된 게 없으면 전부 켜짐). */
export function loadPopupKindsOff(): PopupKind[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw.filter((x) => typeof x === "string" && VALID.has(x)) as PopupKind[]) : [];
  } catch {
    return [];
  }
}

export function savePopupKindsOff(off: PopupKind[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(off));
  } catch {
    /* 저장이 막힌 환경(사생활 보호 모드 등)에서는 이번 화면에서만 적용된다 */
  }
  window.dispatchEvent(new Event(POPUP_KINDS_EVENT));
}
