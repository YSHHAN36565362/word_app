"use client";

import Confetti from "./Confetti";
import Mascot from "./Mascot";

export interface SessionTally {
  perfect: number; // 완벽함(100)
  learned: number; // 조금 앎(60)
  shaky: number; // 헷갈림(40)
  unknown: number; // 모름(0)
  startedAt: number; // 세션 시작 시각(ms)
}

export const EMPTY_TALLY: SessionTally = { perfect: 0, learned: 0, shaky: 0, unknown: 0, startedAt: 0 };

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest === 0 ? `${min}분` : `${min}분 ${rest}초`;
}

/**
 * 듀오링고의 레슨 완료 화면처럼, 연습을 끝냈을 때 "이번에 뭘 했는지"를 요약해준다.
 * 예전에는 "대기열의 모든 연습을 완료했습니다." 한 줄뿐이라, 방금 100개를 풀었어도
 * 뭘 얼마나 맞혔는지 알 수가 없었다.
 *
 * 채점 횟수 기준이라 같은 단어를 여러 번 채점하면(모름 → 다시 나옴 → 완벽함) 각각
 * 세어진다 — "이번 세션에서 내가 누른 버튼의 분포"로 읽으면 정확하다.
 */
export default function SessionSummary({
  tally,
  total,
  hideMascot,
  elapsedMs,
  onExtraAction,
}: {
  tally: SessionTally;
  total: number;
  hideMascot: boolean;
  /** 세션이 끝난 시점에 계산해서 넘긴다 — 렌더 중에 Date.now()를 부르면 순수하지 않다. */
  elapsedMs: number | null;
  onExtraAction?: { label: string; onClick: () => void };
}) {
  const graded = tally.perfect + tally.learned + tally.shaky + tally.unknown;
  const firstTryish = graded > 0 ? Math.round(((tally.perfect + tally.learned) / graded) * 100) : 0;
  const elapsed = elapsedMs != null && elapsedMs > 0 ? formatElapsed(elapsedMs) : null;

  const rows = [
    { label: "완벽함", value: tally.perfect, color: "var(--accent)" },
    { label: "조금 앎", value: tally.learned, color: "var(--blue)" },
    { label: "헷갈림", value: tally.shaky, color: "var(--amber)" },
    { label: "모름", value: tally.unknown, color: "var(--red)" },
  ];

  return (
    <div className="study-card relative mt-8 p-6 text-center">
      <Confetti />
      {!hideMascot && (
        <div className="mb-3 flex justify-center">
          <Mascot state="correct" />
        </div>
      )}
      <div className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>
        연습 완료! 단어 {total}개
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        채점 {graded}회{elapsed ? ` · ${elapsed}` : ""} · 완벽·조금 앎 비율 {firstTryish}%
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl py-2" style={{ background: "var(--hint-bg)" }}>
            <div className="text-lg font-extrabold" style={{ color: r.color }}>
              {r.value}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {r.label}
            </div>
          </div>
        ))}
      </div>

      {graded > 0 && (
        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--hint-bg)" }}>
          {rows.map((r) =>
            r.value > 0 ? (
              <div key={r.label} style={{ width: `${(r.value / graded) * 100}%`, background: r.color }} />
            ) : null
          )}
        </div>
      )}

      {tally.shaky + tally.unknown > 0 && (
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          헷갈림·모름으로 채점한 단어는 오답 노트와 &quot;연습 복습&quot;에서 다시 만날 수 있어요.
        </p>
      )}

      {onExtraAction && (
        <button onClick={onExtraAction.onClick} className="btn-3d btn-accent mt-4 w-full text-sm">
          {onExtraAction.label}
        </button>
      )}
    </div>
  );
}
