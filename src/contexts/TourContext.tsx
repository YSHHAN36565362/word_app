"use client";

import { createContext, ReactNode, useContext, useState } from "react";

export interface TourStep {
  /** 이 스텝이 활성화되는 경로(정확히 일치할 때만 하이라이트를 보여준다) */
  path: string;
  /** 강조할 요소를 찾는 data-tour 값. 빈 문자열이면 마지막 "완료" 스텝. */
  target: string;
  /** 사용자에게 보여줄 안내 문구 */
  message: string;
}

// 사이트 체험하기: 처음 오는 사람이 하단 탭을 하나씩 눌러보며 전체 구조를 훑도록
// 안내한다. 실제 기능을 다 가르치기보다는 "이런 파트들이 있다"만 빠르게 보여주는
// 목적이라 스텝을 길게 잡지 않았다.
export const TOUR_STEPS: TourStep[] = [
  { path: "/", target: "home-study", message: "초록 버튼을 눌러 학습 파트로 가볼까요?" },
  { path: "/study", target: "nav-practice", message: "이번엔 아래 '연습' 탭을 눌러보세요." },
  { path: "/practice", target: "nav-match", message: "단어를 짝짓는 '매칭게임'도 있어요." },
  { path: "/match", target: "nav-exam", message: "'시험' 탭에서 실력을 확인할 수 있어요." },
  { path: "/exam", target: "nav-wrongnotes", message: "틀린 단어는 '오답노트'에 자동으로 모여요." },
  { path: "/wrongnotes", target: "nav-settings", message: "마지막으로 '설정' 탭을 눌러보세요." },
  { path: "/more", target: "", message: "체험이 끝났습니다! 내 번호를 등록하면 진행 상황이 저장돼요." },
];

interface TourState {
  active: boolean;
  stepIndex: number;
  start: () => void;
  stop: () => void;
  /** 페이지 이동 후 그 경로에 해당하는 스텝이 있으면 그 스텝으로 넘어간다. */
  advanceIfAt: (path: string) => void;
}

const TourContext = createContext<TourState>({
  active: false,
  stepIndex: 0,
  start: () => {},
  stop: () => {},
  advanceIfAt: () => {},
});

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  function start() {
    setStepIndex(0);
    setActive(true);
  }

  function stop() {
    setActive(false);
  }

  function advanceIfAt(path: string) {
    setStepIndex((prev) => {
      for (let i = prev; i < TOUR_STEPS.length; i++) {
        if (TOUR_STEPS[i].path === path) return i;
      }
      return prev;
    });
  }

  return <TourContext.Provider value={{ active, stepIndex, start, stop, advanceIfAt }}>{children}</TourContext.Provider>;
}

export function useTour() {
  return useContext(TourContext);
}
