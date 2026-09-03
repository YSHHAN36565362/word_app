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
        next[key].scale = Math.round(Math.min(HINT_SCALE_MAX, Math.max(HINT_SCALE_MIN, next[key].scale)) * 10) / 10;
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
