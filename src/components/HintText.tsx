"use client";

import { useState } from "react";
import { HintSectionKey, HintTheme, sectionOfLine } from "@/lib/hintTheme";
import { useHintTheme } from "@/hooks/useHintTheme";

/**
 * 힌트 본문을 구간(읽기/한자/종합/치트키/장면/예문/활용/헷갈리는 단어)별로 나눠서,
 * 설정에서 정한 색·크기로 그리고 숨긴 구간은 아예 렌더하지 않는다.
 *
 * 예전 버전은 "대괄호만 있는 줄"만 강조하도록 되어 있었는데, 실제 단어장은
 * `[읽기] 従=したが + う → …`처럼 태그와 내용이 같은 줄에 있어서 사실상 아무 줄도
 * 강조되지 않고 전부 같은 회색으로 나왔다. 이제 태그가 줄 앞에 있으면 인식한다.
 */
const TAG_HEAD = /^(\s*\[[^\]]+\])(.*)$/;
const KANJI_HEADER_TAG = /^\s*\[한자\d+\]/;

/**
 * 예문 구간의 태그 없는 줄(= 일본어 문장·히라가나 독음)은 흐리게 가려 두고,
 * 마우스를 올리거나(PC) 탭하면(모바일) 보이게 해서 한국어 → 일본어 해석·읽기 연습에 쓴다.
 */
function BlurLine({ text }: { text: string }) {
  const [peek, setPeek] = useState(false);
  const [pinned, setPinned] = useState(false);
  const shown = peek || pinned;
  return (
    <span
      onMouseEnter={() => setPeek(true)}
      onMouseLeave={() => setPeek(false)}
      onClick={() => setPinned((v) => !v)}
      style={{
        display: "inline-block",
        cursor: "pointer",
        filter: shown ? "none" : "blur(7px)",
        transition: "filter 0.15s",
        userSelect: shown ? "auto" : "none",
      }}
    >
      {text}
    </span>
  );
}

export default function HintText({ text, theme: themeProp }: { text: string; theme?: HintTheme }) {
  // 보통은 이 안에서 직접 저장값을 읽어오지만, 같은 화면에 힌트 크기를 즉시 조절하는
  // 컨트롤(연습 화면 ⚙ 설정의 "한자 크기" 등)이 같이 떠 있을 때는 그 컨트롤이 들고 있는
  // 살아있는 state를 그대로 넘겨받아써야, 조절하자마자(리마운트 없이) 바로 반영된다.
  const ownHook = useHintTheme();
  const theme = themeProp ?? ownHook.theme;
  const lines = text.split("\n");

  let section: HintSectionKey = "etc";
  const rendered: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    section = sectionOfLine(line, section);
    const style = theme[section];
    if (!style.visible) return; // 숨긴 구간은 통째로 건너뛴다(이어지는 하위 줄 포함).

    const m = line.match(TAG_HEAD);
    // 한자1/한자2… 제목 줄은 요청에 따라 kanji 구간 본문과 다른 색으로 강조할 수 있다
    // (kanjiHeader.visible은 "숨김"이 아니라 "이 강조를 쓸지"를 뜻함 — hintTheme.ts 참고).
    const isKanjiHeader = KANJI_HEADER_TAG.test(line);
    const headerStyle = isKanjiHeader && theme.kanjiHeader.visible ? theme.kanjiHeader : style;
    const common = {
      color: headerStyle.color || undefined,
      fontSize: headerStyle.scale !== 1 ? `${headerStyle.scale}em` : undefined,
    };

    rendered.push(
      <span key={i} style={common}>
        {m ? (
          <>
            <b style={{ fontWeight: 800 }}>{m[1]}</b>
            {m[2]}
          </>
        ) : section === "example" && line.replace(/\u200b/g, "").trim() !== "" ? (
          <BlurLine text={line} />
        ) : (
          line
        )}
        <br />
      </span>
    );
  });

  return <>{rendered}</>;
}
