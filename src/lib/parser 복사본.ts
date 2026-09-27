import { WordEntry } from "./types";

/**
 * word_list/*.txt 파싱 규칙 (기존 Streamlit 앱과 동일):
 * 빈 줄이 단어 블록 구분자.
 * - 형식 A(콜론): "단어 : 뜻" 한 줄 + 이후 줄은 전부 힌트
 * - 형식 B(줄 구분): 1번째 줄=단어, 2번째 줄=뜻, 3번째 줄부터=힌트
 */
export function parseWordText(text: string): WordEntry[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/：/g, ":");
  const lines = normalized.split("\n");
  const parsed: WordEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    const block: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      block.push(lines[i].trim());
      i++;
    }
    if (block.length === 0) continue;

    if (block[0].includes(":")) {
      const idx = block[0].indexOf(":");
      const word = block[0].slice(0, idx).trim();
      const meaning = block[0].slice(idx + 1).trim();
      const hint = block.slice(1).join("\n");
      if (word && meaning) parsed.push({ word, meaning, hint });
    } else if (block.length >= 2) {
      const word = block[0];
      const meaning = block[1];
      const hint = block.slice(2).join("\n");
      if (word && meaning) parsed.push({ word, meaning, hint });
    }
  }

  const seen = new Set<string>();
  const result: WordEntry[] = [];
  for (const w of parsed) {
    const key = `${w.word}|${w.meaning}|${w.hint}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(w);
    }
  }
  return result;
}

export function parseScriptText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  return normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export interface ParseResult {
  words: WordEntry[];
  errors: string[];
}

export function parseWordsWithValidation(text: string): ParseResult {
  const normalized = text.replace(/\r\n/g, "\n").replace(/：/g, ":");
  const lines = normalized.split("\n");
  const parsed: WordEntry[] = [];
  const errors: string[] = [];
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    const blockStart = i;
    const block: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      block.push(lines[i].trim());
      i++;
    }
    if (block.length === 0) continue;

    if (block[0].includes(":")) {
      const idx = block[0].indexOf(":");
      const word = block[0].slice(0, idx).trim();
      const meaning = block[0].slice(idx + 1).trim();
      const hint = block.slice(1).join("\n");
      if (!word) errors.push(`${blockStart + 1}번 줄: 단어가 없습니다.`);
      else if (!meaning) errors.push(`${blockStart + 1}번 줄: 뜻이 없습니다.`);
      else parsed.push({ word, meaning, hint });
    } else {
      if (block.length === 1) {
        errors.push(`${blockStart + 1}번 줄: 뜻이 없는 단어입니다.`);
      } else {
        const word = block[0];
        const meaning = block[1];
        const hint = block.slice(2).join("\n");
        if (!word) errors.push(`${blockStart + 1}번 줄: 단어가 없습니다.`);
        else if (!meaning) errors.push(`${blockStart + 2}번 줄: 뜻이 없습니다.`);
        else parsed.push({ word, meaning, hint });
      }
    }
  }

  return { words: parsed, errors };
}

export function buildWordPool(fileTexts: string[]): WordEntry[] {
  const seen = new Set<string>();
  const pool: WordEntry[] = [];
  for (const text of fileTexts) {
    for (const w of parseWordText(text)) {
      const key = `${w.word}|${w.meaning}|${w.hint}`;
      if (!seen.has(key)) {
        seen.add(key);
        pool.push(w);
      }
    }
  }
  return pool;
}

const FILENAME_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

export function extractYearMonth(filename: string): [number, number] | null {
  const m = FILENAME_DATE_RE.exec(filename);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

export function makeSafeFilename(name: string): string {
  const invalid = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
  let safe = name.trim();
  for (const ch of invalid) safe = safe.split(ch).join("_");
  if (!safe) safe = "untitled";
  if (!safe.toLowerCase().endsWith(".txt")) safe += ".txt";
  return safe;
}
