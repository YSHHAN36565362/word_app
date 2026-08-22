"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export type MascotState = "idle" | "correct" | "wrong";

const MASCOT_IMAGE: Record<MascotState, string> = {
  idle: "/images/normal.jpeg",
  correct: "/images/happy.jpeg",
  wrong: "/images/sad.jpeg",
};

export default function Mascot({ state }: { state: MascotState }) {
  return (
    <motion.div
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
