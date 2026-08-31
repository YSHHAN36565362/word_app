"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useFocusMode } from "@/contexts/FocusModeContext";

const TABS = [
  { href: "/study", label: "학습", icon: "/images/study.jpeg", tour: "nav-study" },
  { href: "/practice", label: "연습", icon: "/images/practice.jpeg", tour: "nav-practice" },
  { href: "/match", label: "매칭게임", icon: "/images/match.jpeg", tour: "nav-match" },
  { href: "/exam", label: "시험", icon: "/images/test.png", tour: "nav-exam" },
  { href: "/wrongnotes", label: "오답노트", icon: "/images/note.jpeg", tour: "nav-wrongnotes" },
  { href: "/more", label: "설정", icon: "/images/setting.jpeg", tour: "nav-settings" },
] as const;

// 하단 탭이 있다는 걸 못 알아채는 사용자가 있어서, 아이콘이 한 번에 하나씩 순서대로
// 통통 튀는 "웨이브" 애니메이션을 무한 반복한다. BOUNCE_DURATION만 짧게 움직이고
// 나머지(CYCLE - BOUNCE_DURATION)는 쉬었다가 처음부터 다시 시작한다.
const BOUNCE_DURATION = 0.5;
const STAGGER = 0.45;
const CYCLE = TABS.length * STAGGER + 2;

export default function BottomNav() {
  const pathname = usePathname();
  const { focus } = useFocusMode();

  if (focus) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t"
      style={{ background: "var(--nav-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-between px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
        {TABS.map((tab, i) => {
          const active = pathname === tab.href || (tab.href === "/more" && pathname.startsWith("/more"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-tour={tab.tour}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-bold transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              <motion.span
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{
                  background: "#fff",
                  border: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  scale: active ? 1.08 : 1,
                }}
                animate={{ y: [0, -9, 0] }}
                transition={{
                  duration: BOUNCE_DURATION,
                  delay: i * STAGGER,
                  repeat: Infinity,
                  repeatDelay: CYCLE - BOUNCE_DURATION,
                  ease: "easeOut",
                }}
              >
                <Image src={tab.icon} alt="" width={36} height={36} className="h-full w-full object-cover" />
              </motion.span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
