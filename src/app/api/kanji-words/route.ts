import { NextResponse } from "next/server";
import kanjiWords from "@/data/kanji-words.json";
import koWords from "@/data/ko-words.json";

export const runtime = "nodejs";

// 저장된 모양: [표기, 읽기, 영어 뜻] → 응답: [표기, 읽기, 영어 뜻, 한국어 뜻(없으면 "")]
type Word = [string, string, string];
type WordOut = [string, string, string, string];
const DATA = kanjiWords as unknown as Record<string, Word[]>;
const KO_WORDS = koWords as Record<string, string>;

/**
 * GET /api/kanji-words?c=潔不 → { "潔": [["簡潔","かんけつ","concise"], ...], "不": [...] }
 * 한자 툴팁에 붙일 예시 단어. 팝업을 열 때 그 한자들만 가져가서 처음 화면이 무거워지지 않는다.
 * (데이터는 scripts/build-kanji-words.mjs 가 kanjiapi.dev 에서 받아 저장한 것)
 */
export function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("c") ?? "";
  const chars = [...new Set([...raw])].slice(0, 12);
  if (chars.length === 0) return NextResponse.json({ error: "c(한자)가 필요합니다." }, { status: 400 });
  const out: Record<string, WordOut[]> = {};
  for (const c of chars) out[c] = (DATA[c] ?? []).map(([w, r, g]) => [w, r, g, KO_WORDS[w] ?? ""]);
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=86400" } });
}
