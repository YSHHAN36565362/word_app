"use client";

import { motion } from "framer-motion";

export default function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "var(--hint-bg)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: "var(--accent)" }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
