"use client";

import { motion } from "framer-motion";

export type MascotState = "idle" | "correct" | "wrong";

export default function Mascot({ state }: { state: MascotState }) {
  const bodyColor = state === "correct" ? "#58cc02" : state === "wrong" ? "#ff8a8a" : "#8aa6ff";

  return (
    <motion.svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
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
      <ellipse cx="32" cy="52" rx="16" ry="4" fill="#000" opacity="0.08" />
      <path
        d="M32 8c11 0 18 8 18 19 0 9-5 16-11 20-1 3-3 5-7 5s-6-2-7-5c-6-4-11-11-11-20 0-11 7-19 18-19Z"
        fill={bodyColor}
      />
      {state === "correct" ? (
        <>
          <path d="M22 28l4 4 6-7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="42" cy="26" r="2.4" fill="#fff" />
        </>
      ) : state === "wrong" ? (
        <>
          <path d="M22 24l7 7M29 24l-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M38 24l7 7M45 24l-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="26" r="2.6" fill="#fff" />
          <circle cx="39" cy="26" r="2.6" fill="#fff" />
          <path d="M26 35c3 2 9 2 12 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      )}
    </motion.svg>
  );
}
