"use client";

import { ReactNode, useRef, useState } from "react";

const REVEAL = 72; // 빨간 X 버튼이 드러나는 너비(px)
const THRESHOLD = 40; // 이만큼 이상 밀면 열린 상태로 고정된다

/**
 * 목록 한 줄을 밀어서 빨간 ✕ 삭제 버튼을 드러내는 줄.
 * - 휴대폰(터치): 왼쪽으로 스와이프하면 오른쪽에 빨간 ✕가 나온다.
 * - 컴퓨터(마우스): 오른쪽으로 밀면 왼쪽에 빨간 ✕가 나온다.
 * ✕를 누르면 onDelete가 실행되고, 열린 줄을 다시 누르거나 반대로 밀면 닫힌다.
 * 밀고 있었다면 클릭(뜻 보기 토글 등)은 일어나지 않는다.
 */
export default function SwipeRow({
  children,
  onDelete,
  onTap,
}: {
  children: ReactNode;
  onDelete: () => void;
  onTap: () => void;
}) {
  const [offset, setOffset] = useState(0); // 음수=왼쪽으로 밀림(터치), 양수=오른쪽으로 밀림(마우스)
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; base: number; type: string } | null>(null);
  const moved = useRef(false);

  function clamp(v: number, type: string) {
    return type === "touch" ? Math.max(-REVEAL, Math.min(0, v)) : Math.max(0, Math.min(REVEAL, v));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    start.current = { x: e.clientX, base: offset, type: e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse" };
    moved.current = false;
    setDragging(true);
    if (e.pointerType === "mouse") e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 6) moved.current = true;
    if (!moved.current) return;
    // 열려 있던 쪽 기준으로 이어서 움직인다(이미 열린 걸 반대로 밀면 닫힘).
    setOffset(clamp(s.base + dx, s.type));
  }

  function finish() {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s) return;
    setOffset((o) => (Math.abs(o) >= THRESHOLD ? (s.type === "touch" ? -REVEAL : REVEAL) : 0));
  }

  function onClick() {
    if (moved.current) {
      moved.current = false;
      return; // 밀던 중이었으면 클릭으로 치지 않는다
    }
    if (offset !== 0) {
      setOffset(0); // 열려 있으면 닫기만 한다
      return;
    }
    onTap();
  }

  const deleteBtn = (side: "left" | "right") => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      aria-label="목록에서 지우기"
      className="absolute inset-y-0 flex items-center justify-center text-2xl font-extrabold text-white"
      style={{ [side]: 0, width: REVEAL, background: "var(--red)", visibility: (side === "right" ? offset < 0 : offset > 0) ? "visible" : "hidden" }}
    >
      ✕
    </button>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {deleteBtn("left")}
      {deleteBtn("right")}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClick={onClick}
        className="study-card relative cursor-pointer select-none p-4 text-left"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.18s ease",
          touchAction: "pan-y",
        }}
        role="button"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
