"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_HINT_THEME,
  HintSectionKey,
  HintSectionStyle,
  HintTheme,
  HINT_SCALE_MAX,
  HINT_SCALE_MIN,
  loadHintTheme,
  saveHintTheme,
} from "@/lib/hintTheme";

/**
 * 힌트 구간별 표시 설정. 기기별 취향값이라 localStorage에만 저장한다.
 * SSR/hydration이 어긋나지 않도록 기본 테마로 먼저 그린 뒤 마운트 후 저장값을 얹는다.
 */
export function useHintTheme() {
  const [theme, setTheme] = useState<HintTheme>(DEFAULT_HINT_THEME);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTheme(loadHintTheme());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function update(key: HintSectionKey, patch: Partial<HintSectionStyle>) {
    setTheme((prev) => {
      const next: HintTheme = { ...prev, [key]: { ...prev[key], ...patch } };
      if (typeof next[key].scale === "number") {
        // *20(=0.05 단위)으로 반올림한다 — *10(0.1 단위)으로 하면 kanjiHeader의 기본값
        // (1.05)처럼 0.1의 배수가 아닌 값이 저장될 때마다 가장 가까운 0.1로 밀려버려서
        // (예: "한자 크기" 기본값 복원이 1.05 대신 1.1로 저장되는 버그가 실제로 있었다),
        // 0.1 단위 +/- 버튼이 만드는 값들(1.0, 1.1, 1.2…)도 전부 0.05의 배수라 이렇게
        // 바꿔도 기존 동작은 그대로 유지된다.
        next[key].scale = Math.round(Math.min(HINT_SCALE_MAX, Math.max(HINT_SCALE_MIN, next[key].scale)) * 20) / 20;
      }
      saveHintTheme(next);
      return next;
    });
  }

  function reset() {
    setTheme(DEFAULT_HINT_THEME);
    saveHintTheme(DEFAULT_HINT_THEME);
  }

  return { theme, update, reset };
}
