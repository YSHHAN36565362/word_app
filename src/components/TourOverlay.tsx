"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS, useTour } from "@/contexts/TourContext";

/**
 * "사이트 체험하기" 진행 중일 때만 렌더되는 오버레이. 현재 스텝의 target(data-tour
 * 속성)을 가진 실제 요소를 찾아 빨간 테두리 박스로 감싸고, 화면 아래에는 언제든
 * 체험을 끝낼 수 있는 빨간 버튼을 띄운다. 하이라이트 박스는 pointer-events:none이라
 * 실제 버튼/탭 클릭을 가로채지 않는다 — 사용자가 그 버튼을 "진짜로" 눌러야 다음
 * 스텝으로 넘어간다(경로가 바뀌는 걸 감지해서 자동 진행).
 */
export default function TourOverlay() {
  const { active, stepIndex, stop, advanceIfAt } = useTour();
  const pathname = usePathname();
  const router = useRouter();
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active) return;
    advanceIfAt(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pathname]);

  const step = TOUR_STEPS[stepIndex];
  const onStepPage = active && !!step && step.path === pathname;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!onStepPage || !step.target) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    /* eslint-enable react-hooks/set-state-in-effect */
    const id = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [onStepPage, step?.target]);

  if (!active) return null;

  function exitTour() {
    stop();
    router.push("/");
  }

  const isFinalStep = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {onStepPage && rect && (
        <div
          className="pointer-events-none fixed z-[60] rounded-xl"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            border: "3px solid var(--red)",
            boxShadow: "0 0 0 4000px rgba(0,0,0,0.4)",
          }}
        />
      )}
      {onStepPage && !isFinalStep && (
        // 하이라이트 대상 바로 위(rect 기준)에 붙이면 하단 탭처럼 화면 아래쪽 요소일 때
        // "테스트 종료하기" 바와 겹친다. 그래서 항상 화면 위쪽 고정 위치에 띄운다.
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[61] flex justify-center px-4">
          <div
            className="rounded-xl px-4 py-2.5 text-center text-sm font-bold text-white shadow-lg"
            style={{ background: "var(--red)", maxWidth: "20rem" }}
          >
            {step.message}
          </div>
        </div>
      )}
      {isFinalStep && onStepPage && (
        <div className="fixed inset-x-0 top-1/2 z-[61] flex -translate-y-1/2 justify-center px-6">
          <div className="study-card w-full max-w-xs p-5 text-center">
            <div className="text-base font-bold" style={{ color: "var(--accent)" }}>
              {step.message}
            </div>
            <button onClick={exitTour} className="btn-3d btn-accent mt-4 w-full text-sm">
              처음 화면으로
            </button>
          </div>
        </div>
      )}
      <button
        onClick={exitTour}
        className="fixed inset-x-4 z-[62] rounded-full py-3 text-sm font-extrabold text-white shadow-lg"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)", background: "var(--red)" }}
      >
        테스트 종료하기
      </button>
    </>
  );
}
