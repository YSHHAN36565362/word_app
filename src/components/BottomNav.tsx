"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFocusMode } from "@/contexts/FocusModeContext";

const TABS = [
  { href: "/study", label: "학습" },
  { href: "/practice", label: "연습" },
  { href: "/exam", label: "시험" },
  { href: "/wrongnotes", label: "오답노트" },
  { href: "/more", label: "더보기" },
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
      <div className="mx-auto flex max-w-xl items-stretch justify-between px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href === "/more" && pathname.startsWith("/more"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold transition-colors"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <span
                className="h-1.5 w-6 rounded-full transition-all"
                style={{ background: active ? "var(--accent)" : "transparent" }}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
