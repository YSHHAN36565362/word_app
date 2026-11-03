"use client";

import { useState } from "react";
import Furigana from "@/components/Furigana";
import { formatInterviewFront, parseFrontKeywords, splitInlineKeywords } from "@/lib/queue";
import { useKeywordOnly } from "@/hooks/useKeywordOnly";

const COLORS = 8;

/**
 * 면접 카드 앞면. 맨 위에 "키워드→동사" 묶음을 색깔 칩으로 보여주고, 답변 속 같은 번호의
 * 문구를 같은 색으로 칠한다. "키워드만 보기"가 켜져 있으면 답변 문장은 가리고 질문과 칩만 보인다
 * (칩을 보고 문장을 떠올려 말해 보는 연습) — [답변 보기]로 카드마다 펼칠 수 있다.
 */
export default function RichFront({ text, furigana = true }: { text: string; furigana?: boolean }) {
  const [keywordOnly] = useKeywordOnly();
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const { keywords, body } = parseFrontKeywords(text);
  const formatted = formatInterviewFront(body);

  const cut = formatted.indexOf("【답변】");
  const question = cut >= 0 ? formatted.slice(0, cut) : formatted;
  const answer = cut >= 0 ? formatted.slice(cut) : "";
  const hideAnswer = keywordOnly && keywords.length > 0 && answer !== "" && revealedFor !== text;

  function render(part: string) {
    return splitInlineKeywords(part).map((seg, i) =>
      seg.n ? (
        <span key={i} className={`kw kw-${(seg.n - 1) % COLORS}`}>
          {seg.s}
        </span>
      ) : (
        <Furigana key={i} text={seg.s} enabled={furigana} />
      )
    );
  }

  return (
    <div style={{ whiteSpace: "pre-line" }}>
      {keywords.length > 0 && (
        <div className="kw-bar">
          {keywords.map((k, i) => (
            <span key={i} className={`kw-chip kw-${i % COLORS}`}>
              <b>{k.kw}</b>
              {k.verb && <span className="kw-verb">{k.verb}</span>}
            </span>
          ))}
        </div>
      )}
      <div>{render(question)}</div>
      {answer !== "" &&
        (hideAnswer ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRevealedFor(text);
              }}
              className="btn-3d btn-ghost px-3 py-1.5 text-xs"
            >
              답변 보기
            </button>
          </div>
        ) : (
          <div>{render(answer)}</div>
        ))}
    </div>
  );
}
