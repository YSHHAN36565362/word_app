// 팝업의 한국어 뜻 데이터(src/data/ko-words.json, src/data/ko-kanji.json)를 만든다.
// 사용: node scripts/build-ko.mjs
// 재료:
//  1) word_list 단어장의 "단어 / 뜻(읽기)" 항목 — 직접 공부하는 뜻이라 가장 우선한다.
//  2) scripts/ko/words-*.tsv — 단어장에 없는 예시 단어·가나 단어의 번역 ("단어<TAB>한국어 뜻")
//  3) scripts/ko/kanji-*.tsv — 한자의 한국어 뜻(훈) ("한자<TAB>뜻")
// 결과: ko-words.json { "暴力": "폭력" }, ko-kanji.json { "潔": "깨끗하다" }
import fs from "node:fs";
import path from "node:path";

const words = {};
const kanji = {};

function readTsv(file, into) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const [key, ko] = line.split("\t");
    if (key && ko && ko.trim()) into[key.trim()] = ko.trim();
  }
}
const koDir = path.join("scripts", "ko");
for (const f of fs.readdirSync(koDir).sort()) {
  if (/^words-.*\.tsv$/.test(f)) readTsv(path.join(koDir, f), words);
  else if (/^kanji-.*\.tsv$/.test(f)) readTsv(path.join(koDir, f), kanji);
}

// 단어장: "뜻(읽기)" 줄의 바로 윗줄이 표제어. 먼저 나온 뜻을 쓴다.
const fromLists = {};
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".txt")) {
      const lines = fs.readFileSync(full, "utf8").split("\n");
      for (let i = 1; i < lines.length; i++) {
        const m = /^([^()（）]{1,40})[(（]([ぁ-ゖー]+)[)）]$/.exec(lines[i].trim());
        if (!m || !/[가-힣]/.test(m[1])) continue;
        const head = lines[i - 1].trim();
        if (head && head.length <= 12 && !/[가-힣]/.test(head) && !(head in fromLists)) fromLists[head] = m[1].trim();
      }
    }
  }
}
walk("word_list");
Object.assign(words, fromLists);

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
fs.writeFileSync("src/data/ko-words.json", JSON.stringify(sortKeys(words)));
fs.writeFileSync("src/data/ko-kanji.json", JSON.stringify(sortKeys(kanji)));
console.log("ko words:", Object.keys(words).length, "(from word lists:", Object.keys(fromLists).length + ")", "ko kanji:", Object.keys(kanji).length);
