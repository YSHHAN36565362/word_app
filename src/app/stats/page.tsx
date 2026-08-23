"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { loadStudyStats } from "@/lib/progress";
import { StudyStatRecord } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function StatsPage() {
  const { userId, ready } = useUserId();
  const [records, setRecords] = useState<StudyStatRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !userId) return;
    loadStudyStats(userId).then((r) => {
      setRecords(r);
      setLoading(false);
    });
  }, [ready, userId]);

  const examRecords = useMemo(() => records.filter((r) => r.part === "exam"), [records]);
  const totalQuestions = examRecords.reduce((s, r) => s + r.total, 0);
  const totalCorrect = examRecords.reduce((s, r) => s + r.correct, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : 0;

  const daily = useMemo(() => {
    const map = new Map<string, { examTotal: number; examCorrect: number; practiceCount: number }>();
    for (const r of records) {
      const entry = map.get(r.date) ?? { examTotal: 0, examCorrect: 0, practiceCount: 0 };
      if (r.part === "exam") {
        entry.examTotal += r.total;
        entry.examCorrect += r.correct;
      } else {
        entry.practiceCount += 1;
      }
      map.set(r.date, entry);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);
  }, [records]);

  const trend = examRecords.slice(-20).map((r) => (r.total > 0 ? Math.round((r.correct / r.total) * 1000) / 10 : 0));

  if (ready && !userId) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
        <PageHeader icon="통" accent="var(--blue)" title="학습 통계" />
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          학습 통계는{" "}
          <Link href="/more/settings" className="font-bold underline">
            내 번호
          </Link>
          를 입력해야 사용할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader
        icon="통"
        accent="var(--blue)"
        title="학습 통계"
        subtitle="연습·시험을 마칠 때마다 자동으로 기록됩니다."
      />

      {loading ? (
        <div className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          불러오는 중...
        </div>
      ) : records.length === 0 ? (
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          아직 기록된 학습 데이터가 없습니다.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="study-card p-3 text-center">
              <div className="text-lg font-extrabold">{records.length}회</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                총 학습 세션
              </div>
            </div>
            <div className="study-card p-3 text-center">
              <div className="text-lg font-extrabold">{totalQuestions}개</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                누적 시험 문항
              </div>
            </div>
            <div className="study-card p-3 text-center">
              <div className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {overallAccuracy}%
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                전체 정답률
              </div>
            </div>
          </div>

          {trend.length >= 2 && (
            <div className="mt-5 study-card p-4">
              <div className="text-sm font-bold mb-2">시험 정답률 추이</div>
              <svg viewBox="0 0 200 60" className="w-full h-16">
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  points={trend
                    .map((v, i) => `${(i / (trend.length - 1)) * 200},${60 - (v / 100) * 56 - 2}`)
                    .join(" ")}
                />
              </svg>
            </div>
          )}

          <div className="mt-5">
            <div className="text-sm font-bold mb-2">일자별 기록 (최근 30건)</div>
            <div className="flex flex-col gap-1.5">
              {daily.map(([date, info]) => (
                <div key={date} className="study-card px-4 py-2.5 text-sm flex items-center justify-between">
                  <span className="font-bold">{date}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {info.examTotal > 0 &&
                      `시험 ${Math.round((info.examCorrect / info.examTotal) * 1000) / 10}% (${info.examCorrect}/${info.examTotal})`}
                    {info.examTotal > 0 && info.practiceCount > 0 && " · "}
                    {info.practiceCount > 0 && `연습 ${info.practiceCount}회`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
