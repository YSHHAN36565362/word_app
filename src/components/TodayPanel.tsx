"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAllMastery } from "@/lib/mastery";
import { dueNowCount, studiedTodayCount } from "@/lib/insights";
import { useDailyGoal } from "@/hooks/useDailyGoal";

interface ViewProps {
  due: number;
  studied: number;
  goal: number;
}

/**
 * 표시 전용 부분. 데이터 로딩과 분리해둬서, Supabase가 없는 환경(로컬 개발 등)에서도
 * 임의의 값으로 렌더링을 확인할 수 있다.
 */
export function TodayPanelView({ due, studied, goal }: ViewProps) {
  const ratio = goal > 0 ? Math.min(1, studied / goal) : 0;
  const done = studied >= goal;
  // 원형 진행 링(반지름 26 → 둘레 약 163.4).
  const R = 26;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="mt-6 w-full study-card p-4 text-left">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--hint-bg)" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke={done ? "var(--accent)" : "var(--blue)"}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${CIRC * ratio} ${CIRC}`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[13px] font-extrabold leading-none">{studied}</span>
            <span className="text-[9px] leading-none" style={{ color: "var(--text-muted)" }}>
              /{goal}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold">
            {done ? "오늘의 목표 달성! 🎉" : `오늘 ${studied} / ${goal}개 학습`}
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            {due > 0 ? (
              <>
                복습할 때가 된 단어 <b style={{ color: "var(--accent)" }}>{due}개</b>가 기다리고 있어요
              </>
            ) : (
              "지금 복습할 단어는 없어요 — 새 단어를 학습해보세요"
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/practice?from=due"
          aria-disabled={due === 0}
          className={`btn-3d ${due > 0 ? "btn-accent" : "btn-ghost pointer-events-none opacity-50"} text-xs`}
        >
          오늘의 복습 {due > 0 ? `(${due})` : ""}
        </Link>
        <Link href="/stats" className="btn-3d btn-ghost text-xs">
          학습 통계 보기
        </Link>
      </div>
    </div>
  );
}

interface Props {
  userId: string;
  ready: boolean;
}

/**
 * 홈의 "오늘 할 일" 카드. 안키를 열면 제일 먼저 "오늘 복습할 카드 N장"이 보이고,
 * 듀오링고를 열면 "오늘의 목표 진행률"이 보이는데, 이 앱은 홈에서 그걸 알 수 없어
 * 매번 연습 파트에 들어가 봐야 했다 — 그 두 가지를 홈에 합쳐서 보여준다.
 * 읽기 전용(word_mastery 조회)이라 학습 기록에는 아무 영향이 없다.
 */
export default function TodayPanel({ userId, ready }: Props) {
  const { goal } = useDailyGoal();
  const [stat, setStat] = useState<{ due: number; studied: number; hasHistory: boolean } | null>(null);

  useEffect(() => {
    if (!ready || !userId) return;
    let alive = true;
    loadAllMastery(userId).then((m) => {
      if (!alive) return;
      setStat({ due: dueNowCount(m), studied: studiedTodayCount(m), hasHistory: m.size > 0 });
    });
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  // 아직 채점 기록이 하나도 없으면(막 시작한 사람, 동기화 미설정) 0/0짜리 빈 카드를
  // 띄우는 게 오히려 방해라 아무것도 보여주지 않는다 — 한 번이라도 채점하면 나타난다.
  if (!ready || !userId || stat === null || !stat.hasHistory) return null;

  return <TodayPanelView due={stat.due} studied={stat.studied} goal={goal} />;
}
