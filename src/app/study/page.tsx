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
import PageHeader from "@/components/PageHeader";
import Confetti from "@/components/Confetti";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserId } from "@/hooks/useUserId";
import { fetchWords } from "@/lib/api";
import { shuffle, wordKey } from "@/lib/queue";
import { deleteProgress, saveProgress } from "@/lib/progress";
import { fileKeyOf, fileSummaryOf, upsertLearningLog } from "@/lib/learningLog";
import { addFavorite, loadFavoriteKeys, removeFavorite } from "@/lib/favorites";
import { FileRef, StudyProgress, WordEntry } from "@/lib/types";

interface RestoreRequest {
  paths: string[];
  /** true면 체크박스 복원 후 자동으로 학습을 시작한다. false면 체크박스/대시보드만 맞춰준다. */
  autoStart: boolean;
}

export default function StudyPage() {
  const { focus, setFocus } = useFocusMode();
  const { userId, ready } = useUserId();

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequest | null>(null);
  const [starting, setStarting] = useState(false);

  const [words, setWords] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilePaths, setActiveFilePaths] = useState<string[]>([]);
  const [activeFileLabels, setActiveFileLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadFavoriteKeys(userId).then(setFavorites);
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

  // 복원 요청이 들어오면, FileSelector가 그 파일들을 실제 체크박스 선택(selectedFiles)으로
  // 반영할 때까지 기다린다. [이 학습 다시 하기]처럼 autoStart가 true면 그대로 학습을
  // 시작하고, 학습을 마치고 나왔을 때처럼 false면 체크박스와 대시보드만 방금 학습한
  // 파일 조합으로 맞춰서 "진행 상황이 저장됐다"는 게 바로 보이게만 한다.
  // (기록에 있던 파일이 GitHub에서 지워졌다면 완전히 같은 조합이 되지 않을 수 있어
  // fileKey가 정확히 일치할 때만 처리한다 — 엉뚱한 파일로 잘못 시작하지 않기 위함.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restoreRequest || selectedFiles.length === 0) return;
    const selectedKey = fileKeyOf(selectedFiles.map((f) => f.path));
    const targetKey = fileKeyOf(restoreRequest.paths);
    if (selectedKey !== targetKey) return;
    const { autoStart } = restoreRequest;
    setRestoreRequest(null);
    if (autoStart) begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, restoreRequest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 이미 본 단어(index 이전)는 그대로 두고, 아직 안 본 단어들의 순서만 다시 섞는다.
  // 매번 같은 순서로 반복해서 보면 내용이 아니라 "다음 단어가 뭐였는지" 순서로
  // 외워버릴 수 있어서, 진행 중에도 원하면 순서를 바꿀 수 있게 한다.
  function shuffleRemaining() {
    setWords((prev) => {
      const next = [...prev.slice(0, index), ...shuffle(prev.slice(index))];
      if (userId && activeFilePaths.length > 0) {
        saveProgress(userId, "study", {
          words: next,
          filesLabel: activeFileLabels,
          filePaths: activeFilePaths,
          studyIndex: index,
        } as StudyProgress);
      }
      return next;
    });
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

  function toggleFavorite(word: WordEntry) {
    const key = wordKey(word);
    const isFavorited = favorites.has(key);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFavorited) next.delete(key);
      else next.add(key);
      return next;
    });
    if (userId) {
      if (isFavorited) removeFavorite(userId, word);
      else addFavorite(userId, word);
    }
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
              <button onClick={() => toggleFavorite(current)} className="text-lg" aria-label="즐겨찾기">
                {favorites.has(wordKey(current)) ? "★" : "☆"}
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
          <div className="study-card relative mt-10 p-8 text-center">
            {done && <Confetti />}
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
        <ExitFocusButton
          onExit={() => {
            // 종료 직후 방금 학습한 파일 조합으로 체크박스/대시보드를 다시 맞춰서,
            // 방금 한 학습이 저장됐다는 걸 화면에서 바로 확인할 수 있게 한다.
            // selectedFiles를 먼저 비워야 한다 — 그대로 두면 포커스 모드 동안 언마운트됐던
            // FileSelector가 아직 트리도 못 불러온 시점에 "예전 selectedFiles(=방금 학습한
            // 그 파일)가 이미 target과 같다"는 착시로 아래 복원 effect가 restoreRequest를
            // 즉시 지워버려서, 정작 체크박스에는 복원이 반영되지 않는 문제가 있었다.
            if (activeFilePaths.length > 0) {
              setSelectedFiles([]);
              setRestoreRequest({ paths: activeFilePaths, autoStart: false });
            }
          }}
          label="학습 종료하기"
          extraAction={!done && words.length > 1 ? { label: "단어 순서 섞기", onClick: shuffleRemaining } : undefined}
        />
      </FocusScreen>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader
        icon="학"
        accent="var(--accent)"
        title="학습 파트"
        subtitle="단어를 순서대로 넘기며 훑어보는 1회독입니다."
      />
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
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

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} restorePaths={restoreRequest?.paths ?? null} />
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

      <SessionInfoPanel
        userId={userId}
        ready={ready}
        part="study"
        selectedFiles={selectedFiles}
        onRestore={(paths) => setRestoreRequest({ paths, autoStart: true })}
      />
    </div>
  );
}
