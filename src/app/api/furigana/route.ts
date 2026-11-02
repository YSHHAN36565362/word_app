import { NextResponse } from "next/server";
import path from "node:path";
import kuromoji from "kuromoji";

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

interface Token {
  s: string;
  r: string | null;
}

/**
 * POST { texts: string[] } → { results: Token[][] }
 * 각 문장을 형태소로 나눠, 한자가 들어 있는 조각에만 히라가나 읽기(r)를 붙여 돌려준다.
 * (화면에서 한자에 마우스를 올리면 읽기를 툴팁으로 띄우는 데 쓴다.)
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
    const results: Token[][] = texts.map((text) =>
      tokenizer.tokenize(text).map((t) => ({
        s: t.surface_form,
        r: KANJI.test(t.surface_form) && t.reading && t.reading !== "*" ? kataToHira(t.reading) : null,
      }))
    );
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[furigana] failed", e);
    return NextResponse.json({ error: "읽기를 만들지 못했습니다." }, { status: 500 });
  }
}
