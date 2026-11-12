// 한자 없이 쓰인 단어(ますます, しかし, サービス, できる, きれい …) 툴팁용 데이터(src/data/kana-words.json)를 만든다.
// 사용: node scripts/build-kana-words.mjs [캐시 폴더]
// 대상: word_list 안의 문장을 형태소 분석해서 나온, 한자 없이 쓰인 부사·접속사·동사·형용사·명사·가타카나어.
// 뜻: 영어는 Jisho API(https://jisho.org/api/v1/search/words, JMdict 기반·무료·키 불필요, CC BY-SA),
//     한국어는 단어장에 "단어 / 뜻(읽기)" 꼴로 실려 있으면 그 뜻을 쓴다.
// 결과 형식: { "ますます": { "k": "益々", "ko": "점점 더, 더욱더", "e": "increasingly; more and more" } }
//   k: 한자 표기(있을 때), ko: 한국어 뜻(단어장에 있을 때), e: 영어 뜻
// 히라가나 단어는 사전에서 "보통 가나로 쓴다"고 표시된 것만 넣는다(한자어의 읽기 조각이 잘못 잡히는 걸 막는다).
// 중간에 끊겨도 캐시 폴더에 단어별 응답을 저장해 두므로 다시 실행하면 이어서 받는다.
import fs from "node:fs";
import path from "node:path";
import kuromoji from "kuromoji";

const API = "https://jisho.org/api/v1/search/words?keyword=";
const CONCURRENCY = 3;
const GAP_MS = 250; // 서버에 부담을 주지 않도록 요청 사이에 두는 간격
const MIN_COUNT = 2; // 히라가나 동사·형용사·명사는 단어장에 이만큼은 나와야 찾아본다(잘못 잘린 조각 줄이기)
const cacheDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HAS_KANJI = /[一-鿿々]/;
const HIRA_ONLY = /^[ぁ-ゖー]+$/;
const KATA_ONLY = /^[ァ-ヶー]+$/;

// 형태소의 품사 → 팝업 종류. src/app/api/furigana/route.ts 의 kindOf 와 같은 규칙이어야 한다.
function kindOf(t, w) {
  if (t.pos === "副詞") return "adv";
  if (t.pos === "接続詞") return "conj";
  if (t.pos === "動詞" && t.pos_detail_1 === "自立") return "verb";
  if ((t.pos === "形容詞" && t.pos_detail_1 === "自立") || (t.pos === "名詞" && t.pos_detail_1 === "形容動詞語幹")) return "adj";
  if (t.pos === "名詞" && ["一般", "サ変接続", "副詞可能", "代名詞"].includes(t.pos_detail_1)) return KATA_ONLY.test(w) ? "kata" : "noun";
  return null;
}
// 종류별로 사전(Jisho)의 어느 품사 뜻을 쓸지
const SENSE_POS = { adv: /Adverb/, conj: /Conjunction/, verb: /(^| )verb/i, adj: /adjective/i, noun: /Noun|Pronoun/, kata: /./ };

const tokenizer = await new Promise((resolve, reject) =>
  kuromoji.builder({ dicPath: path.join(process.cwd(), "node_modules", "kuromoji", "dict") }).build((e, t) => (e ? reject(e) : resolve(t)))
);

// 1) 단어장에서 히라가나 부사·접속사와 한국어 뜻을 모은다.
const wanted = new Map(); // 단어 → { n: 나온 횟수, kinds: 종류들 }
const korean = new Map(); // 읽기 → [{ head: 표제어, ko: 뜻 }]
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".txt")) scan(fs.readFileSync(full, "utf8").split("\n"));
  }
}
function scan(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // "뜻(읽기)" 줄: 바로 윗줄이 표제어
    const m = /^([^()（）]{1,40})[(（]([ぁ-ゖー]+)[)）]$/.exec(line);
    if (m && i > 0 && /[가-힣]/.test(m[1])) {
      const head = lines[i - 1].trim();
      if (head && head.length <= 12 && !/[가-힣]/.test(head)) {
        const list = korean.get(m[2]) ?? [];
        if (!list.some((x) => x.head === head)) list.push({ head, ko: m[1].trim() });
        korean.set(m[2], list);
      }
    }
    // 읽기만 적힌 줄(전부 히라가나)은 형태소가 엉뚱하게 잘리므로, 한자가 섞인 실제 문장만 본다.
    if (!HAS_KANJI.test(line) || line.length > 300) continue;
    for (const t of tokenizer.tokenize(line)) {
      const w = t.basic_form && t.basic_form !== "*" ? t.basic_form : t.surface_form;
      if (w.length < 2 || !(HIRA_ONLY.test(w) || KATA_ONLY.test(w)) || HAS_KANJI.test(t.surface_form)) continue;
      const kind = kindOf(t, w);
      if (!kind) continue;
      const rec = wanted.get(w) ?? { n: 0, kinds: new Set() };
      rec.n++;
      rec.kinds.add(kind);
      wanted.set(w, rec);
    }
  }
}
walk(path.join(process.cwd(), "word_list"));
// 단어장 표제어로 실린 히라가나 단어(부사 단어장 등)는 문장에 안 나와도 넣는다.
for (const [reading, list] of korean) {
  if (!list.some((x) => x.head === reading) || reading.length < 2) continue;
  const rec = wanted.get(reading) ?? { n: 0, kinds: new Set(Object.keys(SENSE_POS)) };
  rec.n += MIN_COUNT;
  wanted.set(reading, rec);
}
// 드물게 한 번만 나온 히라가나 동사·형용사·명사는 잘못 잘린 조각일 가능성이 높아 뺀다.
for (const [w, rec] of wanted) {
  const sure = rec.kinds.has("adv") || rec.kinds.has("conj") || rec.kinds.has("kata");
  if (!sure && rec.n < MIN_COUNT) wanted.delete(w);
}
console.log("words to look up:", wanted.size);

// 2) Jisho에서 뜻을 받는다.
async function lookup(w) {
  const file = cacheDir ? path.join(cacheDir, `${[...w].map((c) => c.codePointAt(0).toString(16)).join("-")}.json`) : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  await sleep(GAP_MS);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + encodeURIComponent(w), { headers: { "User-Agent": "kana-words-builder" }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = (await res.json()).data ?? [];
        if (file) fs.writeFileSync(file, JSON.stringify(data));
        return data;
      }
    } catch {
      /* 네트워크 오류 → 잠시 후 재시도 */
    }
    await sleep(1000 * (attempt + 1));
  }
  throw new Error(`failed: ${w}`);
}

const shorten = (s, n) => (s.length > n ? s.slice(0, n).replace(/[;,/ ]+[^;,/]*$/, "") : s);
const KANA_TAG = "Usually written using kana alone";

function pick(w, kinds, data) {
  const hira = HIRA_ONLY.test(w);
  const wantPos = [...kinds].map((k) => SENSE_POS[k]);
  for (const d of data) {
    const jp = d.japanese ?? [];
    if (!jp.some((j) => j.reading === w || j.word === w)) continue;
    const kanaWord = jp.some((j) => (j.word === w || (!j.word && j.reading === w)));
    let senses = (d.senses ?? []).filter((s) => (s.parts_of_speech ?? []).some((p) => wantPos.some((re) => re.test(p))));
    // 히라가나 단어: 원래 가나로 쓰는 말이거나 "보통 가나로 쓴다"는 뜻만
    if (hira && !kanaWord) senses = senses.filter((s) => (s.tags ?? []).includes(KANA_TAG));
    if (senses.length === 0) continue;
    const e = shorten(senses.slice(0, 2).map((s) => (s.english_definitions ?? []).slice(0, 2).join("; ")).filter(Boolean).join(" / "), 70);
    if (!e) continue;
    const forms = jp.filter((j) => j.reading === w && j.word && HAS_KANJI.test(j.word)).map((j) => j.word);
    const out = { e };
    if (forms.length) out.k = forms[0];
    // 한국어 뜻: 표제어가 이 가나 그대로이거나, 사전의 한자 표기와 같은 단어장 항목만 쓴다(동음이의어 방지).
    const ko = (korean.get(w) ?? []).find((x) => x.head === w || forms.includes(x.head));
    if (ko) out.ko = ko.ko;
    return out;
  }
  return null;
}

const result = {};
const words = [...wanted.keys()].sort();
let done = 0;
let next = 0;
async function worker() {
  while (next < words.length) {
    const w = words[next++];
    const info = pick(w, wanted.get(w).kinds, await lookup(w));
    if (info) result[w] = info;
    if (++done % 200 === 0) console.log(`${done}/${words.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const sorted = Object.fromEntries(Object.keys(result).sort().map((k) => [k, result[k]]));
fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/kana-words.json", JSON.stringify(sorted));
console.log("kana words:", Object.keys(sorted).length, "with korean:", Object.values(sorted).filter((x) => x.ko).length, "bytes:", fs.statSync("src/data/kana-words.json").size);
