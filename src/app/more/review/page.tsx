"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { loadDueReviewWords, loadMasteredWords, resetWordMastery } from "@/lib/mastery";
import { wordKey } from "@/lib/queue";
import { WordEntry } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import HintText from "@/components/HintText";

export default function ReviewPage() {
  const { userId, ready } = useUserId();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openHint, setOpenHint] = useState<Set<number>>(new Set());
  const [resettingKey, setResettingKey] = useState<string>("");
  // 간격 반복(SRS) 주기가 다 되어 "오늘 다시 볼 때"인 단어 개수 — 맞힌 단어라도 시간이
  // 지나면 다시 잊어버릴 수 있어서, 그 주기를 계산해 우선 추천한다.
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    if (!ready || !userId) return;
    loadMasteredWords(userId).then((w) => {
      setWords(w);
      setLoading(false);
    });
    loadDueReviewWords(userId).then((w) => setDueCount(w.length));
  }, [ready, userId]);

  async function reset(idx: number) {
    const w = words[idx];
    setResettingKey(wordKey(w));
    await resetWordMastery(userId, w);
    setWords((prev) => prev.filter((_, i) => i !== idx));
    setResettingKey("");
  }

  function toggleHint(idx: number) {
    setOpenHint((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (ready && !userId) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
        <PageHeader icon="복" accent="var(--blue)" title="복습" />
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          복습 기능은{" "}
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
        icon="복"
        accent="var(--blue)"
        title="복습"
        subtitle="연습에서 완벽함(100)·조금 앎(60)으로 채점했던 단어들입니다."
      />

      {!loading && dueCount > 0 && (
        <div className="mt-4 study-card p-4" style={{ borderColor: "var(--accent)" }}>
          <div className="text-sm font-bold">오늘의 복습 {dueCount}개</div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            간격 반복 주기가 다 돼서 다시 볼 때가 된 단어들입니다. 맞힌 단어일수록 복습
            간격이 점점 늘어나요(1일 → 3일 → 7일 ...).
          </p>
          <Link href="/practice?from=due" className="btn-3d btn-accent mt-3 block w-full text-center">
            오늘의 복습 시작
          </Link>
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          불러오는 중...
        </div>
      ) : words.length === 0 ? (
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          아직 완벽함/조금 앎으로 채점한 단어가 없습니다.
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-bold">총 {words.length}개</span>
            <Link href="/practice?from=review" className="btn-3d btn-blue px-3 py-1.5 text-xs">
              복습 시작
            </Link>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            다시 헷갈리는 단어는 초기화하면, 다음 연습에서 아직 안 본 단어처럼 다시
            우선적으로 나옵니다.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {words.map((w, idx) => (
              <div key={`${wordKey(w)}-${idx}`} className="study-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold truncate">{w.word}</div>
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {w.meaning}
                    </div>
                  </div>
                  <button
                    onClick={() => reset(idx)}
                    disabled={resettingKey === wordKey(w)}
                    className="btn-3d btn-ghost shrink-0 px-3 py-1.5 text-xs"
                  >
                    {resettingKey === wordKey(w) ? "초기화 중..." : "초기화"}
                  </button>
                </div>
                {w.hint.trim() && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleHint(idx)}
                      className="text-xs font-bold underline"
                      style={{ color: "var(--blue)" }}
                    >
                      힌트 {openHint.has(idx) ? "숨기기" : "보기"}
                    </button>
                    {openHint.has(idx) && (
                      <div
                        className="hint-reveal mt-2 rounded-xl px-3 py-2 text-xs whitespace-pre-line"
                        style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
                      >
                        <HintText text={w.hint} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
