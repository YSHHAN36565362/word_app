"use client";

import { useEffect, useState } from "react";

export const SCORE_BTN_SCALE_MIN = 0.5;
export const SCORE_BTN_SCALE_MAX = 1.3;

/**
 * 데스크탑을 대형 TV에 연결해서 쓸 때, 연습 파트의 채점 버튼(완벽함/조금 앎/헷갈림/
 * 모름)이 화면에 비해 지나치게 크게 보인다는 피드백에 따른 크기 조절 + 숨김 기능.
 *
 * 글자 크기 조절(useFontScale)은 "그 세션 동안만" 유지되면 되어 sessionStorage를
 * 쓰지만, 이건 "거실 TV 전용 PC"처럼 한 번 맞춰두면 그 기기에서 계속 같은 설정을
 * 쓰고 싶은 경우가 많아 localStorage에 저장한다(hideMascot과 같은 이유).
 */
export function useScoreButtonPrefs() {
  const [scale, setScaleState] = useState(1);
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const storedScale = Number(window.localStorage.getItem("word_app_practice_score_btn_scale"));
    if (storedScale >= SCORE_BTN_SCALE_MIN && storedScale <= SCORE_BTN_SCALE_MAX) setScaleState(storedScale);
    if (window.localStorage.getItem("word_app_practice_score_btn_hidden") === "1") setHiddenState(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setScale(next: number) {
    setScaleState(next);
    window.localStorage.setItem("word_app_practice_score_btn_scale", String(next));
  }

  function adjustScale(delta: number) {
    setScale(Math.round(Math.min(SCORE_BTN_SCALE_MAX, Math.max(SCORE_BTN_SCALE_MIN, scale + delta)) * 10) / 10);
  }

  function setHidden(next: boolean) {
    setHiddenState(next);
    window.localStorage.setItem("word_app_practice_score_btn_hidden", next ? "1" : "0");
  }

  return { scale, setScale, adjustScale, hidden, setHidden };
}
