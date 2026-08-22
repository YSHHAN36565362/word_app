"use client";

import { useEffect, useRef } from "react";

type KeyHandlerMap = Record<string, () => void>;

/**
 * key(예: " ", "Enter", "1", "ArrowLeft")를 눌렀을 때 해당 핸들러를 실행한다.
 * input/textarea/select에 포커스가 있을 때는 무시한다 (이 앱엔 학습 화면에 그런
 * 요소가 없지만, 방어적으로 남겨둔다). handlers는 매 렌더마다 새 객체로 넘겨도
 * 되도록 ref로 최신 값만 참조하고, 리스너 자체는 enabled가 바뀔 때만 새로 붙인다.
 */
export function useKeyboardShortcuts(handlers: KeyHandlerMap, enabled: boolean = true) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const handler = handlersRef.current[e.key] ?? handlersRef.current[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
