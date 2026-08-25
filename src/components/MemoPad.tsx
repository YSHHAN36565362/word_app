"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 220;
const MIN_SIZE = 160;
const MAX_SIZE = 560;
const HANDLE = 18;
const MIN_LINE_WIDTH = 1;
const MAX_LINE_WIDTH = 10;
const DEFAULT_LINE_WIDTH = 2.5;
const LINE_WIDTH_STEP = 1;

/** 제목 표시줄이 "잡고 끌 수 있는 손잡이"라는 걸 한눈에 보여주는 점 6개짜리 그립 아이콘. */
function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden style={{ opacity: 0.55 }}>
      {[2, 8].map((cx) =>
        [2, 8, 14].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" />)
      )}
    </svg>
  );
}

/**
 * 연습/학습 화면에 떠 있는 필기 메모장.
 *
 * - 기본은 손가락 터치로도 그려진다(펜슬이 없는 사람도 바로 쓸 수 있게). 위쪽의
 *   "펜슬 모드"를 켜면 애플펜슬(또는 마우스)만 그려지고 손가락은 무시된다 — 아이패드에서
 *   손바닥을 화면에 대고 써도 그려지지 않게 하려는 팔레트 거부(palm rejection)다.
 * - 제목 표시줄을 끌면 창 자체를 옮길 수 있고, 오른쪽 아래 모서리를 끌면 크기가
 *   바뀐다. 닫아도 캔버스 DOM을 없애지 않고 숨기기만 해서, 다시 열면(memo 버튼)
 *   그리던 내용이 그대로 남아 있다.
 * - 캔버스/제목 표시줄에 user-select와 draggable(false)을 꺼서, 빠르게 그을 때 캔버스
 *   바깥으로 살짝 벗어나거나 이미 그린 내용 위를 지나가도 브라우저 기본 텍스트
 *   선택(파란 드래그)이나 이미지 드래그 고스트가 뜨지 않게 했다.
 */
export default function MemoPad() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null); // null = 기본 위치(우하단)
  const [pencilOnly, setPencilOnly] = useState(false);
  const [lineWidth, setLineWidth] = useState(DEFAULT_LINE_WIDTH);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; top: number; left: number } | null>(null);

  // 캔버스 크기가 바뀔 때, 기존에 그린 내용을 새 크기에 맞게 옮겨 그린 뒤 해상도를
  // 화면 배율(devicePixelRatio)에 맞춰 다시 잡는다 — 안 그러면 리사이즈할 때마다
  // 그림이 사라지거나 흐려진다.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const prev = document.createElement("canvas");
    prev.width = canvas.width;
    prev.height = canvas.height;
    prev.getContext("2d")?.drawImage(canvas, 0, 0);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1c24";
    ctx.lineWidth = lineWidth;
    if (prev.width > 0) ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, size.width, size.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function shouldIgnore(pointerType: string) {
    return pencilOnly && pointerType === "touch";
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (shouldIgnore(e.pointerType)) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.lineWidth = lineWidth; // 굵기를 바꾼 뒤에도(리사이즈 없이) 다음 획부터 바로 반영
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function adjustLineWidth(delta: number) {
    setLineWidth((w) => Math.min(MAX_LINE_WIDTH, Math.max(MIN_LINE_WIDTH, w + delta)));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || shouldIgnore(e.pointerType)) return;
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const point = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    resizeStartRef.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = resizeStartRef.current;
    if (!start) return;
    setSize({
      width: Math.min(MAX_SIZE, Math.max(MIN_SIZE, start.width + (e.clientX - start.x))),
      height: Math.min(MAX_SIZE, Math.max(MIN_SIZE, start.height + (e.clientY - start.y))),
    });
  }

  function handleResizeEnd() {
    resizeStartRef.current = null;
  }

  // 제목 표시줄을 눌러서 끌면 창을 옮긴다. 헤더 안의 버튼(펜슬 모드/지우기/닫기)을
  // 누를 때는 각 버튼에서 stopPropagation 해서 여기로 안 올라오게 막는다.
  function handleDragStart(e: React.PointerEvent<HTMLDivElement>) {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, top: rect.top, left: rect.left };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!start || !rect) return;
    const maxTop = window.innerHeight - rect.height;
    const maxLeft = window.innerWidth - rect.width;
    setPos({
      top: Math.min(Math.max(0, start.top + (e.clientY - start.y)), Math.max(0, maxTop)),
      left: Math.min(Math.max(0, start.left + (e.clientX - start.x)), Math.max(0, maxLeft)),
    });
  }

  function handleDragEnd() {
    dragStartRef.current = null;
  }

  const noSelect: React.CSSProperties = {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="btn-3d btn-accent px-4 py-2 text-sm"
          style={{ position: "fixed", bottom: "6.5rem", right: "1rem", zIndex: 50 }}
        >
          memo
        </button>
      )}

      <div
        ref={panelRef}
        className="flex flex-col overflow-hidden rounded-2xl border"
        style={{
          position: "fixed",
          zIndex: 50,
          width: size.width,
          ...(pos ? { top: pos.top, left: pos.left } : { bottom: "6.5rem", right: "1rem" }),
          borderColor: "var(--card-border)",
          background: "var(--card)",
          boxShadow: "0 8px 24px rgba(var(--shadow-color) / 0.25)",
          display: open ? "flex" : "none",
          ...noSelect,
        }}
      >
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerLeave={handleDragEnd}
          className="flex items-center justify-between gap-2 px-3 py-2"
          style={{
            borderBottom: "1px solid var(--card-border)",
            background: "var(--hint-bg)",
            cursor: "move",
            touchAction: "none",
            ...noSelect,
          }}
        >
          <span className="flex items-center gap-1.5">
            <GripIcon />
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>
              memo
            </span>
          </span>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen(false)} className="btn-3d btn-ghost px-2.5 py-1 text-[11px]">
            닫기
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <button
            onClick={() => setPencilOnly((v) => !v)}
            className={`btn-3d px-2.5 py-1 text-[11px] ${pencilOnly ? "btn-blue" : "btn-ghost"}`}
          >
            펜슬 모드
          </button>
          <button onClick={clearCanvas} className="btn-3d btn-ghost px-2.5 py-1 text-[11px]">
            지우기
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => adjustLineWidth(-LINE_WIDTH_STEP)}
              disabled={lineWidth <= MIN_LINE_WIDTH}
              className="btn-3d btn-ghost h-6 w-6 p-0 text-xs leading-none"
            >
              -
            </button>
            <span
              className="flex h-6 w-6 items-center justify-center"
              aria-label={`펜 굵기 ${lineWidth}`}
            >
              <span
                className="rounded-full"
                style={{
                  width: Math.round(4 + lineWidth * 1.4),
                  height: Math.round(4 + lineWidth * 1.4),
                  background: "var(--text)",
                }}
              />
            </span>
            <button
              onClick={() => adjustLineWidth(LINE_WIDTH_STEP)}
              disabled={lineWidth >= MAX_LINE_WIDTH}
              className="btn-3d btn-ghost h-6 w-6 p-0 text-xs leading-none"
            >
              +
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
          style={{ touchAction: "none", background: "#ffffff", cursor: "crosshair", ...noSelect }}
        />
        <div
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerLeave={handleResizeEnd}
          className="self-end"
          style={{
            width: HANDLE,
            height: HANDLE,
            touchAction: "none",
            cursor: "nwse-resize",
            background:
              "linear-gradient(135deg, transparent 0%, transparent 45%, var(--text-muted) 45%, var(--text-muted) 55%, transparent 55%, transparent 70%, var(--text-muted) 70%, var(--text-muted) 80%, transparent 80%)",
          }}
          aria-label="메모장 크기 조절"
        />
      </div>
    </>
  );
}
