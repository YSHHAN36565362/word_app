"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FileSelector from "@/components/FileSelector";
import ExitFocusButton from "@/components/ExitFocusButton";
import FocusScreen from "@/components/FocusScreen";
import ProgressBar from "@/components/ProgressBar";
import KeyBadge from "@/components/KeyBadge";
import Spinner from "@/components/Spinner";
import SessionInfoPanel from "@/components/SessionInfoPanel";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserId } from "@/hooks/useUserId";
import { fetchWords } from "@/lib/api";
import { shuffle } from "@/lib/queue";
import { deleteProgress, loadProgress, saveProgress } from "@/lib/progress";
import { fileSummaryOf, upsertLearningLog } from "@/lib/learningLog";
import { FileRef, StudyProgress, WordEntry } from "@/lib/types";

export default function StudyPage() {
  const { focus, setFocus } = useFocusMode();
  const { userId, ready } = useUserId();

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState<StudyProgress | null>(null);

  const [words, setWords] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilePaths, setActiveFilePaths] = useState<string[]>([]);
  const [activeFileLabels, setActiveFileLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadProgress<StudyProgress>(userId, "study").then((p) => {
      if (p && p.words && p.words.length > 0) setSaved(p);
    });
  }, [ready, userId]);

  async function begin() {
    if (selectedFiles.length === 0) return;
    setStarting(true);
    const paths = selectedFiles.map((f) => f.path);
    const labels = selectedFiles.map((f) => f.label);
    const list = await fetchWords(paths);
    setStarting(false);
    if (list.length === 0) return;
    const pool = shuffle(list);
    setWords(pool);
    setIndex(0);
    setShowHint(false);
    setActiveFilePaths(paths);
    setActiveFileLabels(labels);
    setFocus(true);
    if (userId) {
      saveProgress(userId, "study", {
        words: pool,
        filesLabel: labels,
        filePaths: paths,
        studyIndex: 0,
      } as StudyProgress);
      upsertLearningLog(userId, "study", paths, fileSummaryOf(labels), pool.length, 0);
    }
  }

  function resume() {
    if (!saved) return;
    setWords(saved.words);
    setIndex(saved.studyIndex);
    setShowHint(false);
    setActiveFilePaths(saved.filePaths ?? []);
    setActiveFileLabels(saved.filesLabel ?? []);
    setFocus(true);
  }

  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    setShowHint(false);
    if (userId) {
      saveProgress(userId, "study", {
        words,
        filesLabel: activeFileLabels,
        filePaths: activeFilePaths,
        studyIndex: nextIndex,
      } as StudyProgress);
      if (activeFilePaths.length > 0) {
        upsertLearningLog(userId, "study", activeFilePaths, fileSummaryOf(activeFileLabels), words.length, Math.min(nextIndex, words.length));
      }
    }
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    if (index === 0) return;
    goTo(index - 1);
  }

  function toggleFavorite(word: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  const done = index >= words.length;

  useEffect(() => {
    if (focus && done && userId) {
      deleteProgress(userId, "study");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useKeyboardShortcuts(
    {
      ArrowRight: () => next(),
      ArrowLeft: () => prev(),
      h: () => {
        if (words[index]?.hint.trim()) setShowHint(true);
      },
    },
    focus && !done
  );

  if (focus) {
    const current = words[index];
    return (
      <FocusScreen
        top={
          !done && current ? (
            <>
              <ProgressBar ratio={index / Math.max(1, words.length)} />
              <div className="mt-2 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                {index + 1} / {words.length}
              </div>
            </>
          ) : null
        }
        actions={
          !done && current ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={prev} disabled={index === 0} className="btn-3d btn-ghost text-sm">
                이전
                <KeyBadge>←</KeyBadge>
              </button>
              <button onClick={() => setShowHint(true)} disabled={!current.hint.trim()} className="btn-3d btn-ghost text-sm">
                힌트
                <KeyBadge>H</KeyBadge>
              </button>
              <button onClick={next} className="btn-3d btn-accent text-sm">
                다음
                <KeyBadge>→</KeyBadge>
              </button>
            </div>
          ) : undefined
        }
      >
        {!done && current ? (
          <div className="study-card mt-4 p-8 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-extrabold" style={{ color: "var(--blue)" }}>
                {current.word}
              </div>
              <button onClick={() => toggleFavorite(current.word)} className="text-lg" aria-label="즐겨찾기">
                {favorites.has(current.word) ? "★" : "☆"}
              </button>
            </div>
            <div className="text-lg font-semibold text-center">{current.meaning}</div>
            {showHint && current.hint.trim() && (
              <div
                className="hint-reveal w-full max-h-[42vh] overflow-y-auto rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line"
                style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
              >
                {current.hint}
              </div>
            )}
          </div>
        ) : (
          <div className="study-card mt-10 p-8 text-center">
            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
              모든 단어 학습을 완료했습니다.
            </div>
            {favorites.size > 0 && (
              <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                즐겨찾기한 단어 {favorites.size}개가 있어요.
              </div>
            )}
          </div>
        )}
        <ExitFocusButton onExit={() => setSaved(null)} label="학습 종료하기" />
      </FocusScreen>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">학습 파트</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        단어를 순서대로 넘기며 훑어보는 1회독입니다.
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        단축키: ←/→=이전/다음 단어 · H=힌트 보기
      </p>

      {ready && !userId && (
        <div className="mt-3 rounded-xl px-4 py-2.5 text-xs" style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}>
          <Link href="/more/settings" className="font-bold underline">
            내 번호
          </Link>
          를 설정하면 학습 진행 상황이 기기 간에 저장됩니다.
        </div>
      )}

      {saved && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">
            저장된 진행이 있습니다: {saved.studyIndex + 1} / {saved.words.length}번째 단어
          </div>
          <button onClick={resume} className="btn-3d btn-blue mt-3 w-full">
            이어서 학습하기
          </button>
        </div>
      )}

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} />
      </div>

      <button onClick={begin} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent mt-5 w-full">
        {starting ? (
          <>
            <Spinner size={16} className="mr-2" />
            불러오는 중...
          </>
        ) : (
          "학습 시작"
        )}
      </button>

      <SessionInfoPanel userId={userId} ready={ready} part="study" selectedFiles={selectedFiles} />
    </div>
  );
}
