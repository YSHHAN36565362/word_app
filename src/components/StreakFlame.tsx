"use client";

import { motion } from "framer-motion";

/**
 * 연속 학습일(스트릭) 배지에 쓰는 작은 불꽃 아이콘. Duolingo의 스트릭 불꽃처럼
 * 미세하게 일렁이는 애니메이션을 계속 반복한다.
 */
export default function StreakFlame({ size = 16 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      animate={{ scale: [1, 1.1, 0.96, 1.05, 1], rotate: [0, -3, 2, -1, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <path
        d="M12 2c1.4 3.2-1.8 4.2-1.8 7.2a3.8 3.8 0 1 0 7.6 0c0-1-.4-2-1-2.6.1 1.8-1 2.8-1.9 2.8.9-2.8-1-3.8-1-5.8-.6 1-2 2-2 3.8-1-1-1.2-3.2.1-5.4z"
        fill="#ff8a3d"
      />
    </motion.svg>
  );
}
