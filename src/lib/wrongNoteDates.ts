import { WordEntry } from "./types";

/** 날짜 정보가 없는(예전에 쌓인) 오답 노트 단어를 묶는 키. */
export const NO_DATE_KEY = "none";

/** 오답 노트 단어가 들어온 날짜(한국 시간 기준 YYYY-MM-DD). 날짜가 없으면 NO_DATE_KEY. */
export function wrongNoteDateKey(w: WordEntry): string {
  if (!w.addedAt) return NO_DATE_KEY;
  const d = new Date(w.addedAt);
  if (Number.isNaN(d.getTime())) return NO_DATE_KEY;
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
