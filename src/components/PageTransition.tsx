"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * 탭을 이동할 때마다(경로가 바뀔 때마다) 새 화면이 살짝 아래에서 위로 페이드인 되도록
 * 한다. 집중 모드(FocusScreen)는 경로 변경 없이 같은 페이지 안에서 상태로만 전환되므로
 * 이 애니메이션과 부딪히지 않는다.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
