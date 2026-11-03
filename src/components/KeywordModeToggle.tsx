"use client";

import { useKeywordOnly } from "@/hooks/useKeywordOnly";

/** 면접 카드의 "키워드만 보기" 켬/끔 버튼. 켜면 답변 문장은 가리고 키워드→동사 묶음만 보여준다. */
export default function KeywordModeToggle() {
  const [on, setOn] = useKeywordOnly();
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className="rounded-full px-3 py-1 text-[11px] font-bold"
      style={{
        background: on ? "var(--accent)" : "var(--hint-bg)",
        color: on ? "#fff" : "var(--text-muted)",
      }}
      aria-pressed={on}
    >
      키워드만 보기 {on ? "켬" : "끔"}
    </button>
  );
}
