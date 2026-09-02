"use client";

import { FONT_SCALE_MAX, FONT_SCALE_MIN } from "@/hooks/useFontScale";

interface Props {
  fontScale: number;
  onAdjust: (delta: number) => void;
  onReset: () => void;
}

const btnStyle = { background: "var(--hint-bg)", color: "var(--text-muted)" } as const;

export default function FontSizeControl({ fontScale, onAdjust, onReset }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onAdjust(-0.1)}
        disabled={fontScale <= FONT_SCALE_MIN}
        aria-label="글자 작게"
        className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold disabled:opacity-40"
        style={btnStyle}
      >
        −
      </button>
      <span className="w-8 text-center text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
        {Math.round(fontScale * 100)}%
      </span>
      <button
        onClick={() => onAdjust(0.1)}
        disabled={fontScale >= FONT_SCALE_MAX}
        aria-label="글자 크게"
        className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold disabled:opacity-40"
        style={btnStyle}
      >
        +
      </button>
      <button onClick={onReset} aria-label="글자 크기 기본값" className="flex h-6 items-center justify-center rounded-full px-2 text-[11px] font-bold" style={btnStyle}>
        기본값
      </button>
    </div>
  );
}
