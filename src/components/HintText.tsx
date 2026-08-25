"use client";

/**
 * 힌트 본문 안에서 "[읽기]"/"[한자1]"/"[종합]"처럼 대괄호로만 이루어진 줄(구간
 * 제목)만 찾아서 본문과 다르게 강조한다. 배경색을 칠하지 않고 글자색·굵기만
 * 바꿔서, 다크/라이트 모드 어느 쪽에서도 눈에 거슬리지 않을 정도로만 튀게 했다.
 */
const BRACKET_LINE = /^\s*\[[^[\]]+\]\s*$/;

export default function HintText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i} style={BRACKET_LINE.test(line) ? { color: "var(--blue)", fontWeight: 800 } : undefined}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}
