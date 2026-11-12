// 한자 툴팁의 "예시 단어"용 데이터(src/data/kanji-words.json)를 만든다.
// 사용: node scripts/build-kanji-words.mjs [캐시 폴더]
// 출처: https://kanjiapi.dev (JMdict 기반, 무료·키 불필요). 데이터 라이선스 CC BY-SA 4.0 (JMdict/EDRDG).
// 대상: src/data/kanji.json 에 있는 모든 한자.
// 규칙: 한자의 읽기(음독·훈독) 하나당 그 읽기로 읽히는 흔한 단어를 하나씩 고른다.
//       예) 暴 → ボウ:暴力, バク:暴露, あばく:暴く, あばれる:暴れる … (같은 단어는 한 번만, 해당 단어가 없는 읽기는 건너뜀)
// 결과 형식: { "暴": [["暴力", "ぼうりょく", "violence; mayhem"], ...] }  → [표기, 읽기, 영어 뜻]
// 중간에 끊겨도 캐시 폴더에 한자별 응답을 저장해 두므로 다시 실행하면 이어서 받는다(받아 둔 건 다시 안 받는다).
import fs from "node:fs";
import path from "node:path";

const API = "https://kanjiapi.dev/v1/words/";
const CONCURRENCY = 4;
const GAP_MS = 120; // 서버에 부담을 주지 않도록 요청 사이에 두는 간격
const MAX_PER_KANJI = 10;
const MAX_CANDIDATES = 500; // 한자당 살펴볼 단어 수(흔한 순)
const cacheDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });

const kanjiInfo = JSON.parse(fs.readFileSync("src/data/kanji.json", "utf8"));
const kanjiList = Object.keys(kanjiInfo);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanji = (c) => /[一-鿿々]/.test(c);
const isKana = (c) => /[ぁ-ゖァ-ヶー]/.test(c);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function fetchWords(c) {
  const file = cacheDir ? path.join(cacheDir, `${c.codePointAt(0).toString(16)}.json`) : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  await sleep(GAP_MS); // 실제로 서버에 물을 때만 간격을 둔다.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + encodeURIComponent(c), { headers: { "User-Agent": "kanji-words-builder" }, signal: AbortSignal.timeout(10000) });
      if (res.status === 404) {
        if (file) fs.writeFileSync(file, "[]"); // 단어가 없는 한자도 기억해 두고 다시 묻지 않는다.
        return [];
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

// 첫 글자 탁음·반탁음(연탁: は→ば/ぱ), 끝 글자 촉음(く·き·ち·つ → っ) 변형
const VOICED = { か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご", さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ", た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど", は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ" };
const SEMI = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
function variantsOf(h) {
  const out = new Set();
  const [first, ...rest] = h;
  if (VOICED[first]) out.add(VOICED[first] + rest.join(""));
  if (SEMI[first]) out.add(SEMI[first] + rest.join(""));
  if (h.length >= 2 && /[くきちつ]$/.test(h)) {
    out.add(h.slice(0, -1) + "っ");
    if (VOICED[first]) out.add(VOICED[first] + rest.slice(0, -1).join("") + "っ");
    if (SEMI[first]) out.add(SEMI[first] + rest.slice(0, -1).join("") + "っ");
  }
  out.delete(h);
  return [...out];
}

// 오십음 행(行) — 활용하는 송리가나가 같은 행인지 볼 때 쓴다(暴く → 暴か·暴き·暴け…).
const ROWS = ["あいうえお", "かきくけこ", "がぎぐげご", "さしすせそ", "ざじずぜぞ", "たちつてと", "だぢづでど", "なにぬねの", "はひふへほ", "ばびぶべぼ", "ぱぴぷぺぽ", "まみむめも", "らりるれろ", "わゐうゑを"];
const rowOf = (k) => ROWS.findIndex((r) => r.includes(k));

// 한자 읽기 하나(음독: ボウ, 훈독: あばれる)가 단어 안에서 쓰일 수 있는 모양들.
// 각 모양은 { f: 한자가 맡는 읽기, s: 떼어 낸 송리가나("" 이면 없음) }.
// exact: 그대로, loose: 연탁·촉음 등으로 바뀐 모양.
function forms(token) {
  const h = kataToHira(token);
  const isOn = token !== h; // 가타카나로 적힌 건 음독
  const exact = [{ f: h, s: "" }];
  if (!isOn) {
    // 훈독은 송리가나(활용 어미)를 떼고 어간만 읽히는 경우가 많다: あばれる → あば(れる)
    for (let n = 1; n <= 3; n++) if (h.length - n >= 1) exact.push({ f: h.slice(0, h.length - n), s: h.slice(h.length - n) });
  }
  const loose = [];
  for (const x of exact) for (const v of variantsOf(x.f)) loose.push({ f: v, s: x.s });
  return { exact, loose };
}

// 다른 한자가 가질 수 있는 읽기 전체를 정규식 조각으로 만든다(모르는 한자는 아무 읽기나 허용).
const altCache = new Map();
function altOf(ch) {
  let a = altCache.get(ch);
  if (a) return a;
  const tokens = (kanjiInfo[ch]?.j ?? "").split(/\s+/).filter(Boolean);
  if (ch === "々" || tokens.length === 0) a = ".+?";
  else {
    const set = new Set();
    for (const t of tokens) {
      const f = forms(t);
      for (const x of [...f.exact, ...f.loose]) set.add(x.f);
    }
    a = `(?:${[...set].sort((x, y) => y.length - x.length).map(escapeRe).join("|")})`;
  }
  altCache.set(ch, a);
  return a;
}

const reCache = new Map();
function re(src) {
  let r = reCache.get(src);
  if (!r) {
    if (reCache.size > 50000) reCache.clear();
    reCache.set(src, (r = new RegExp(src)));
  }
  return r;
}

// 떼어 낸 송리가나 s가 단어에서 한자 뒤에 실제로 이어지는지: 暴(れる) → "暴れ…", 暴(く) → "暴か/き/く/け/こ/い…"
function okuriganaFits(s, rest) {
  if (!s) return true;
  if (!rest || !isKana(rest[0])) return false;
  if (s.length >= 2) return rest.startsWith(s.slice(0, -1));
  const k = kataToHira(rest[0]);
  if (rowOf(k) >= 0 && rowOf(k) === rowOf(s)) return true;
  return /[うくぐすつぬぶむる]/.test(s) && /[いっん]/.test(k); // 음편(書いて·立って·読んで)
}

// word(표기)·reading(히라가나 읽기) 안에서 한자 c가 candidates 중 하나로 읽혔는지 검사한다.
// 함께 쓰인 다른 한자도 그 한자의 읽기 중 하나로 읽혀야 하고, 가나는 그대로 맞아야 한다.
function matches(c, written, reading, candidates) {
  const piece = (ch) => (isKanji(ch) ? altOf(ch) : escapeRe(kataToHira(ch)));
  for (let i = 0; i < written.length; i++) {
    if (written[i] !== c) continue;
    const before = [...written.slice(0, i)].map(piece).join("");
    const rest = written.slice(i + 1);
    const after = [...rest].map(piece).join("");
    for (const cand of candidates) {
      if (!okuriganaFits(cand.s, rest)) continue;
      if (re(`^${before}${escapeRe(cand.f)}${after}$`).test(reading)) return true;
    }
  }
  return false;
}

function pick(c, entries) {
  const cands = [];
  for (const e of entries) {
    const gloss = (e.meanings?.[0]?.glosses ?? []).slice(0, 2).join("; ");
    if (!gloss) continue;
    for (const v of e.variants ?? []) {
      if (!v.written || !v.written.includes(c) || v.written === c || v.written.length > 4) continue; // 긴 복합어는 예시로 부적합
      cands.push({ w: v.written, r: kataToHira(v.pronounced), g: gloss.length > 40 ? gloss.slice(0, 40).replace(/[;, ]+[^;,]*$/, "") : gloss, s: score(v.priorities ?? []) });
    }
  }
  // 흔한 단어 먼저, 같으면 짧은 단어 먼저
  cands.sort((a, b) => b.s - a.s || a.w.length - b.w.length);
  cands.length = Math.min(cands.length, MAX_CANDIDATES);

  const tokens = (kanjiInfo[c]?.j ?? "").split(/\s+/).filter(Boolean);
  const ownExact = new Set(tokens.map(kataToHira)); // 다른 읽기와 겹치는 변형(ハク→ばく 등)은 그 읽기 몫으로 남긴다.
  let chosen = new Map(); // token → cand
  const run = (pool) => {
    const got = new Map();
    const used = new Set();
    // 1차: 읽기가 그대로 들어맞는 단어, 2차: 연탁·촉음으로 바뀐 모양까지 허용(이미 쓴 단어는 제외)
    for (const mode of ["exact", "loose"]) {
      const claimed = new Set(); // 앞선 읽기가 이미 가져간 변형(ニチ→にっ 을 ニキ가 또 쓰지 않게)
      for (const t of tokens) {
        const f = forms(t);
        let list = f[mode];
        if (mode === "loose") {
          list = list.filter((x) => !ownExact.has(x.f) && !claimed.has(x.f));
          for (const x of f.loose) claimed.add(x.f);
        }
        if (got.has(t) || list.length === 0) continue;
        const found = pool.find((x) => !used.has(x.w) && matches(c, x.w, x.r, list));
        if (found) {
          got.set(t, found);
          used.add(found.w);
        }
      }
    }
    return got;
  };
  // 흔하다는 표시가 있는 단어만으로 먼저 고르고, 2개도 안 나오면 나머지 단어까지 본다(희귀 단어가 끼는 걸 막는다).
  chosen = run(cands.filter((x) => x.s > 0));
  if (chosen.size < 2) chosen = run(cands);
  // 훈독인데 아직 단어가 없으면, 표시가 없어도 그 읽기 그대로인 기본형(暴く=あばく)은 넣는다.
  for (const t of tokens) {
    if (chosen.has(t) || t !== kataToHira(t)) continue;
    const found = cands.find((x) => x.r === t && x.w[0] === c && x.w.length >= 2 && [...x.w.slice(1)].every(isKana) && ![...chosen.values()].some((y) => y.w === x.w));
    if (found) chosen.set(t, found);
  }
  const out = tokens.filter((t) => chosen.has(t)).map((t) => chosen.get(t)).slice(0, MAX_PER_KANJI);
  if (out.length === 0) {
    // 읽기 정보가 없거나 맞는 단어를 못 찾은 한자: 흔한 단어 2개만
    return cands.filter((x, i, a) => a.findIndex((y) => y.w === x.w) === i).slice(0, 2).map((x) => [x.w, x.r, x.g]);
  }
  return out.map((x) => [x.w, x.r, x.g]);
}

const result = {};
let done = 0;
let next = 0;
async function worker() {
  while (next < kanjiList.length) {
    const c = kanjiList[next++];
    const words = pick(c, await fetchWords(c));
    if (words.length) result[c] = words;
    if (++done % 500 === 0) console.log(`${done}/${kanjiList.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// 한자 순서를 고정해 다시 만들어도 diff가 안 흔들리게 한다.
const sorted = Object.fromEntries(Object.keys(result).sort().map((k) => [k, result[k]]));
fs.writeFileSync("src/data/kanji-words.json", JSON.stringify(sorted));
console.log("kanji with words:", Object.keys(sorted).length, "bytes:", fs.statSync("src/data/kanji-words.json").size);
