import Link from "next/link";
import PageHeader from "@/components/PageHeader";

const ITEMS = [
  { href: "/more/guide", title: "설명", desc: "파트별 기능과 편의 기능을 화면과 함께 확인", icon: "설", accent: "var(--accent)" },
  { href: "/stats", title: "학습 통계", desc: "일자별 연습/시험 기록과 정답률 추이", icon: "통", accent: "var(--blue)" },
  { href: "/favorites", title: "즐겨찾기", desc: "별표 표시한 단어만 모아보기", icon: "즐", accent: "var(--amber)", iconColor: "#2b2200" },
  { href: "/match", title: "매칭 게임", desc: "단어와 뜻을 빠르게 짝지어 맞히기", icon: "매", accent: "#8b5cf6" },
  { href: "/script", title: "지문 외우기", desc: "회화문/독해 지문을 한 줄씩 암송", icon: "지", accent: "var(--blue)" },
  { href: "/wordbook", title: "단어장 추가", desc: "새 단어장을 GitHub에 직접 업로드", icon: "단", accent: "var(--amber)", iconColor: "#2b2200" },
  { href: "/more/settings", title: "설정", desc: "내 번호, 다크 모드, 학습 기록 관리", icon: "설", accent: "#8a8a94" },
];

export default function MorePage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader icon="더" accent="#8a8a94" title="더보기" />
      <div className="mt-4 flex flex-col gap-2">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="study-card flex items-center gap-3 px-4 py-4">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
              style={{ background: item.accent, color: item.iconColor ?? "#ffffff" }}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{item.title}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {item.desc}
              </div>
            </div>
            <span style={{ color: "var(--text-muted)" }}>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
