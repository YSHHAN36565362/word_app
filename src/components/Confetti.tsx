"use client";

import { motion } from "framer-motion";

const COLORS = ["var(--accent)", "var(--blue)", "var(--amber)", "var(--red)", "#8b5cf6"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Duolingo류 앱의 "레슨 완료" 화면처럼, 완료 카드 위에서 잠깐 터지는 색종이 조각.
 * 부모에 position:relative를 주고 그 안에 넣으면 카드 중앙에서 사방으로 퍼진다.
 */
export default function Confetti({ count = 26 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = rand(0, 360);
    const distance = rand(70, 150);
    const dx = Math.cos((angle * Math.PI) / 180) * distance;
    const dy = Math.sin((angle * Math.PI) / 180) * distance;
    return {
      id: i,
      dx,
      dy,
      size: rand(5, 9),
      color: COLORS[i % COLORS.length],
      rotate: rand(120, 480),
      duration: rand(0.6, 1.05),
      delay: rand(0, 0.08),
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-sm"
          style={{ width: p.size, height: p.size, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
