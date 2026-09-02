"use client";

import { useEffect, useState } from "react";

export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.8;

/**
 * 데스크탑/노트북에서는 브라우저 확대 없이 한자·설명 글씨가 작게 느껴진다는 피드백에
 * 따라 만든 카드 글자 크기 조절. "그 세션 동안"만 유지하면 되므로 sessionStorage에
 * 저장한다(탭을 닫으면 초기화, 같은 탭 안에서 새로고침/다른 파트로 갔다와도 유지).
 *
 * cssVar로 지정한 CSS 커스텀 프로퍼티를 :root에 반영해두면, 각 파트는 자기 텍스트
 * 스타일에서 `calc(1.5rem * var(--xxx-font-scale, 1))` 식으로 이 값을 참조할 수 있다.
 *
 * 저장은 항상 "값이 바뀌는 자리"(핸들러 안)에서 하고, 마운트 복원 effect는 상태만
 * 읽어올 뿐 storage에 다시 쓰지 않는다 — 반대로 하면 React StrictMode가 개발 모드에서
 * 마운트 effect를 두 번 실행할 때, 복원되기 전(기본값)의 값을 저장 effect가 먼저
 * storage에 덮어써 버려 복원 자체가 무효화되는 문제가 실제로 있었다.
 */
export function useFontScale(storageKey: string, cssVar: string) {
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = Number(window.sessionStorage.getItem(storageKey));
    if (stored >= FONT_SCALE_MIN && stored <= FONT_SCALE_MAX) {
      setFontScaleState(stored);
      document.documentElement.style.setProperty(cssVar, String(stored));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFontScale(next: number) {
    setFontScaleState(next);
    window.sessionStorage.setItem(storageKey, String(next));
    document.documentElement.style.setProperty(cssVar, String(next));
  }

  function adjustFontScale(delta: number) {
    setFontScale(Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, fontScale + delta)) * 10) / 10);
  }

  return { fontScale, setFontScale, adjustFontScale };
}
