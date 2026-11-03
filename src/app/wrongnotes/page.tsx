"use client";

import Furigana from "@/components/Furigana";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { loadWrongNotes, removeWordFromWrongNotes, saveWrongNotes } from "@/lib/progress";
import { WordEntry } from "@/lib/types";
import { NO_DATE_KEY, wrongNoteDateKey } from "@/lib/wrongNoteDates";
import { wordKey } from "@/lib/queue";
import PageHeader from "@/components/PageHeader";
import HintText from "@/components/HintText";

export default function WrongNotesPage() {
  const { userId, ready } = useUserId();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openHint, setOpenHint] = useState<Set<string>>(new Set());
  // 연습에 쓸 날짜(체크한 날짜). 맨 위 체크박스로 모든 날짜를 한 번에 고를 수 있다.
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready || !userId) return;
    loadWrongNotes(userId).then((w) => {
      setWords(w);
      setLoading(false);
    });
  }, [ready, userId]);

  async function markDone(w: WordEntry) {
    setWords((prev) => prev.filter((x) => wordKey(x) !== wordKey(w)));
    await removeWordFromWrongNotes(userId, w);
  }

  // 날짜별로 묶는다(최근 날짜가 위, 날짜 정보가 없는 예전 단어는 맨 아래).
  const groups = useMemo(() => {
    const map = new Map<string, WordEntry[]>();
    for (const w of words) {
      const k = wrongNoteDateKey(w);
      map.set(k, [...(map.get(k) ?? []), w]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === NO_DATE_KEY) return 1;
      if (b === NO_DATE_KEY) return -1;
      return a < b ? 1 : -1;
    });
  }, [words]);
  const allDates = groups.map(([k]) => k);
  const allPicked = allDates.length > 0 && allDates.every((k) => picked.has(k));
  const pickedCount = groups.filter(([k]) => picked.has(k)).reduce((n, [, ws]) => n + ws.length, 0);
  const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  function toggleDate(k: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleAllDates() {
    setPicked(allPicked ? new Set() : new Set(allDates));
  }

  function dateLabel(k: string) {
    if (k === NO_DATE_KEY) return "날짜 없음 (이전 기록)";
    return k === todayKey ? `${k} (오늘)` : k;
  }

  async function clearAll() {
    setWords([]);
    await saveWrongNotes(userId, []);
  }

  function toggleHint(key: string) {
    setOpenHint((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
        subtitle="시험에서 틀린 단어, 5번 이상 헷갈리거나 모른 단어가 날짜별로 쌓입니다. 복습할 날짜를 체크해서 연습하세요."
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
              <Link href={`/practice?from=wrongnotes`} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
                전체로 연습
              </Link>
              <button onClick={clearAll} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
                전체 비우기
              </button>
            </div>
          </div>

          <div className="mt-3 study-card flex items-center justify-between gap-3 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={allPicked} onChange={toggleAllDates} />
              모든 날짜 선택
            </label>
            {pickedCount > 0 ? (
              <Link
                href={`/practice?from=wrongnotes&dates=${encodeURIComponent(groups.filter(([k]) => picked.has(k)).map(([k]) => k).join(","))}`}
                className="btn-3d btn-blue px-3 py-1.5 text-xs"
              >
                선택한 날짜로 연습 ({pickedCount}개)
              </Link>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                복습할 날짜를 체크하세요
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {groups.map(([dateKey, ws]) => (
              <div key={dateKey}>
                <label className="flex cursor-pointer items-center gap-2 px-1 text-sm font-extrabold">
                  <input type="checkbox" checked={picked.has(dateKey)} onChange={() => toggleDate(dateKey)} />
                  {dateLabel(dateKey)}
                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    {ws.length}개
                  </span>
                </label>
                <div className="mt-2 flex flex-col gap-2">
                  {ws.map((w) => {
                    const key = wordKey(w);
                    return (
                      <div key={key} className="study-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold truncate">
                              <Furigana text={w.word} />
                            </div>
                            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                              <Furigana text={w.meaning} />
                            </div>
                          </div>
                          <button onClick={() => markDone(w)} className="btn-3d btn-accent shrink-0 px-3 py-1.5 text-xs">
                            암기완료
                          </button>
                        </div>
                        {w.hint.trim() && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleHint(key)}
                              className="text-xs font-bold underline"
                              style={{ color: "var(--blue)" }}
                            >
                              힌트 {openHint.has(key) ? "숨기기" : "보기"}
                            </button>
                            {openHint.has(key) && (
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
