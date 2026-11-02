// 한자 툴팁용 데이터(src/data/kanji.json)를 만든다.
// 사용: node scripts/build-kanji-data.mjs <Unihan 폴더(Unihan.zip을 푼 곳)>
// 출처: Unicode Unihan 데이터베이스 (https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip)
//  - h: 한국 한자음(kHangul), j: 일본 음독·훈독(kJapanese), e: 영어 뜻(kDefinition)
// 대상: 상용한자(kJoyoKanji) + word_list 안의 모든 단어장에 실제로 나오는 한자.
import fs from "node:fs";
import path from "node:path";

const unihan = process.argv[2];
if (!unihan) {
  console.error("사용: node scripts/build-kanji-data.mjs <Unihan 폴더>");
  process.exit(1);
}

const KANJI = /[一-鿿]/g;
const wanted = new Set();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".txt")) for (const c of fs.readFileSync(full, "utf8").match(KANJI) ?? []) wanted.add(c);
  }
}
walk(path.join(process.cwd(), "word_list"));

const data = {};
const ensure = (c) => (data[c] ??= { h: "", j: "", e: "" });
const cp = (u) => String.fromCodePoint(parseInt(u.slice(2), 16));

for (const file of ["Unihan_Readings.txt", "Unihan_OtherMappings.txt"]) {
  for (const line of fs.readFileSync(path.join(unihan, file), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [u, field, ...rest] = line.split("\t");
    const value = rest.join("\t");
    const c = cp(u);
    if (field === "kJoyoKanji") wanted.add(c);
    if (!wanted.has(c) && field !== "kJoyoKanji") continue;
    if (field === "kHangul") {
      // "점:0E 뎀:0N" → 앞쪽 음 최대 2개
      ensure(c).h = value.split(" ").map((v) => v.split(":")[0]).slice(0, 2).join("/");
    } else if (field === "kJapanese") {
      ensure(c).j = value;
    } else if (field === "kDefinition") {
      ensure(c).e = value.length > 48 ? value.slice(0, 48).replace(/[;, ]+[^;,]*$/, "") : value;
    }
  }
}

// 상용한자 등을 pass 중에 추가한 뒤 wanted에 없는 건 제거
for (const c of Object.keys(data)) if (!wanted.has(c)) delete data[c];
for (const c of Object.keys(data)) if (!data[c].h && !data[c].j && !data[c].e) delete data[c];

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/kanji.json", JSON.stringify(data));
console.log("kanji:", Object.keys(data).length, "bytes:", fs.statSync("src/data/kanji.json").size);
