/**
 * 주소(URL)에 "지금 어떤 단어장으로 공부 중인지"를 담아, 그 링크를 받은 사람도 같은 단어장으로
 * 바로 시작할 수 있게 한다. 예: /study?files=word_list/Japanese/N3/a.txt|word_list/Japanese/N3/b.txt
 * 파일 경로(`files`)는 | 로 구분하고, 연습 모드(`mode`)·순서대로(`order=seq`)는 선택 항목이다.
 */

const FILES_KEY = "files";

export interface SharedStart {
  paths: string[];
  mode: string | null;
  sequential: boolean;
}

/** 지금 학습 중인 단어장을 주소에 적는다(페이지 이동 없이 주소만 바꾼다). */
export function writeShareUrl(paths: string[], extra?: { mode?: string; sequential?: boolean }) {
  if (typeof window === "undefined" || paths.length === 0) return;
  const params = new URLSearchParams();
  params.set(FILES_KEY, paths.join("|"));
  if (extra?.mode) params.set("mode", extra.mode);
  if (extra?.sequential) params.set("order", "seq");
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
}

/** 학습을 끝내면 주소에서 단어장 정보를 지운다. */
export function clearShareUrl() {
  if (typeof window === "undefined") return;
  if (!window.location.search) return;
  window.history.replaceState(window.history.state, "", window.location.pathname);
}

/** 받은 링크에 단어장 정보가 있으면 읽어서 돌려준다. */
export function readShareUrl(): SharedStart | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(FILES_KEY);
  if (!raw) return null;
  const paths = raw.split("|").map((p) => p.trim()).filter((p) => p.startsWith("word_list/"));
  if (paths.length === 0) return null;
  return { paths, mode: params.get("mode"), sequential: params.get("order") === "seq" };
}
