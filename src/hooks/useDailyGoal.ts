"use client";

import { useEffect, useState } from "react";

export const DAILY_GOAL_MIN = 5;
// 하루 30개부터 많게는 200개 넘게 하는 사용 패턴이라, 상한을 200에서 500으로 올렸다
// (200이 상한이면 실제 학습량을 목표에 담을 수 없어 진행 링이 매일 꽉 찬 채로 무의미해짐).
export const DAILY_GOAL_MAX = 500;
// 50개 이하 구간은 5개 단위로 세밀하게, 그 위로는 10개 단위로 빠르게 움직이게 한다.
export const DAILY_GOAL_STEP = 5;
export const DAILY_GOAL_BIG_STEP = 10;
export const DAILY_GOAL_BIG_STEP_FROM = 50;
export const DAILY_GOAL_DEFAULT = 20;

/** 현재 값에서 한 번 눌렀을 때 움직일 폭 — 큰 목표에서 5개씩 누르는 건 너무 느리다. */
export function goalStepFor(goal: number): number {
  return goal >= DAILY_GOAL_BIG_STEP_FROM ? DAILY_GOAL_BIG_STEP : DAILY_GOAL_STEP;
}

const STORAGE_KEY = "word_app_daily_goal";

/**
 * 듀오링고식 "오늘의 목표"(하루에 단어 몇 개를 볼지). 서버(학습 기록)에는 손대지 않고
 * 기기별 localStorage에만 저장한다 — 목표치는 사람마다·기기마다 다르게 잡고 싶은
 * 취향값이고, 이걸 위해 기존 학습 데이터 스키마를 건드릴 이유가 없기 때문이다.
 */
export function useDailyGoal() {
  const [goal, setGoalState] = useState(DAILY_GOAL_DEFAULT);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (stored >= DAILY_GOAL_MIN && stored <= DAILY_GOAL_MAX) setGoalState(stored);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setGoal(next: number) {
    const clamped = Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, next));
    setGoalState(clamped);
    window.localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  function adjustGoal(delta: number) {
    setGoal(goal + delta);
  }

  return { goal, setGoal, adjustGoal };
}
