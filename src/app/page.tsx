"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { animate, splitText, stagger } from "animejs";
import { daysUntilJLPT } from "@/lib/dday";
import { useUserId } from "@/hooks/useUserId";
import { loadStreak } from "@/lib/streak";
import StreakFlame from "@/components/StreakFlame";

// splitText로 글자 단위 span을 만든 뒤 이 클래스들을 타겟으로 삼아 위아래로 둥실둥실
// 계속 움직이게 한다(말풍선들과 같은 "살아있는" 느낌을 D-day 카드에도 준다).
const FLOAT_KEYFRAMES = ["0em", "-0.2em", "0em"];

const BUBBLES: { text: string; style: CSSProperties }[] = [
  { text: "こんにちは", style: { left: -6, top: 14 } },
  { text: "HELLO", style: { right: -6, top: 2 } },
  { text: "ありがとう", style: { left: -16, top: 100 } },
  { text: "화이팅!", style: { right: -16, top: 108 } },
  { text: "단어 정복", style: { left: 4, top: 190 } },
  { text: "頑張って", style: { right: 2, top: 196 } },
];

export default function Home() {
  const ddayRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const { userId, ready } = useUserId();
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    if (!ready || !userId) return;
    loadStreak(userId).then((s) => setStreak(s.current));
  }, [ready, userId]);

  useEffect(() => {
    // new Date() 기반 계산이라 정적 프리렌더 시점(빌드 시각)이 아니라 마운트 후 실제
    // 방문 시각으로 계산해야 매일 값이 자연스럽게 줄어든다. DOM을 직접 만지는 애니메이션이라
    // React state를 거치지 않고 ref로 바로 처리한다.
    const el = ddayRef.current;
    if (!el) return;

    const target = daysUntilJLPT();
    const prefix = target >= 0 ? "D-" : "D+";
    const counter = { value: 0 };
    el.textContent = `${prefix}0`;

    // 라벨/날짜는 값이 바뀌지 않는 고정 텍스트라 바로 글자 단위로 쪼개서 둥실둥실 루프를
    // 건다(카드 자체는 framer-motion으로 아직 페이드인 전이라 화면엔 늦게 나타나 보인다).
    const splitters = [
      { ref: labelRef, className: "dday-label-char" },
      { ref: dateRef, className: "dday-date-char" },
    ]
      .filter((s) => s.ref.current)
      .map(({ ref, className }) => {
        const splitter = splitText(ref.current!, { chars: { class: className } });
        animate(`.${className}`, {
          y: FLOAT_KEYFRAMES,
          loop: true,
          duration: 1400,
          ease: "inOutSine",
          delay: stagger(50, { start: 800 }),
        });
        return splitter;
      });

    // 전광판이 은은하게 켜지는 느낌의 스케일/오파시티 인트로
    animate(el, {
      opacity: [0, 1],
      scale: [0.85, 1],
      duration: 700,
      delay: 800,
      ease: "outCubic",
    });

    // 0부터 목표 D-day까지 부드럽게 올라가는 카운트업. 숫자가 계속 바뀌는 동안은
    // 글자를 쪼개면 매 프레임 span이 다시 만들어지므로, 카운트업이 끝난 뒤에야
    // D-day 숫자도 같은 방식으로 쪼개서 둥실둥실 루프를 건다.
    animate(counter, {
      value: Math.abs(target),
      duration: 1200,
      delay: 800,
      ease: "outExpo",
      onUpdate: () => {
        el.textContent = `${prefix}${Math.round(counter.value)}`;
      },
      onComplete: () => {
        const ddaySplitter = splitText(el, { chars: { class: "dday-number-char" } });
        splitters.push(ddaySplitter);
        animate(".dday-number-char", {
          y: FLOAT_KEYFRAMES,
          loop: true,
          duration: 1400,
          ease: "inOutSine",
          delay: stagger(50),
        });
      },
    });

    return () => {
      for (const s of splitters) s.revert();
    };
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

      {streak > 0 && (
        <motion.div
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent-dark)" }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.72, type: "spring", stiffness: 260, damping: 16 }}
        >
          <StreakFlame size={15} />
          연속 학습 {streak}일째
        </motion.div>
      )}

      <motion.div
        className="mt-6 w-full rounded-2xl px-6 py-5"
        style={{ background: "#14151c", border: "1px solid #2a2b35" }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 20 }}
      >
        <div ref={labelRef} className="text-xs font-bold tracking-widest" style={{ color: "#9a9ba8" }}>
          JLPT 시험일까지
        </div>
        <div
          ref={ddayRef}
          className="mt-1 text-5xl font-extrabold tabular-nums"
          style={{
            color: "#ffb020",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            letterSpacing: "0.02em",
            opacity: 0,
          }}
        >
          D-—
        </div>
        <div ref={dateRef} className="mt-1 text-xs" style={{ color: "#6b6c7a" }}>
          2026년 12월 6일 (한국 시간 기준)
        </div>
      </motion.div>

      <motion.div
        className="mt-6 grid w-full grid-cols-2 gap-3"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95 }}
      >
        <Link href="/study" data-tour="home-study" className="btn-3d btn-accent">
          학습 시작하기
        </Link>
        <Link href="/practice" className="btn-3d btn-blue">
          練習行こう
        </Link>
      </motion.div>

      <motion.div
        className="mt-3 w-full"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05 }}
      >
        <Link href="/more/guide" className="btn-3d btn-ghost w-full text-sm">
          처음 시작하기
        </Link>
      </motion.div>
    </div>
  );
}
