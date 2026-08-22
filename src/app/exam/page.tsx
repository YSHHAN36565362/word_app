"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FileSelector from "@/components/FileSelector";
import ExitFocusButton from "@/components/ExitFocusButton";
import ProgressBar from "@/components/ProgressBar";
import FlashCard from "@/components/FlashCard";
import Mascot, { MascotState } from "@/components/Mascot";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useUserId } from "@/hooks/useUserId";
import { fetchWords } from "@/lib/api";
import { getDisplaySide, shuffle } from "@/lib/queue";
import { addWordsToWrongNotes, appendStudyStat, deleteProgress, loadProgress, saveProgress } from "@/lib/progress";
import { ExamProgress, FileRef, StudyMode, WordEntry } from "@/lib/types";

export default function ExamPage() {
  const { focus, setFocus } = useFocusMode();
  const { userId, ready } = useUserId();

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [availableWords, setAvailableWords] = useState<WordEntry[]>([]);
  const [countInput, setCountInput] = useState(10);
  const [saved, setSaved] = useState<ExamProgress | null>(null);

  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [current, setCurrent] = useState<WordEntry | null>(null);
  const [mode, setMode] = useState<StudyMode>("random");
  const [displaySide, setDisplaySide] = useState<0 | 1>(0);
  const [total, setTotal] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [wrongWords, setWrongWords] = useState<WordEntry[]>([]);
  const [resultSaved, setResultSaved] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [filesLabel, setFilesLabel] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadProgress<ExamProgress>(userId, "exam").then((p) => {
      if (p && (p.queue?.length || p.currentWord)) setSaved(p);
    });
  }, [ready, userId]);

  useEffect(() => {
    if (selectedFiles.length === 0) {
      // 파일 선택이 비면 이전 목록을 즉시 비워 화면에 낡은 개수가 남지 않게 한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableWords([]);
      return;
    }
    fetchWords(selectedFiles.map((f) => f.path)).then((list) => {
      setAvailableWords(list);
      setCountInput((c) => Math.max(1, Math.min(c, list.length)));
    });
  }, [selectedFiles]);

  function persist(next: {
    queue: WordEntry[];
    current: WordEntry | null;
    total: number;
    num: number;
    correct: number;
    wrong: number;
    side: 0 | 1;
    m: StudyMode;
    labels: string[];
  }) {
    if (!userId) return;
    saveProgress(userId, "exam", {
      filesLabel: next.labels,
      mode: next.m,
      queue: next.queue,
      currentWord: next.current,
      displaySide: next.side,
      totalCount: next.total,
      currentNumber: next.num,
      correctCount: next.correct,
      wrongCount: next.wrong,
    } as ExamProgress);
  }

  function begin(selectedMode: StudyMode) {
    if (availableWords.length === 0) return;
    const pool = shuffle(availableWords);
    const count = Math.min(countInput, pool.length);
    const examWords = pool.slice(0, count);
    const q = [...examWords];
    const first = q.shift() ?? null;
    const side = getDisplaySide(selectedMode);
    const labels = selectedFiles.map((f) => f.label);

    setMode(selectedMode);
    setQueue(q);
    setCurrent(first);
    setTotal(count);
    setCurrentNumber(1);
    setCorrectCount(0);
    setWrongCount(0);
    setShowAnswer(false);
    setWrongWords([]);
    setResultSaved(false);
    setMascotState("idle");
    setDisplaySide(side);
    setFilesLabel(labels);
    setFocus(true);

    persist({ queue: q, current: first, total: count, num: 1, correct: 0, wrong: 0, side, m: selectedMode, labels });
  }

  function resume() {
    if (!saved) return;
    setMode(saved.mode);
    setQueue(saved.queue);
    setCurrent(saved.currentWord);
    setTotal(saved.totalCount);
    setCurrentNumber(saved.currentNumber);
    setCorrectCount(saved.correctCount);
    setWrongCount(saved.wrongCount);
    setShowAnswer(false);
    setWrongWords([]);
    setResultSaved(false);
    setFilesLabel(saved.filesLabel);
    setFocus(true);
  }

  function next(correct: boolean) {
    if (!current) return;
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextWrong = wrongCount + (correct ? 0 : 1);
    if (!correct) setWrongWords((prev) => [...prev, current]);

    const nextQueue = [...queue];
    const nextCurrent = nextQueue.length > 0 ? nextQueue.shift()! : null;
    const nextSide = getDisplaySide(mode);
    const nextNumber = currentNumber + 1;

    setMascotState(correct ? "correct" : "wrong");
    setQueue(nextQueue);
    setCurrent(nextCurrent);
    setCorrectCount(nextCorrect);
    setWrongCount(nextWrong);
    setShowAnswer(false);
    setDisplaySide(nextSide);
    setCurrentNumber(nextNumber);

    persist({ queue: nextQueue, current: nextCurrent, total, num: nextNumber, correct: nextCorrect, wrong: nextWrong, side: nextSide, m: mode, labels: filesLabel });
  }

  const finished = focus && current === null && total > 0;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 1000) / 10 : 0;

  useEffect(() => {
    if (finished && !resultSaved) {
      // 시험 종료 시 오답노트/통계 저장을 1회만 수행하기 위한 가드.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultSaved(true);
      if (userId) {
        if (wrongWords.length > 0) addWordsToWrongNotes(userId, wrongWords);
        appendStudyStat(userId, "exam", total, correctCount);
        deleteProgress(userId, "exam");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function retryWrongOnly() {
    if (wrongWords.length === 0) return;
    const q = [...wrongWords];
    const first = q.shift()!;
    setQueue(q);
    setCurrent(first);
    setTotal(wrongWords.length);
    setCurrentNumber(1);
    setCorrectCount(0);
    setWrongCount(0);
    setWrongWords([]);
    setShowAnswer(false);
    setResultSaved(false);
    setDisplaySide(getDisplaySide(mode));
  }

  if (focus) {
    const qText = current ? (displaySide === 0 ? current.word : current.meaning) : "";
    const aText = current ? (displaySide === 0 ? current.meaning : current.word) : "";

    return (
      <div className="mx-auto max-w-xl px-4 pt-4">
        {!finished && current ? (
          <>
            <ProgressBar ratio={(currentNumber - 1) / Math.max(1, total)} />
            <div className="mt-2 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              <span>진행 {currentNumber} / {total}</span>
              <span>맞음 {correctCount} · 틀림 {wrongCount}</span>
            </div>

            <div className="mt-4 flex justify-center">
              <Mascot state={mascotState} />
            </div>

            <div className="mt-3">
              <FlashCard
                flipped={showAnswer}
                front={<div className="text-2xl font-extrabold text-center">{qText}</div>}
                back={
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-lg font-bold text-center" style={{ color: "var(--text-muted)" }}>
                      {qText}
                    </div>
                    <div className="text-2xl font-extrabold text-center" style={{ color: "var(--accent-dark)" }}>
                      {aText}
                    </div>
                    {current.hint.trim() && (
                      <div
                        className="hint-reveal mt-2 w-full max-h-[42vh] overflow-y-auto rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line"
                        style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
                      >
                        {current.hint}
                      </div>
                    )}
                  </div>
                }
              />
            </div>

            {!showAnswer ? (
              <button onClick={() => setShowAnswer(true)} className="btn-3d btn-blue mt-4 w-full">
                정답 확인
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => next(true)} className="btn-3d btn-accent">
                  맞음
                </button>
                <button onClick={() => next(false)} className="btn-3d btn-red">
                  틀림
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="study-card mt-8 p-8 text-center">
            <div className="flex justify-center mb-3">
              <Mascot state={accuracy >= 70 ? "correct" : "wrong"} />
            </div>
            <div className="text-lg font-extrabold">
              시험 종료. {correctCount} / {total} (정답률 {accuracy}%)
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {accuracy >= 90 ? "훌륭합니다." : accuracy >= 70 ? "조금만 더!" : "오답 노트로 복습해봐요."}
            </div>

            {wrongCount > 0 && wrongWords.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                <button onClick={retryWrongOnly} className="btn-3d btn-blue w-full">
                  틀린 단어만 다시 풀기
                </button>
                <Link href="/wrongnotes" className="btn-3d btn-ghost w-full">
                  오답 노트 전체 보기
                </Link>
              </div>
            )}
          </div>
        )}
        <ExitFocusButton onExit={() => setSaved(null)} label="시험 종료하기" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">시험 파트</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        출제 개수를 정하고 O/X로 채점합니다. 틀린 단어는 오답 노트에 자동으로 쌓입니다.
      </p>

      {ready && !userId && (
        <div className="mt-3 rounded-xl px-4 py-2.5 text-xs" style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}>
          <Link href="/more/settings" className="font-bold underline">
            내 번호
          </Link>
          를 설정하면 오답 노트 · 통계가 기기 간에 저장됩니다.
        </div>
      )}

      {saved && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">
            저장된 시험 진행이 있습니다: {saved.currentNumber} / {saved.totalCount} (맞음 {saved.correctCount}, 틀림 {saved.wrongCount})
          </div>
          <button onClick={resume} className="btn-3d btn-blue mt-3 w-full">
            이어서 시험보기
          </button>
        </div>
      )}

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} />
      </div>

      {availableWords.length > 0 && (
        <>
          <div className="mt-5 flex items-center gap-3">
            <label className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              출제 개수 (최대 {availableWords.length}개)
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={availableWords.length}
              value={countInput}
              onChange={(e) => setCountInput(Math.max(1, Math.min(availableWords.length, Number(e.target.value) || 1)))}
              className="w-24 rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
            />
            <button onClick={() => setCountInput(availableWords.length)} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
              최대
            </button>
            <button onClick={() => setCountInput((c) => Math.min(availableWords.length, c + 5))} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
              +5
            </button>
            <button onClick={() => setCountInput((c) => Math.max(1, c - 5))} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
              -5
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={() => begin("word_only")} disabled={availableWords.length === 0} className="btn-3d btn-accent text-sm">
              이름만 시험
            </button>
            <button onClick={() => begin("meaning_only")} disabled={availableWords.length === 0} className="btn-3d btn-accent text-sm">
              뜻만 시험
            </button>
            <button onClick={() => begin("random")} disabled={availableWords.length === 0} className="btn-3d btn-accent text-sm">
              랜덤 시험
            </button>
          </div>
        </>
      )}
    </div>
  );
}
