"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export type MascotState = "idle" | "correct" | "wrong";

const MASCOT_IMAGE: Record<Exclude<MascotState, "wrong">, string> = {
  idle: "/images/normal.jpeg",
  correct: "/images/correct-banner.png",
};

// 모름/헷갈림은 다른 상태보다 훨씬 자주 나오는데, 매번 같은 한숨 쉬는 그림만 보면
// 사용자가 지칠 수 있어서 여러 장을 두고 매번 랜덤으로 고른다. 시골에서 농사짓기·
// 해고 등 살짝 유머러스한 그림도 섞어서 너무 침울하게만 느껴지지 않게 했다.
const WRONG_IMAGES = [
  "/images/wrong-banner.png",
  "/images/wrong-banner-2.png",
  "/images/wrong-banner-3.png",
  "/images/wrong-banner-4.png",
  "/images/wrong-banner-5.png",
  "/images/wrong-banner-6.png",
  "/images/wrong-banner-7.png",
  "/images/wrong-banner-8.png",
  "/images/wrong-banner-9.png",
];

// 배경에 살짝 색을 깔아, 투명 배경인 일러스트가 카드처럼 떠 보이게 한다.
const MASCOT_BG: Record<MascotState, string> = {
  idle: "var(--hint-bg)",
  correct: "var(--accent-soft)",
  wrong: "var(--hint-bg)",
};

interface MascotProps {
  state: MascotState;
  /**
   * 채점할 때마다 바뀌는 값(예: 카운터)을 넘기면, 같은 state를 연속으로 받아도
   * (헷갈림→헷갈림처럼) motion.div가 매번 새로 마운트되어 흔들림/반응 애니메이션이
   * 처음부터 다시 재생된다. state만 보고 key를 잡으면 값이 그대로일 때 애니메이션이
   * 재생되지 않는 문제가 있었다.
   */
  reactionKey?: number | string;
}

/**
 * 정답/오답 반응 이미지를 단어 카드 위에 작게 보여준다. 너비를 화면의 절반 정도로
 * 제한하고 object-contain을 써서, 화면 비율이 이상하거나(예: TV에 HDMI로 연결해
 * 해상도가 달라지는 경우) 일러스트 원본 비율과 박스 비율이 안 맞아도 이미지가
 * 잘리거나 늘어나지 않고 항상 전체가 그대로 보인다(레터박스로 여백만 생김).
 */
export default function Mascot({ state, reactionKey }: MascotProps) {
  // Math.random을 렌더 중에 직접 쓰면 순수하지 않은 렌더가 되므로, reactionKey를
  // 해시해서 결정론적으로 "무작위처럼 보이는" 인덱스를 뽑는다 — reactionKey(turnId)가
  // 매 문제마다 바뀌므로 결과적으로 매번 다른 그림이 나오되, 같은 렌더 중에는 항상
  // 같은 값이 나오는 순수 함수다.
  const wrongSrc = useMemo(() => {
    const seed = String(reactionKey ?? "");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return WRONG_IMAGES[Math.abs(hash) % WRONG_IMAGES.length];
  }, [reactionKey]);
  const src = state === "wrong" ? wrongSrc : MASCOT_IMAGE[state];

  return (
    <motion.div
      key={reactionKey ?? state}
      className="relative mx-auto w-1/2 max-w-[16rem] overflow-hidden rounded-2xl"
      style={{ aspectRatio: "1 / 1", background: MASCOT_BG[state] }}
      animate={
        state === "correct"
          ? { y: [0, -6, 0], rotate: [0, -1.2, 1.2, 0] }
          : state === "wrong"
          ? { x: [0, -8, 8, -5, 5, 0] }
          : { y: [0, -3, 0] }
      }
      transition={
        state === "idle"
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.5, ease: "easeOut" }
      }
    >
      <Image
        key={src}
        src={src}
        alt=""
        fill
        sizes="16rem"
        className="object-contain"
        priority
      />
    </motion.div>
  );
}
