import Link from "next/link";

const ITEMS = [
  { href: "/stats", title: "학습 통계", desc: "일자별 연습/시험 기록과 정답률 추이" },
  { href: "/script", title: "지문 외우기", desc: "회화문/독해 지문을 한 줄씩 암송" },
  { href: "/wordbook", title: "단어장 추가", desc: "새 단어장을 GitHub에 직접 업로드" },
  { href: "/radicals", title: "한자 풀이 사전", desc: "부수 214개 관리 및 편집" },
  { href: "/more/settings", title: "설정", desc: "내 번호, 다크 모드" },
];

export default function MorePage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">더보기</h1>
      <div className="mt-4 flex flex-col gap-2">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="study-card flex items-center justify-between px-4 py-4">
            <div>
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
