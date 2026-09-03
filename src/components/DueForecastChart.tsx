"use client";

import { DueForecastDay } from "@/lib/insights";

/**
 * 안키의 Future Due 그래프에 해당하는 7일 복습 예보. "완벽함으로 채점하면 스택에서
 * 빠졌다가 며칠 뒤에 돌아온다"는 SRS 동작이 눈에 보이지 않아 언제 다시 나오는지
 * 감이 안 온다는 점을 보완한다.
 */
export default function DueForecastChart({ forecast }: { forecast: DueForecastDay[] }) {
  const max = Math.max(1, ...forecast.map((f) => f.count));

  return (
    <>
      <div className="flex items-end justify-between gap-1.5" style={{ height: 76 }}>
        {forecast.map((f) => (
          <div key={f.date} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
              {f.count > 0 ? f.count : ""}
            </span>
            <div
              title={`${f.date} · ${f.count}개`}
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(f.count > 0 ? 6 : 2, (f.count / max) * 48)}px`,
                background: f.count > 0 ? "var(--blue)" : "var(--hint-bg)",
              }}
            />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {f.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        완벽함은 7일 후, 조금 앎은 3일 후에 다시 올라옵니다. 오늘 칸에는 예정일이 지난
        단어도 함께 들어갑니다.
      </p>
    </>
  );
}
