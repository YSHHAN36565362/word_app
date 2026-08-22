"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFocusMode } from "@/contexts/FocusModeContext";

const TABS = [
  { href: "/study", label: "학습", icon: "/images/study.jpeg" },
  { href: "/practice", label: "연습", icon: "/images/practice.jpeg" },
  { href: "/exam", label: "시험", icon: "/images/test.png" },
  { href: "/wrongnotes", label: "오답노트", icon: "/images/note.jpeg" },
  { href: "/more", label: "설정", icon: "/images/setting.jpeg" },
] as const;

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
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href === "/more" && pathname.startsWith("/more"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-bold transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform"
                style={{
                  background: "#fff",
                  border: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  transform: active ? "scale(1.08)" : "scale(1)",
                }}
              >
                <Image src={tab.icon} alt="" width={28} height={28} className="h-full w-full object-cover" />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
