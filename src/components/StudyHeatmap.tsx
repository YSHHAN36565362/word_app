"use client";

import { HeatmapCell } from "@/lib/insights";

interface Props {
  cells: HeatmapCell[]; // 일요일 시작, 주 단위로 이어진 셀 목록
  weeks: number;
}

// 0단계(기록 없음)는 카드 배경에 가깝게, 위로 갈수록 진하게.
const LEVEL_COLORS = ["var(--hint-bg)", "#1e5c3a", "#2f8a52", "#3fb96b", "#5fe08a"] as const;

/**
 * 깃허브 잔디 / 안키 리뷰 히트맵. "며칠 연속"이라는 숫자 하나(스트릭)만으로는 안 보이는
 * "요즘 얼마나 꾸준했는지"를 한눈에 보여준다.
 */
export default function StudyHeatmap({ cells, weeks }: Props) {
  const weekColumns: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) weekColumns.push(cells.slice(w * 7, w * 7 + 7));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" style={{ minWidth: weeks * 13 }}>
        {weekColumns.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date} · ${cell.count > 0 ? `${cell.count}문항` : cell.level > 0 ? "학습함" : "기록 없음"}`}
                className="rounded-[3px]"
                style={{ width: 10, height: 10, background: LEVEL_COLORS[cell.level] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span>적음</span>
        {LEVEL_COLORS.map((c) => (
          <span key={c} className="rounded-[3px]" style={{ width: 10, height: 10, background: c }} />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
