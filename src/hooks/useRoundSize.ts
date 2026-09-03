"use client";

import { useEffect, useState } from "react";
import { ROUND_SIZE } from "@/lib/queue";

export const ROUND_SIZE_MIN = 5;
export const ROUND_SIZE_MAX = 50;
export const ROUND_SIZE_STEP = 5;

const STORAGE_KEY = "word_app_practice_round_size";

/**
 * 연습 파트의 "라운드" 크기(몇 개를 채울 때마다 완료 화면을 볼지). 기본 15개는 짧게
 * 치고 빠지는 사람 기준인데, 한 번에 100~200개씩 하는 사람에게는 완료 화면이 너무
 * 자주 끼어들어 흐름이 끊긴다 — 그래서 5~50개 사이에서 직접 고르게 했다.
 *
 * 라운드 크기는 완료 화면 주기뿐 아니라 "모름/헷갈림 단어를 몇 장 뒤에 다시 보여줄지"
 * (queue.ts의 requeuePosition)도 함께 정한다. 라운드를 크게 잡으면 틀린 단어가
 * 그만큼 더 뒤에서(더 많은 단어를 사이에 두고) 돌아온다.
 *
 * 기기별 취향값이라 localStorage에만 저장하고 학습 기록에는 쓰지 않는다.
 */
export function useRoundSize() {
  const [roundSize, setRoundSizeState] = useState(ROUND_SIZE);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (stored >= ROUND_SIZE_MIN && stored <= ROUND_SIZE_MAX) setRoundSizeState(stored);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setRoundSize(next: number) {
    const clamped = Math.min(ROUND_SIZE_MAX, Math.max(ROUND_SIZE_MIN, next));
    setRoundSizeState(clamped);
    window.localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  function adjustRoundSize(delta: number) {
    setRoundSize(roundSize + delta);
  }

  return { roundSize, setRoundSize, adjustRoundSize };
}
