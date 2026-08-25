"use client";

import { motion } from "framer-motion";

export default function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="progress-jelly-track">
      <motion.div
        className="progress-jelly-fill"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
      >
        <span className="progress-jelly-shine" />
      </motion.div>
    </div>
  );
}
