"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FileSelector from "@/components/FileSelector";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import ExitFocusButton from "@/components/ExitFocusButton";
import FocusScreen from "@/components/FocusScreen";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useUserId } from "@/hooks/useUserId";
import { fetchWords } from "@/lib/api";
import { shuffle } from "@/lib/queue";
import { fileKeyOf } from "@/lib/learningLog";
import { formatMs, loadBestTime, saveBestTimeIfFaster } from "@/lib/matchScores";
import { FileRef, WordEntry } from "@/lib/types";

// 한 판에 섞을 단어 쌍 개수. Quizlet의 Match 게임처럼 화면 하나에 다 보이도록
// 너무 많지 않게 잡는다(6쌍 = 타일 12개).
const PAIR_COUNT = 6;

interface Tile {
  id: string;
  pairId: number;
  kind: "word" | "meaning";
  text: string;
}

function buildTiles(words: WordEntry[]): Tile[] {
  const tiles: Tile[] = [];
  words.forEach((w, i) => {
    tiles.push({ id: `${i}-word`, pairId: i, kind: "word", text: w.word });
    tiles.push({ id: `${i}-meaning`, pairId: i, kind: "meaning", text: w.meaning });
  });
  return shuffle(tiles);
}

export default function MatchPage() {
  const { focus, setFocus } = useFocusMode();
  const { userId, ready } = useUserId();

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [starting, setStarting] = useState(false);
  const [bestMs, setBestMs] = useState<number | null>(null);

  const [pairTotal, setPairTotal] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<number>>(new Set());
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [fileKey, setFileKey] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!ready || !userId || selectedFiles.length === 0) {
      setBestMs(null);
      return;
    }
    loadBestTime(userId, fileKeyOf(selectedFiles.map((f) => f.path))).then(setBestMs);
  }, [ready, userId, selectedFiles]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function begin() {
    if (selectedFiles.length === 0) return;
    setStarting(true);
    const paths = selectedFiles.map((f) => f.path);
    const list = await fetchWords(paths);
    setStarting(false);
    if (list.length === 0) return;
    const picked = shuffle(list).slice(0, Math.min(PAIR_COUNT, list.length));
    setPairTotal(picked.length);
    setTiles(buildTiles(picked));
    setMatchedPairIds(new Set());
    setSelected([]);
    setWrongPair([]);
    setFinished(false);
    setNewRecord(false);
    setFileKey(fileKeyOf(paths));
    setStartedAt(Date.now());
    setElapsedMs(0);
    setFocus(true);
  }

  useEffect(() => {
    if (!focus || finished) return;
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [focus, finished, startedAt]);

  function pickTile(tile: Tile) {
    if (finished || matchedPairIds.has(tile.pairId) || selected.includes(tile.id) || selected.length === 2) return;
    const nextSelected = [...selected, tile.id];
    setSelected(nextSelected);
    if (nextSelected.length < 2) return;

    const [aId, bId] = nextSelected;
    const a = tiles.find((t) => t.id === aId)!;
    const b = tiles.find((t) => t.id === bId)!;

    if (a.pairId === b.pairId && a.kind !== b.kind) {
      setTimeout(() => {
        setMatchedPairIds((prev) => {
          const next = new Set(prev).add(a.pairId);
          if (next.size === pairTotal) {
            const finalMs = Date.now() - startedAt;
            setElapsedMs(finalMs);
            setFinished(true);
            if (userId) saveBestTimeIfFaster(userId, fileKey, finalMs).then(setNewRecord);
          }
          return next;
        });
        setSelected([]);
      }, 220);
    } else {
      setWrongPair(nextSelected);
      setTimeout(() => {
        setWrongPair([]);
        setSelected([]);
      }, 500);
    }
  }

  if (focus) {
    return (
      <FocusScreen
        top={
          <div className="flex items-center justify-between text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            <span>맞춘 짝 {matchedPairIds.size} / {pairTotal}</span>
            <span className="tabular-nums" style={{ color: "var(--text)" }}>
              {formatMs(elapsedMs)}
            </span>
          </div>
        }
      >
        {finished ? (
          <div className="study-card mt-6 p-8 text-center">
            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
              완료! {formatMs(elapsedMs)}
            </div>
            {newRecord && (
              <div className="mt-1 text-sm font-bold" style={{ color: "var(--amber)" }}>
                이 조합의 새 기록입니다.
              </div>
            )}
            {!newRecord && bestMs !== null && (
              <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                최고 기록 {formatMs(Math.min(bestMs, elapsedMs))}
              </div>
            )}
            <button onClick={begin} className="btn-3d btn-accent mt-4 w-full">
              같은 조합으로 다시하기
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {tiles.map((tile) => {
              const isMatched = matchedPairIds.has(tile.pairId);
              const isSelected = selected.includes(tile.id);
              const isWrong = wrongPair.includes(tile.id);
              return (
                <button
                  key={tile.id}
                  onClick={() => pickTile(tile)}
                  disabled={isMatched}
                  className="study-card px-3 py-4 text-sm font-bold text-center break-keep"
                  style={{
                    opacity: isMatched ? 0.15 : 1,
                    pointerEvents: isMatched ? "none" : "auto",
                    background: isWrong || isSelected ? "var(--hint-bg)" : "var(--card)",
                    borderColor: isWrong ? "var(--red)" : isSelected ? "var(--blue)" : "var(--card-border)",
                    borderWidth: isWrong || isSelected ? 2 : 1,
                  }}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>
        )}
        <ExitFocusButton onExit={() => {}} label="매칭 게임 종료하기" />
      </FocusScreen>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader
        icon="매"
        accent="#8b5cf6"
        title="매칭 게임"
        subtitle="단어와 뜻이 적힌 타일을 짝지어 최대한 빨리 맞혀보세요."
      />

      {ready && !userId && (
        <div className="mt-3 rounded-xl px-4 py-2.5 text-xs" style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}>
          <Link href="/more/settings" className="font-bold underline">
            내 번호
          </Link>
          를 설정하면 이 조합의 최고 기록이 저장됩니다.
        </div>
      )}

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} />
      </div>

      {selectedFiles.length > 0 && bestMs !== null && (
        <div className="mt-3 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          이 조합의 최고 기록: {formatMs(bestMs)}
        </div>
      )}

      <button onClick={begin} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-purple mt-5 w-full">
        {starting ? (
          <>
            <Spinner size={16} className="mr-2" />
            불러오는 중...
          </>
        ) : (
          `매칭 게임 시작 (${PAIR_COUNT}쌍)`
        )}
      </button>
    </div>
  );
}
