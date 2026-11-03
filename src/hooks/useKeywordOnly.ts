"use client";

import { useEffect, useState } from "react";

const KEY = "word_app_keyword_only";
const EVENT = "word_app_keyword_only_change";

/**
 * "키워드만 보기" 켬/끔. 학습·연습 어디서 바꿔도 같은 값을 쓰도록 localStorage에 두고,
 * 같은 화면 안의 다른 컴포넌트에는 커스텀 이벤트로 알린다.
 */
export function useKeywordOnly(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setOn(window.localStorage.getItem(KEY) === "1");
    /* eslint-enable react-hooks/set-state-in-effect */
    const sync = () => setOn(window.localStorage.getItem(KEY) === "1");
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function set(next: boolean) {
    window.localStorage.setItem(KEY, next ? "1" : "0");
    setOn(next);
    window.dispatchEvent(new Event(EVENT));
  }

  return [on, set];
}
