"use client";

import { MasteryBreakdown } from "@/lib/insights";

/**
 * 안키의 "카드 상태 분포"에 해당하는 가로 막대. 지금까지 채점한 단어가 완벽/조금 앎/
 * 헷갈림/모름 중 어디에 몰려 있는지 한눈에 보여준다.
 */
export default function MasteryBreakdownBar({ breakdown }: { breakdown: MasteryBreakdown }) {
  const segments = [
    { label: "완벽", count: breakdown.mastered, color: "var(--accent)" },
    { label: "조금 앎", count: breakdown.learned, color: "var(--blue)" },
    { label: "헷갈림", count: breakdown.shaky, color: "var(--amber)" },
    { label: "모름", count: breakdown.unknown, color: "var(--red)" },
  ];

  return (
    <>
      <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--hint-bg)" }}>
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.label}
              title={`${s.label} ${s.count}개`}
              style={{ width: `${(s.count / breakdown.total) * 100}%`, background: s.color }}
            />
          ) : null
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
        {segments.map((s) => (
          <div key={s.label}>
            <div className="font-extrabold" style={{ color: s.color }}>
              {s.count}
            </div>
            <div style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}
