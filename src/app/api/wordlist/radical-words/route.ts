import { NextRequest, NextResponse } from "next/server";
import { getFileContent } from "@/lib/github";
import { buildWordPool } from "@/lib/parser";
import { WordEntry, RadicalLibrary } from "@/lib/types";

export const revalidate = 300;

const RADICAL_PATH = "resources/radicals.json";

async function loadLibrary(): Promise<RadicalLibrary> {
  const raw = await getFileContent(RADICAL_PATH);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * 선택한 파일들의 단어에 들어있는 한자 중, 부수 사전에 등록된 글자만 중복 없이 뽑아
 * "단어처럼" 만든다 (word=한자, meaning=훈음, hint=설명).
 */
export async function POST(req: NextRequest) {
  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ words: [] });
  }
  const [texts, library] = await Promise.all([Promise.all(paths.map((p) => getFileContent(p))), loadLibrary()]);
  const words = buildWordPool(texts);

  if (Object.keys(library).length === 0) {
    return NextResponse.json({ words: [] });
  }

  const seen = new Set<string>();
  const result: WordEntry[] = [];
  for (const w of words) {
    for (const ch of w.word) {
      if (seen.has(ch)) continue;
      const code = ch.codePointAt(0) ?? 0;
      const isCjk = code >= 0x4e00 && code <= 0x9fff;
      if (isCjk && library[ch]) {
        seen.add(ch);
        const info = library[ch];
        result.push({ word: ch, meaning: info.reading || "", hint: info.desc || "" });
      }
    }
  }

  return NextResponse.json({ words: result });
}
