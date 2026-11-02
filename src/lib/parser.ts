import { WordEntry } from "./types";

/**
 * word_list/*.txt 파싱 규칙 (기존 Streamlit 앱과 동일):
 * 빈 줄이 단어 블록 구분자.
 * - 형식 A(콜론): "단어 : 뜻" 한 줄 + 이후 줄은 전부 힌트
 * - 형식 B(줄 구분): 1번째 줄=단어, 2번째 줄=뜻, 3번째 줄부터=힌트
 */

function splitBlocks(text: string): { blockStart: number; block: string[] }[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/：/g, ":");
  const lines = normalized.split("\n");
  const blocks: { blockStart: number; block: string[] }[] = [];
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
    if (block.length > 0) {
      blocks.push({ blockStart, block });
    }
  }

  return blocks;
}

// 파일 첫 블록이 "#순서대로" 한 줄이면 그 파일은 섞지 않고 순서대로 출제한다.
// 한 줄짜리 블록이라 카드로는 읽히지 않으므로 기존 단어장 형식은 그대로 유지된다.
const ORDER_DIRECTIVE = /^#\s*순서대로\s*$/;
function hasOrderDirective(blocks: { block: string[] }[]): boolean {
  return blocks.length > 0 && blocks[0].block.length === 1 && ORDER_DIRECTIVE.test(blocks[0].block[0]);
}

function blockToEntry(block: string[]): WordEntry | null {
  if (block[0].includes(":")) {
    const idx = block[0].indexOf(":");
    const word = block[0].slice(0, idx).trim();
    const meaning = block[0].slice(idx + 1).trim();
    const hint = block.slice(1).join("\n");
    if (word && meaning) return { word, meaning, hint };
    return null;
  }

  if (block.length >= 2) {
    const word = block[0];
    const meaning = block[1];
    const hint = block.slice(2).join("\n");
    if (word && meaning) return { word, meaning, hint };
  }

  return null;
}

/**
 * 텍스트를 단어 블록으로 파싱만 한다 (중복 제거는 하지 않음).
 * 여러 파일을 합쳐 전체 풀을 만들 때는 buildWordPool에서 최종 중복 제거를 한다.
 */
export function parseWordText(text: string): WordEntry[] {
  const parsed: WordEntry[] = [];
  const blocks = splitBlocks(text);
  const ordered = hasOrderDirective(blocks);
  for (const { block } of blocks) {
    const entry = blockToEntry(block);
    if (entry) parsed.push(ordered ? { ...entry, ordered: true } : entry);
  }
  return parsed;
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
  duplicateCount: number;
}

/**
 * 단어장 추가(업로드) 화면에서 사용.
 * 형식 오류를 수집하고, (단어·뜻·힌트) 3요소가 완전히 동일한 항목은
 * README 스펙대로 자동으로 중복 제거한 뒤 최종 목록을 반환한다.
 */
export function parseWordsWithValidation(text: string): ParseResult {
  const parsed: WordEntry[] = [];
  const errors: string[] = [];

  const allBlocks = splitBlocks(text);
  const ordered = hasOrderDirective(allBlocks);
  for (const { blockStart, block } of allBlocks) {
    if (ordered && blockStart === allBlocks[0].blockStart) continue; // "#순서대로" 표시 줄
    if (block[0].includes(":")) {
      const idx = block[0].indexOf(":");
      const word = block[0].slice(0, idx).trim();
      const meaning = block[0].slice(idx + 1).trim();
      const hint = block.slice(1).join("\n");
      if (!word) errors.push(`${blockStart + 1}번 줄: 단어가 없습니다.`);
      else if (!meaning) errors.push(`${blockStart + 1}번 줄: 뜻이 없습니다.`);
      else parsed.push(ordered ? { word, meaning, hint, ordered: true } : { word, meaning, hint });
    } else if (block.length === 1) {
      errors.push(`${blockStart + 1}번 줄: 뜻이 없는 단어입니다.`);
    } else {
      const word = block[0];
      const meaning = block[1];
      const hint = block.slice(2).join("\n");
      if (!word) errors.push(`${blockStart + 1}번 줄: 단어가 없습니다.`);
      else if (!meaning) errors.push(`${blockStart + 2}번 줄: 뜻이 없습니다.`);
      else parsed.push(ordered ? { word, meaning, hint, ordered: true } : { word, meaning, hint });
    }
  }

  const seen = new Set<string>();
  const words: WordEntry[] = [];
  for (const w of parsed) {
    const key = `${w.word}|${w.meaning}|${w.hint}`;
    if (!seen.has(key)) {
      seen.add(key);
      words.push(w);
    }
  }

  return { words, errors, duplicateCount: parsed.length - words.length };
}

/**
 * 선택한 여러 파일의 텍스트를 합쳐 단어 풀을 만든다.
 * 파일 내부/파일 간 (단어·뜻·힌트) 완전 중복 항목은 최종적으로 한 번만 남긴다.
 */
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
