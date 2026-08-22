"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export type MascotState = "idle" | "correct" | "wrong";

const MASCOT_IMAGE: Record<MascotState, string> = {
  idle: "/images/normal.jpeg",
  correct: "/images/happy.jpeg",
  wrong: "/images/sad.jpeg",
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

export default function Mascot({ state, reactionKey }: MascotProps) {
  return (
    <motion.div
      key={reactionKey ?? state}
      className="flex h-14 w-14 items-center justify-center"
      animate={
        state === "correct"
          ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] }
          : state === "wrong"
          ? { x: [0, -6, 6, -4, 4, 0] }
          : { y: [0, -3, 0] }
      }
      transition={
        state === "idle"
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.5, ease: "easeOut" }
      }
    >
      <Image
        key={state}
        src={MASCOT_IMAGE[state]}
        alt=""
        width={56}
        height={56}
        className="h-full w-full object-contain"
        priority
      />
    </motion.div>
  );
}
