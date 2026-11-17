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

/**
 * 팝업·학습 보조 옵션(종류와 별개로 켜고 끄는 것).
 * - ko: 뜻을 한국어로 보여준다(한국어 뜻이 없는 항목은 영어 뜻 그대로).
 * - jlpt: 한자·단어 옆에 JLPT 급수를 붙인다.
 * - offline: 한 번 연 화면·단어장·문장 정보를 기기에 저장해 네트워크 없이도 다시 열 수 있게 한다.
 */
export const POPUP_OPTIONS = [
  { id: "ko", label: "한국어 뜻", def: true },
  { id: "jlpt", label: "JLPT 급수", def: true },
  { id: "offline", label: "오프라인 저장", def: false },
] as const;

export type PopupOption = (typeof POPUP_OPTIONS)[number]["id"];
export type PopupOptions = Record<PopupOption, boolean>;

const OPTIONS_KEY = "word_app_popup_options";
export const POPUP_OPTIONS_EVENT = "word_app_popup_options_change";

export const DEFAULT_POPUP_OPTIONS = Object.fromEntries(POPUP_OPTIONS.map((o) => [o.id, o.def])) as PopupOptions;

export function loadPopupOptions(): PopupOptions {
  const out = { ...DEFAULT_POPUP_OPTIONS };
  if (typeof window === "undefined") return out;
  try {
    const raw = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) ?? "{}");
    for (const o of POPUP_OPTIONS) if (typeof raw?.[o.id] === "boolean") out[o.id] = raw[o.id];
  } catch {
    /* 저장값이 깨졌으면 기본값 */
  }
  return out;
}

export function savePopupOption(id: PopupOption, on: boolean) {
  const next = { ...loadPopupOptions(), [id]: on };
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막힌 환경에서는 이번 화면에서만 적용된다 */
  }
  window.dispatchEvent(new Event(POPUP_OPTIONS_EVENT));
}

/** JLPT 급수 표시(5 → "N5" … 1 → "N1"). 급수가 없으면 빈 문자열. */
export function jlptLabel(level: number | undefined): string {
  return level && level >= 1 && level <= 5 ? `N${level}` : "";
}
