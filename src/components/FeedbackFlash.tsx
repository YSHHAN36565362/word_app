"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * 채점 직후 화면 전체에 아주 잠깐 색을 스치듯 비추는 효과 (Duolingo가 정답/오답마다
 * 화면 가장자리를 초록/빨강으로 살짝 번쩍이는 것과 같은 느낌). flashKey가 바뀔 때마다
 * 새로 재생된다 — 같은 색이 연속으로 와도 다시 보이게 하기 위함.
 */
export default function FeedbackFlash({ flashKey, color }: { flashKey: number; color: string | null }) {
  return (
    <AnimatePresence>
      {flashKey > 0 && color && (
        <motion.div
          key={flashKey}
          className="pointer-events-none fixed inset-0 z-50"
          style={{ background: color }}
          initial={{ opacity: 0.28 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}
