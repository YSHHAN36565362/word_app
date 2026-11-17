// 한자별 JLPT 급수(src/data/kanji-jlpt.json)를 만든다.
// 사용: node scripts/build-kanji-jlpt.mjs [캐시 폴더]
// 출처: https://kanjiapi.dev/v1/kanji/{한자} 의 jlpt 값(5=N5 가장 쉬움 … 1=N1).
// 결과 형식: { "潔": 1, "日": 5 }  → 화면에서는 N1, N5 처럼 보여준다.
// 캐시 폴더에 한자별 응답을 저장해 두므로 다시 실행하면 이어서 받는다.
import fs from "node:fs";
import path from "node:path";

const API = "https://kanjiapi.dev/v1/kanji/";
const CONCURRENCY = 4;
const GAP_MS = 120;
const cacheDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });

const kanjiList = Object.keys(JSON.parse(fs.readFileSync("src/data/kanji.json", "utf8")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchKanji(c) {
  const file = cacheDir ? path.join(cacheDir, `${c.codePointAt(0).toString(16)}.json`) : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  await sleep(GAP_MS);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + encodeURIComponent(c), { headers: { "User-Agent": "kanji-jlpt-builder" }, signal: AbortSignal.timeout(10000) });
      if (res.status === 404) {
        if (file) fs.writeFileSync(file, "{}");
        return {};
      }
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

const result = {};
let done = 0;
let next = 0;
async function worker() {
  while (next < kanjiList.length) {
    const c = kanjiList[next++];
    const level = (await fetchKanji(c)).jlpt;
    if (level >= 1 && level <= 5) result[c] = level;
    if (++done % 500 === 0) console.log(`${done}/${kanjiList.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const sorted = Object.fromEntries(Object.keys(result).sort().map((k) => [k, result[k]]));
fs.writeFileSync("src/data/kanji-jlpt.json", JSON.stringify(sorted));
console.log("kanji with jlpt:", Object.keys(sorted).length);
