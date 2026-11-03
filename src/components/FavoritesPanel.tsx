"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Furigana from "@/components/Furigana";
import { loadFavorites, removeFavorite } from "@/lib/favorites";
import { wordKey } from "@/lib/queue";
import { WordEntry } from "@/lib/types";

interface Props {
  userId: string;
  ready: boolean;
}

/**
 * 홈의 "즐겨찾기 복습" 카드. 공부하다가 ☆(또는 K)로 표시해 둔 "모르는 단어"를 다음 날이나 원할 때
 * 첫 화면에서 바로 복습하고, 다 외운 단어는 여기서 바로 지울 수 있다(별표 해제).
 * 즐겨찾기가 하나도 없으면 아무것도 보여주지 않는다.
 */
export default function FavoritesPanel({ userId, ready }: Props) {
  const [words, setWords] = useState<WordEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set()); // 뜻을 펼친 단어

  useEffect(() => {
    if (!ready || !userId) return;
    let alive = true;
    loadFavorites(userId).then((w) => {
      if (alive) setWords(w);
    });
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  if (!ready || !userId || !words || words.length === 0) return null;

  async function unstar(w: WordEntry) {
    setWords((prev) => (prev ? prev.filter((x) => wordKey(x) !== wordKey(w)) : prev));
    await removeFavorite(userId, w);
  }

  function toggleMeaning(key: string) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mt-3 w-full study-card p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">
            <span style={{ color: "var(--amber)" }}>★</span> 즐겨찾기 복습 {words.length}개
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            모르는 단어로 표시해 둔 단어예요. 외웠으면 목록에서 지워 주세요.
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/practice?from=favorites" className="btn-3d btn-accent text-xs">
          즐겨찾기 복습 시작
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="btn-3d btn-ghost text-xs">
          {open ? "목록 접기" : "목록 보기·지우기"}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {words.map((w) => {
            const key = wordKey(w);
            return (
              <div key={key} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--hint-bg)" }}>
                <button onClick={() => toggleMeaning(key)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-extrabold">
                    <Furigana text={w.word} />
                  </div>
                  <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {shown.has(key) ? <Furigana text={w.meaning} /> : "탭하면 뜻이 보여요"}
                  </div>
                </button>
                <button
                  onClick={() => unstar(w)}
                  className="btn-3d btn-ghost shrink-0 px-2.5 py-1 text-[11px]"
                  aria-label="즐겨찾기에서 지우기"
                >
                  지우기
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
