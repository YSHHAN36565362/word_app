// 표제어 목록의 각 단어가 사전(Jisho API, JMdict 기반)에서 어느 JLPT 급수로 분류되는지 조회한다.
// 사용: node scripts/check-jlpt-levels.mjs <표제어.json> <출력.json> [캐시 폴더]
// 입력 [{w, r}] → 출력 [{w, r, lv:[1..5], found, failed}]
//   lv: 해당 표제어와 일치하는 사전 항목에 붙은 jlpt-nX 급수들(5=N5 … 1=N1)
// 용도: "N1에만 나오는 단어"를 가려내기 위해 N2~N5 급수가 붙은 단어를 걸러낸다.
// 중간에 끊겨도 캐시 폴더에 단어별 응답을 저장해 두므로 다시 실행하면 이어서 받는다.
import fs from "node:fs";
import path from "node:path";

const [inFile, outFile, cacheArg] = process.argv.slice(2);
const words = JSON.parse(fs.readFileSync(inFile, "utf8"));
const cacheDir = cacheArg ? path.resolve(cacheArg) : null;
if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (w) => [...w].map((c) => c.codePointAt(0).toString(16)).join("-");

async function lookup(w) {
  const f = cacheDir ? path.join(cacheDir, key(w) + ".json") : null;
  if (f && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  await sleep(250); // 서버에 부담을 주지 않도록 요청 사이 간격
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch("https://jisho.org/api/v1/search/words?keyword=" + encodeURIComponent(w), {
        headers: { "User-Agent": "jlpt-level-check" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const d = (await res.json()).data ?? [];
        if (f) fs.writeFileSync(f, JSON.stringify(d));
        return d;
      }
    } catch {
      /* 네트워크 오류 → 잠시 후 재시도 */
    }
    await sleep(1000 * (a + 1));
  }
  return null;
}

const out = new Array(words.length);
let next = 0;
let done = 0;
async function worker() {
  while (next < words.length) {
    const i = next++;
    const o = words[i];
    const data = await lookup(o.w);
    const lv = new Set();
    let found = false;
    for (const d of data ?? []) {
      if (!(d.japanese ?? []).some((j) => j.word === o.w || (!j.word && j.reading === o.w))) continue;
      found = true;
      for (const t of d.jlpt ?? []) {
        const m = /n(\d)$/.exec(t);
        if (m) lv.add(Number(m[1]));
      }
    }
    out[i] = { ...o, lv: [...lv].sort(), found, failed: data === null };
    if (++done % 250 === 0) console.log(`${done}/${words.length}`);
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
fs.writeFileSync(outFile, JSON.stringify(out));
console.log("done", out.length, "failed", out.filter((x) => x.failed).length);
