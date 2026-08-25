"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 220;
const MIN_SIZE = 160;
const MAX_SIZE = 560;

/**
 * 연습/학습 화면에 떠 있는 필기 메모장. 애플펜슬(또는 마우스)로만 그려지고 손가락
 * 터치는 무시한다 — 아이패드에서 손바닥을 화면에 대고 써도 그려지지 않게 하려는
 * 팔레트 거부(palm rejection) 처리다. 도구는 "지우기"(전체 지우기) 하나만 두고,
 * 굵기/색상 선택 등은 일부러 넣지 않았다. 닫아도 캔버스 DOM을 없애지 않고 숨기기만
 * 해서, 다시 열면(memo 버튼) 그리던 내용이 그대로 남아 있다.
 */
export default function MemoPad() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

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
    ctx.lineWidth = 2.2;
    if (prev.width > 0) ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, size.width, size.height);
  }, [size]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") return; // 손가락은 무시(팔레트 거부)
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || e.pointerType === "touch") return;
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
        className="flex flex-col overflow-hidden rounded-2xl border"
        style={{
          position: "fixed",
          zIndex: 50,
          bottom: "6.5rem",
          right: "1rem",
          borderColor: "var(--card-border)",
          background: "var(--card)",
          boxShadow: "0 8px 24px rgba(var(--shadow-color) / 0.25)",
          display: open ? "flex" : "none",
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-2"
          style={{ borderBottom: "1px solid var(--card-border)" }}
        >
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>
            memo
          </span>
          <div className="flex items-center gap-2">
            <button onClick={clearCanvas} className="btn-3d btn-ghost px-2.5 py-1 text-[11px]">
              지우기
            </button>
            <button onClick={() => setOpen(false)} className="btn-3d btn-ghost px-2.5 py-1 text-[11px]">
              닫기
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none", background: "#ffffff", cursor: "crosshair" }}
        />
        <div
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerLeave={handleResizeEnd}
          className="self-end"
          style={{
            width: 18,
            height: 18,
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
