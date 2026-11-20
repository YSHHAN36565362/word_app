// 단어 카드 txt(프롬프트_일본어_단어.txt B유형 형식)를 검사한다.
// 사용: node scripts/validate-word-cards.mjs <카드.txt> [표제어목록.json]  (목록을 생략하면 덱 대조는 건너뜀: 문법 카드용)
// 표제어목록: [{"w":"図る","r":"はかる"}] 꼴. 태그 종류·빈 줄·금지 기호·[예문] 간격줄·예문 독음(형태소 분석 대조)을 본다.
import fs from "node:fs";
import path from "node:path";
import kuromoji from "kuromoji";
const [file, headsFile] = process.argv.slice(2);
const heads = headsFile ? JSON.parse(fs.readFileSync(headsFile, "utf8")) : null;
const deck = new Map((heads ?? []).map((h) => [h.w, h.r]));
const text = fs.readFileSync(file, "utf8");
const cards = text.trimEnd().split(/\n\n+/).filter((c) => c.trim()).map((c) => c.split("\n"));
const TAGS = /^\[(읽기|악센트|한자\d+|종합|치트키|장면|예문|활용|헷갈리는 단어)\]/;
const ZW = "​";
const err = [];
const tk = await new Promise((res, rej) => kuromoji.builder({ dicPath: path.join(process.cwd(), "node_modules/kuromoji/dict") }).build((e, t) => (e ? rej(e) : res(t))));
const kata2hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const strip = (s) => s.replace(/[。、「」\s]/g, "");
for (const c of cards) {
  const w = c[0];
  const tag = (m) => err.push(`${w}: ${m}`);
  if (heads && !deck.has(w)) tag("덱 표제어에 없음");
  const m = /^.+\(([ぁ-ゖァ-ヶー～〜]+)\)$/.exec(c[1] ?? "");
  if (!m) tag("2번째 줄 형식 오류");
  else if (deck.get(w) && m[1] !== deck.get(w)) tag(`독음 불일치 덱=${deck.get(w)} 카드=${m[1]}`);
  for (const [i, l] of c.entries()) {
    if (i < 2) continue;
    if (l === ZW) continue;
    if (/^\[/.test(l) && !TAGS.test(l)) tag("허용되지 않은 태그: " + l.slice(0, 20));
    if (/[<>]|\*\*|＋/.test(l)) tag("금지 기호: " + l.slice(0, 30));
    if (l.trim() === "") tag("빈 줄");
  }
  const ex = c.findIndex((l) => l.startsWith("[예문]"));
  if (ex < 0) tag("[예문] 없음");
  else if (c[ex + 1] !== ZW || c[ex + 2] !== ZW || c[ex + 4] !== ZW || c[ex + 5] !== ZW) tag("[예문] 간격줄 구조 오류");
  else {
    const jp = c[ex + 3], hira = c[ex + 6];
    const kr = tk.tokenize(jp).map((t) => t.reading ?? t.surface_form).join("");
    if (strip(kata2hira(kr)) !== strip(hira) && strip(kata2hira(jp)) !== strip(hira)) tag(`예문 독음 불일치(형태소 분석 기준)\n   분석=${strip(kata2hira(kr))}\n   카드=${strip(hira)}`);
  }
  if (!c.some((l) => l.startsWith("[종합]"))) tag("[종합] 없음");
  if (!c.some((l) => l.startsWith("[치트키]"))) tag("[치트키] 없음");
  if (!c.some((l) => l.startsWith("[장면]"))) tag("[장면] 없음");
}
console.log("cards:", cards.length, "errors:", err.length);
console.log(err.join("\n"));
