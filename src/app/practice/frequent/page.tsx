"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { clearFrequentWrong, loadFrequentlyWrongWords } from "@/lib/mastery";
import SwipeRow from "@/components/SwipeRow";
import { WordEntry } from "@/lib/types";
import { wordKey } from "@/lib/queue";
import PageHeader from "@/components/PageHeader";

// 사이트가 점점 무거워진다는 지적이 있어서, 일부러 아주 가볍게 만든 화면이다.
// 애니메이션·마스코트·SRS 상호작용 없이 "한자를 보고 탭하면 뜻이 나오는" 목록 하나뿐.
export default function FrequentReviewPage() {
  const { userId, ready } = useUserId();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready || !userId) return;
    loadFrequentlyWrongWords(userId).then((w) => {
      setWords(w);
      setLoading(false);
    });
  }, [ready, userId]);

  function toggle(w: WordEntry) {
    const key = wordKey(w);
    setOpenIdx((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function remove(w: WordEntry) {
    setWords((prev) => prev.filter((x) => wordKey(x) !== wordKey(w)));
    await clearFrequentWrong(userId, w);
  }

  if (ready && !userId) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
        <PageHeader icon="복" accent="var(--red)" title="연습 복습" />
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          연습 복습은{" "}
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
        accent="var(--red)"
        title="연습 복습"
        subtitle="연습에서 헷갈림·모름으로 5번 이상 채점된, 유독 안 외워지는 단어만 모았습니다. 한자를 눌러보세요."
      />

      {loading ? (
        <div className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          불러오는 중...
        </div>
      ) : words.length === 0 ? (
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--accent)" }}>
          아직 5번 이상 헷갈림·모름으로 채점된 단어가 없습니다.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            단어를 누르면 뜻이 나오고, 다시 누르면 사라져요. 휴대폰은 왼쪽으로 스와이프, 컴퓨터는 오른쪽으로 밀면 빨간 ✕가 나와요 — 눌러서 목록에서 지웁니다.
          </p>
          {words.map((w) => (
            <SwipeRow key={`${w.word}-${w.meaning}`} onTap={() => toggle(w)} onDelete={() => remove(w)}>
              <div className="font-extrabold text-lg">{w.word}</div>
              {openIdx.has(wordKey(w)) && (
                <div className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  {w.meaning}
                </div>
              )}
            </SwipeRow>
          ))}
        </div>
      )}
    </div>
  );
}
