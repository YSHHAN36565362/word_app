import { NextResponse } from "next/server";
import path from "node:path";
import kuromoji from "kuromoji";
import kanjiData from "@/data/kanji.json";
import kanaWords from "@/data/kana-words.json";
import type { PopupKind } from "@/lib/popupKinds";

export const runtime = "nodejs";

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

// 사전을 읽는 데 1~2초 걸려서 한 번만 만들어 두고 계속 쓴다(서버 인스턴스가 살아 있는 동안).
let tokenizerPromise: Promise<Tokenizer> | null = null;
function getTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: path.join(process.cwd(), "node_modules", "kuromoji", "dict") }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
    tokenizerPromise.catch(() => {
      tokenizerPromise = null; // 실패하면 다음 요청에서 다시 시도한다.
    });
  }
  return tokenizerPromise;
}

const KANJI = /[一-鿿々]/;
const kataToHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

interface KanjiInfo {
  c: string; // 한자
  h: string; // 한국 한자음
  j: string; // 일본 음독·훈독
  e: string; // 영어 뜻
}

// 한자 없이 쓰인 단어의 뜻(scripts/build-kana-words.mjs 가 만든 데이터)
interface KanaWord {
  e: string; // 영어 뜻
  k?: string; // 한자 표기
  ko?: string; // 한국어 뜻(단어장에 실려 있을 때)
}

interface Token {
  s: string;
  r: string | null; // 히라가나 읽기(한자가 든 조각에만)
  k?: KanjiInfo[]; // 한자 정보(읽기가 있는 조각에만)
  c?: PopupKind; // 팝업 종류(팝업이 뜨는 조각에만)
  b?: string; // 기본형(가나 단어: できれば → できる)
  w?: KanaWord; // 가나 단어의 뜻
}

const KANA_WORDS = kanaWords as Record<string, KanaWord>;
const KATA_ONLY = /^[ァ-ヶー]+$/;

// 형태소의 품사 → 가나 단어 팝업 종류. scripts/build-kana-words.mjs 의 kindOf 와 같은 규칙이어야 한다.
function kindOf(t: kuromoji.IpadicFeatures, word: string): PopupKind | null {
  if (t.pos === "副詞") return "adv";
  if (t.pos === "接続詞") return "conj";
  if (t.pos === "動詞" && t.pos_detail_1 === "自立") return "verb";
  if ((t.pos === "形容詞" && t.pos_detail_1 === "自立") || (t.pos === "名詞" && t.pos_detail_1 === "形容動詞語幹")) return "adj";
  if (t.pos === "名詞" && ["一般", "サ変接続", "副詞可能", "代名詞"].includes(t.pos_detail_1)) return KATA_ONLY.test(word) ? "kata" : "noun";
  return null;
}

function toToken(t: kuromoji.IpadicFeatures): Token {
  const s = t.surface_form;
  if (KANJI.test(s)) {
    const reading = t.reading && t.reading !== "*" ? t.reading : "";
    return reading ? { s, r: kataToHira(reading), k: kanjiInfoOf(s), c: "kanji" } : { s, r: null };
  }
  const base = t.basic_form && t.basic_form !== "*" ? t.basic_form : s;
  const kind = kindOf(t, base);
  const w = kind ? KANA_WORDS[base] : undefined;
  return kind && w ? { s, r: null, c: kind, b: base, w } : { s, r: null };
}

const KANJI_DATA = kanjiData as Record<string, { h: string; j: string; e: string }>;

function kanjiInfoOf(surface: string): KanjiInfo[] {
  const seen = new Set<string>();
  const out: KanjiInfo[] = [];
  for (const c of surface) {
    if (!KANJI.test(c) || seen.has(c)) continue;
    seen.add(c);
    const d = KANJI_DATA[c];
    if (d) out.push({ c, h: d.h, j: d.j, e: d.e });
  }
  return out;
}

/**
 * POST { texts: string[] } → { results: Token[][] }
 * 각 문장을 형태소로 나눠, 팝업을 띄울 수 있는 조각에 정보를 붙여 돌려준다.
 * - 한자가 든 조각: 히라가나 읽기(r) + 한자별 정보(k)
 * - 한자 없이 쓰인 부사·접속사·동사·형용사·명사·가타카나어: 기본형(b) + 뜻(w)
 * 어떤 종류(c)를 실제로 보여줄지는 화면(Furigana)이 사용자의 설정에 따라 고른다.
 */
export async function POST(req: Request) {
  let body: { texts?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const texts = Array.isArray(body.texts) ? body.texts.filter((t): t is string => typeof t === "string") : [];
  if (texts.length === 0 || texts.length > 80 || texts.some((t) => t.length > 3000)) {
    return NextResponse.json({ error: "texts는 1~80개, 각 3000자 이하여야 합니다." }, { status: 400 });
  }
  try {
    const tokenizer = await getTokenizer();
    const results: Token[][] = texts.map((text) => tokenizer.tokenize(text).map(toToken));
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[furigana] failed", e);
    return NextResponse.json({ error: "읽기를 만들지 못했습니다." }, { status: 500 });
  }
}
