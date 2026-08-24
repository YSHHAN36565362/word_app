"use client";

import { useEffect, useRef } from "react";

type KeyHandlerMap = Record<string, () => void>;

/**
 * key(예: " ", "Enter", "1", "ArrowLeft")를 눌렀을 때 해당 핸들러를 실행한다.
 * input/textarea/select에 포커스가 있을 때는 무시한다 (이 앱엔 학습 화면에 그런
 * 요소가 없지만, 방어적으로 남겨둔다). handlers는 매 렌더마다 새 객체로 넘겨도
 * 되도록 ref로 최신 값만 참조하고, 리스너 자체는 enabled가 바뀔 때만 새로 붙인다.
 *
 * "Numpad8" 같은 code 키도 handlers에 넣어두면 매칭된다 — 숫자 키패드는 NumLock이
 * 켜져 있으면 e.key가 최상단 숫자키와 똑같은 값("1"~"4")을 내놓기 때문에, e.key만으로는
 * 키패드 전용 단축키를 최상단 숫자키와 구분할 수 없다. e.code(물리적 키 위치, NumLock과
 * 무관하게 항상 "Numpad0"~"Numpad9")를 먼저 확인해서 이 문제를 피한다 — code를 key보다
 * 먼저 봐야 한다: NumLock이 켜진 상태의 Numpad2는 key="2"라서, key를 먼저 보면 최상단
 * "2"(헷갈림) 핸들러에 먼저 걸려버려 Numpad2 전용 핸들러(모름)까지 도달하지 못한다.
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
      const handler =
        handlersRef.current[e.code] ?? handlersRef.current[e.key] ?? handlersRef.current[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
