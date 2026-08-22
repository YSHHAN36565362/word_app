"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { daysUntilJLPT } from "@/lib/dday";

const BUBBLES: { text: string; style: CSSProperties }[] = [
  { text: "こんにちは", style: { left: -6, top: 14 } },
  { text: "HELLO", style: { right: -6, top: 2 } },
  { text: "ありがとう", style: { left: -16, top: 100 } },
  { text: "화이팅!", style: { right: -16, top: 108 } },
  { text: "단어 정복", style: { left: 4, top: 190 } },
  { text: "頑張って", style: { right: 2, top: 196 } },
];

export default function Home() {
  const [dday, setDday] = useState<number | null>(null);

  useEffect(() => {
    // new Date() 기반 계산이라 렌더 중에 바로 부르면 정적 프리렌더 시점(빌드 시각)의
    // 값이 그대로 굳어버린다. 마운트 후에만 계산해야 방문할 때마다 실제 날짜로 갱신된다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDday(daysUntilJLPT());
  }, []);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 pt-10 pb-10 text-center">
      <div className="relative" style={{ width: 270, height: 270 }}>
        {BUBBLES.map((b, i) => (
          <motion.div
            key={b.text}
            className="absolute z-10 rounded-2xl px-3 py-2 text-xs font-bold shadow-md"
            style={{ ...b.style, background: "var(--card)", color: "var(--text)", border: "1px solid var(--card-border)" }}
            initial={{ opacity: 0, scale: 0.4, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: [8, 0, -5, 0] }}
            transition={{
              opacity: { delay: 0.15 + i * 0.09, duration: 0.3 },
              scale: { delay: 0.15 + i * 0.09, type: "spring", stiffness: 260, damping: 16 },
              y: {
                delay: 0.15 + i * 0.09,
                duration: 2.6 + (i % 3) * 0.4,
                repeat: Infinity,
                repeatDelay: 0.6,
                ease: "easeInOut",
              },
            }}
          >
            {b.text}
          </motion.div>
        ))}

        <motion.div
          className="absolute rounded-full shadow-lg"
          style={{
            width: 130,
            height: 130,
            left: 70,
            top: 70,
            background: "var(--card)",
            border: "4px solid var(--accent-soft)",
            overflow: "hidden",
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1, y: [0, -6, 0], rotate: [0, -2, 2, 0] }}
          transition={{
            opacity: { duration: 0.4 },
            scale: { type: "spring", stiffness: 220, damping: 18 },
            y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
            rotate: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
          }}
        >
          <Image src="/images/shiba.jpg" alt="암기장 마스코트" width={130} height={130} className="h-full w-full object-cover" priority />
        </motion.div>
      </div>

      <motion.h1
        className="mt-2 text-2xl font-extrabold"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        암기장
      </motion.h1>
      <motion.p
        className="mt-1 text-sm"
        style={{ color: "var(--text-muted)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
      >
        매일 조금씩, 확실하게 외우기
      </motion.p>

      <motion.div
        className="mt-6 w-full rounded-2xl px-6 py-5"
        style={{ background: "#14151c", border: "1px solid #2a2b35" }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-xs font-bold tracking-widest" style={{ color: "#9a9ba8" }}>
          JLPT 시험일까지
        </div>
        <div
          className="mt-1 text-5xl font-extrabold tabular-nums"
          style={{ color: "#ffb020", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", letterSpacing: "0.02em" }}
        >
          {dday === null ? "D-—" : dday >= 0 ? `D-${dday}` : `D+${Math.abs(dday)}`}
        </div>
        <div className="mt-1 text-xs" style={{ color: "#6b6c7a" }}>
          2026년 12월 6일 (한국 시간 기준)
        </div>
      </motion.div>

      <motion.div
        className="mt-6 grid w-full grid-cols-2 gap-3"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95 }}
      >
        <Link href="/study" className="btn-3d btn-accent">
          학습 시작하기
        </Link>
        <Link href="/practice" className="btn-3d btn-blue">
          오늘의 복습
        </Link>
      </motion.div>
    </div>
  );
}
