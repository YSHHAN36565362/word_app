"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface FocusScreenProps {
  /** 진행률/카운터/마스코트 등, 화면 위쪽에 오는 고정 내용 */
  top?: ReactNode;
  /** 카드/힌트/종료 버튼 등 스크롤되는 본문. 길어져도 하단 액션바를 밀어내지 않는다. */
  children: ReactNode;
  /** 정답확인/채점/이전·다음 등 주요 액션 버튼. 있을 때만 화면 하단에 고정된다. */
  actions?: ReactNode;
}

const WIDTH_KEY = "focusBoxWidth";
const MIN_WIDTH = 320;

/**
 * 학습/연습/시험/지문 화면 공통 레이아웃.
 * 액션 버튼을 뷰포트 하단에 고정(position:fixed)해서, 힌트 텍스트 길이에 따라
 * 버튼 위치가 오르내리지 않게 한다. 본문에는 액션바 높이만큼 하단 패딩을 줘서
 * 마지막 내용이 버튼에 가리지 않게 한다. 종료 버튼은 액션바가 아니라 children
 * 맨 끝에 두어(원래 위치), 진행 중이든 완료했든 항상 스크롤해서 닿을 수 있게 한다.
 *
 * 컴퓨터(마우스) 화면에서는 박스 오른쪽 가장자리를 드래그해 너비를 조절할 수 있다
 * (더블클릭하면 기본 너비로 돌아간다). 정한 너비는 이 브라우저에 저장된다.
 * 힌트 상자의 높이는 힌트 상자 오른쪽 아래 모서리를 드래그해서 조절한다(globals.css).
 */
export default function FocusScreen({ top, children, actions }: FocusScreenProps) {
  const [width, setWidth] = useState<number | null>(null);
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved >= MIN_WIDTH) setWidth(saved);
  }, []);

  function clamp(w: number) {
    return Math.max(MIN_WIDTH, Math.min(w, window.innerWidth - 16, 1800));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const startW = boxRef.current?.getBoundingClientRect().width ?? 576;
    drag.current = { startX: e.clientX, startW };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // 가운데 정렬이라 한쪽을 dx만큼 끌면 전체 너비는 2*dx 변한다.
    setWidth(clamp(drag.current.startW + 2 * (e.clientX - drag.current.startX)));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (width) window.localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
  }
  function resetWidth() {
    setWidth(null);
    window.localStorage.removeItem(WIDTH_KEY);
  }

  const boxStyle = width ? { maxWidth: width } : undefined;
  const boxClass = width ? "" : "max-w-xl";

  return (
    <div ref={boxRef} className={`relative mx-auto px-4 pt-4 ${boxClass}`} style={boxStyle}>
      <div
        className="focus-resize-handle"
        title="좌우로 끌어 박스 너비 조절 (더블클릭: 기본값)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={resetWidth}
      />
      {top}
      <div className={actions ? "pb-36" : ""}>{children}</div>
      {actions && (
        <div
          className="fixed inset-x-0 bottom-0 z-40"
          style={{ background: "var(--bg)", borderTop: "1px solid var(--card-border)" }}
        >
          <div className={`mx-auto px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] ${boxClass}`} style={boxStyle}>
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}
