"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { loadWrongNotes, removeWordFromWrongNotes, saveWrongNotes } from "@/lib/progress";
import { WordEntry } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import HintText from "@/components/HintText";

export default function WrongNotesPage() {
  const { userId, ready } = useUserId();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openHint, setOpenHint] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!ready || !userId) return;
    loadWrongNotes(userId).then((w) => {
      setWords(w);
      setLoading(false);
    });
  }, [ready, userId]);

  async function markDone(idx: number) {
    const w = words[idx];
    setWords((prev) => prev.filter((_, i) => i !== idx));
    await removeWordFromWrongNotes(userId, w);
  }

  async function clearAll() {
    setWords([]);
    await saveWrongNotes(userId, []);
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
        <PageHeader icon="오" accent="var(--red)" title="오답 노트" />
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          오답 노트는{" "}
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
        icon="오"
        accent="var(--red)"
        title="오답 노트"
        subtitle="시험에서 틀린 단어가 자동으로 여기 쌓입니다."
      />

      {loading ? (
        <div className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          불러오는 중...
        </div>
      ) : words.length === 0 ? (
        <div className="mt-4 study-card p-6 text-center text-sm" style={{ color: "var(--accent)" }}>
          오답 노트가 비어 있습니다.
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-bold">총 {words.length}개</span>
            <div className="flex gap-2">
              <Link href={`/practice?from=wrongnotes`} className="btn-3d btn-blue px-3 py-1.5 text-xs">
                오답 노트로 연습
              </Link>
              <button onClick={clearAll} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
                전체 비우기
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {words.map((w, idx) => (
              <div key={`${w.word}-${idx}`} className="study-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold truncate">{w.word}</div>
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {w.meaning}
                    </div>
                  </div>
                  <button onClick={() => markDone(idx)} className="btn-3d btn-accent shrink-0 px-3 py-1.5 text-xs">
                    암기완료
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
