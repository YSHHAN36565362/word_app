"use client";

import { useState } from "react";
import { SCORE_BTN_SCALE_MAX, SCORE_BTN_SCALE_MIN } from "@/hooks/useScoreButtonPrefs";

interface Props {
  scale: number;
  onAdjust: (delta: number) => void;
  onReset: () => void;
  hidden: boolean;
  onSetHidden: (next: boolean) => void;
}

const chipStyle = { background: "var(--hint-bg)", color: "var(--text-muted)" } as const;

/**
 * 채점 버튼(완벽함/조금 앎/헷갈림/모름) 크기 조절 + 숨김 스위치. 대형 TV에 데스크탑을
 * 연결해서 쓸 때 버튼이 너무 크게 느껴진다는 요청으로, 평소엔 작은 톱니바퀴 버튼 하나만
 * 보이다가 눌러야 −/%/+/기본값/숨기기/나타내기가 펼쳐지는 팝오버 형태로 만들었다(항상
 * 펼쳐놓으면 그 자체로 공간을 차지해 "버튼이 크다"는 원래 문제를 오히려 키운다).
 */
export default function ScoreButtonSizeControl({ scale, onAdjust, onReset, hidden, onSetHidden }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="채점 버튼 크기 설정"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
        style={chipStyle}
      >
        ⚙
      </button>

      {open && (
        <div
          className="absolute right-0 bottom-full z-10 mb-1 w-max rounded-2xl p-1.5 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          {/* 크기 조절 줄. flex-shrink-0 + whitespace-nowrap을 각 버튼에 줘서, 팝오버가
              화면 오른쪽 끝에 붙어도 글자가 세로로 쪼개지며 찌그러지지 않게 한다. */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAdjust(-0.1)}
              disabled={scale <= SCORE_BTN_SCALE_MIN}
              aria-label="채점 버튼 작게"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold disabled:opacity-40"
              style={chipStyle}
            >
              −
            </button>
            <span className="w-8 shrink-0 text-center text-[10px] font-bold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => onAdjust(0.1)}
              disabled={scale >= SCORE_BTN_SCALE_MAX}
              aria-label="채점 버튼 크게"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold disabled:opacity-40"
              style={chipStyle}
            >
              +
            </button>
            <button
              onClick={onReset}
              aria-label="채점 버튼 크기 기본값"
              className="flex h-5 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold whitespace-nowrap"
              style={chipStyle}
            >
              기본값
            </button>
          </div>
          {/* 숨기기/나타내기 줄 */}
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => onSetHidden(true)}
              disabled={hidden}
              aria-label="채점 버튼 숨기기"
              className="flex h-5 flex-1 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold whitespace-nowrap disabled:opacity-40"
              style={chipStyle}
            >
              숨기기
            </button>
            <button
              onClick={() => onSetHidden(false)}
              disabled={!hidden}
              aria-label="채점 버튼 나타내기"
              className="flex h-5 flex-1 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold whitespace-nowrap disabled:opacity-40"
              style={chipStyle}
            >
              나타내기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
