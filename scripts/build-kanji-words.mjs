// 한자 툴팁의 "예시 단어"용 데이터(src/data/kanji-words.json)를 만든다.
// 사용: node scripts/build-kanji-words.mjs [캐시 폴더]
// 출처: https://kanjiapi.dev (JMdict 기반, 무료·키 불필요). 데이터 라이선스 CC BY-SA 4.0 (JMdict/EDRDG).
// 대상: src/data/kanji.json 에 있는 모든 한자. 한자당 흔히 쓰는 단어 최대 4개만 남긴다.
// 결과 형식: { "潔": [["簡潔", "かんけつ", "concise"], ...] }  → [표기, 읽기, 영어 뜻]
// 중간에 끊겨도 캐시 폴더에 한자별 응답을 저장해 두므로 다시 실행하면 이어서 받는다.
import fs from "node:fs";
import path from "node:path";

const API = "https://kanjiapi.dev/v1/words/";
const MAX_WORDS = 4;
const CONCURRENCY = 4;
const GAP_MS = 120; // 서버에 부담을 주지 않도록 요청 사이에 두는 간격
const cacheDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });

const kanjiList = Object.keys(JSON.parse(fs.readFileSync("src/data/kanji.json", "utf8")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWords(c) {
  const file = cacheDir ? path.join(cacheDir, `${c.codePointAt(0).toString(16)}.json`) : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + encodeURIComponent(c), { headers: { "User-Agent": "kanji-words-builder" } });
      if (res.status === 404) return [];
      if (res.ok) {
        const data = await res.json();
        if (file) fs.writeFileSync(file, JSON.stringify(data));
        return data;
      }
    } catch {
      /* 네트워크 오류 → 잠시 후 재시도 */
    }
    await sleep(800 * (attempt + 1));
  }
  throw new Error(`failed: ${c}`);
}

// 자주 쓰이는 정도(JMdict priority 표시)를 점수로 바꾼다.
function score(priorities) {
  let s = 0;
  for (const p of priorities) {
    if (/^(news1|ichi1|spec1|gai1)$/.test(p)) s += 3;
    else if (/^(news2|ichi2|spec2|gai2)$/.test(p)) s += 1;
    const nf = /^nf(\d+)$/.exec(p);
    if (nf) s += (49 - Number(nf[1])) / 48;
  }
  return s;
}

function pick(c, entries) {
  const cands = [];
  for (const e of entries) {
    const gloss = (e.meanings?.[0]?.glosses ?? []).slice(0, 2).join("; ");
    if (!gloss) continue;
    for (const v of e.variants ?? []) {
      if (!v.written || !v.written.includes(c) || v.written === c) continue;
      cands.push({ w: v.written, r: v.pronounced, g: gloss.length > 40 ? gloss.slice(0, 40).replace(/[;, ]+[^;,]*$/, "") : gloss, s: score(v.priorities ?? []) });
    }
  }
  cands.sort((a, b) => b.s - a.s || a.w.length - b.w.length);
  const seen = new Set();
  const out = [];
  for (const x of cands) {
    if (seen.has(x.w)) continue;
    if (x.s === 0 && out.length >= 2) break; // 흔하다는 표시가 없는 단어는 모자랄 때만 최대 2개
    seen.add(x.w);
    out.push([x.w, x.r, x.g]);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

const result = {};
let done = 0;
let next = 0;
async function worker() {
  while (next < kanjiList.length) {
    const c = kanjiList[next++];
    const words = pick(c, await fetchWords(c));
    if (words.length) result[c] = words;
    if (++done % 200 === 0) console.log(`${done}/${kanjiList.length}`);
    await sleep(GAP_MS);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// 한자 순서를 고정해 다시 만들어도 diff가 안 흔들리게 한다.
const sorted = Object.fromEntries(Object.keys(result).sort().map((k) => [k, result[k]]));
fs.writeFileSync("src/data/kanji-words.json", JSON.stringify(sorted));
console.log("kanji with words:", Object.keys(sorted).length, "bytes:", fs.statSync("src/data/kanji-words.json").size);
