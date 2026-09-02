"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
import SpeakButton from "@/components/SpeakButton";
import MemoPad from "@/components/MemoPad";
import HintText from "@/components/HintText";
import FontSizeControl from "@/components/FontSizeControl";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserId } from "@/hooks/useUserId";
import { useFontScale } from "@/hooks/useFontScale";
import { fetchWords } from "@/lib/api";
import { shuffle, wordKey } from "@/lib/queue";
import { deleteProgress, loadProgress, saveProgress } from "@/lib/progress";
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
  // 끝까지 안 보고 나간 단어 목록/위치를 그대로 이어볼 수 있게 저장해둔다. 이게 없으면
  // "이 학습 다시 하기"가 단어 목록을 새로 불러와 처음(0)부터 다시 시작해서, 예전에
  // 어디까지 봤는지가 사라진 것처럼 보이는 문제가 있었다.
  const [saved, setSaved] = useState<StudyProgress | null>(null);

  const [words, setWords] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilePaths, setActiveFilePaths] = useState<string[]>([]);
  const [activeFileLabels, setActiveFileLabels] = useState<string[]>([]);
  const { fontScale, setFontScale, adjustFontScale } = useFontScale("word_app_study_font_scale", "--study-font-scale");

  useEffect(() => {
    if (!ready || !userId) return;
    loadFavoriteKeys(userId).then(setFavorites);
  }, [ready, userId]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadProgress<StudyProgress>(userId, "study").then((p) => {
      if (p && p.words?.length) setSaved(p);
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

  // 저장된 단어 목록/위치를 그대로(다시 섞지 않고) 복원한다 — begin()과 달리 단어
  // 목록을 새로 받아오지 않는다.
  function resume() {
    if (!saved) return;
    setWords(saved.words);
    setIndex(saved.studyIndex);
    setShowHint(false);
    setActiveFilePaths(saved.filePaths);
    setActiveFileLabels(saved.filesLabel);
    setFocus(true);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const revealHint = () => {
    if (words[index]?.hint.trim()) setShowHint(true);
  };
  useKeyboardShortcuts(
    {
      ArrowRight: () => next(),
      ArrowLeft: () => prev(),
      // h는 한글/일본어 자판일 때 e.key가 "h"로 안 잡혀서 안 먹힐 수 있다 — KeyH(물리
      // 키 코드, 자판과 무관)와 Space를 대안으로 추가해 항상 힌트를 열 수 있게 한다.
      h: revealHint,
      KeyH: revealHint,
      " ": revealHint,
    },
    focus && !done
  );

  if (focus) {
    const current = words[index];
    return (
      <FocusScreen
        top={
          <>
            <MemoPad />
            {!done && current && (
              <>
                <ProgressBar ratio={index / Math.max(1, words.length)} />
                <div className="mt-2 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  {index + 1} / {words.length}
                </div>
              </>
            )}
          </>
        }
        actions={
          !done && current ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={prev} disabled={index === 0} className="btn-3d btn-ghost text-sm">
                이전
                <KeyBadge>←</KeyBadge>
              </button>
              <motion.button
                key={index}
                onClick={() => setShowHint(true)}
                disabled={!current.hint.trim()}
                className="btn-3d btn-amber text-sm"
                animate={!showHint && current.hint.trim() ? { y: [0, -9, 0] } : undefined}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
              >
                힌트
                <KeyBadge>H/Space</KeyBadge>
              </motion.button>
              <button onClick={next} className="btn-3d btn-accent text-sm">
                다음
                <KeyBadge>→</KeyBadge>
              </button>
            </div>
          ) : undefined
        }
      >
        {!done && current ? (
          <>
            <div className="mt-3 flex justify-end">
              <FontSizeControl fontScale={fontScale} onAdjust={adjustFontScale} onReset={() => setFontScale(1)} />
            </div>
            <div className="study-card mt-1.5 p-8 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="text-center font-extrabold" style={{ color: "var(--blue)", fontSize: "calc(1.5rem * var(--study-font-scale, 1))" }}>
                  {current.word}
                </div>
                <SpeakButton text={current.word} compact />
                <button onClick={() => toggleFavorite(current)} className="text-lg" aria-label="즐겨찾기">
                  {favorites.has(wordKey(current)) ? "★" : "☆"}
                </button>
              </div>
              <div className="text-center font-semibold" style={{ fontSize: "calc(1.125rem * var(--study-font-scale, 1))" }}>
                {current.meaning}
              </div>
              {showHint && current.hint.trim() && (
                <div
                  className="hint-reveal w-full max-h-[42vh] overflow-y-auto rounded-xl px-4 py-3 leading-relaxed whitespace-pre-line"
                  style={{ background: "var(--hint-bg)", color: "var(--text-muted)", fontSize: "calc(0.875rem * var(--study-font-scale, 1))" }}
                >
                  <HintText text={current.hint} />
                </div>
              )}
            </div>
          </>
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
              // 아직 다 못 본 채로 나가는 거면, 방금까지 본 위치를 그대로 "이어서
              // 학습하기" 카드에 반영해서 다음에 정확히 이어볼 수 있게 한다.
              if (!done) {
                setSaved({
                  words,
                  filesLabel: activeFileLabels,
                  filePaths: activeFilePaths,
                  studyIndex: index,
                });
              }
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
        단축키: ←/→=이전/다음 단어 · H/Space=힌트 보기
      </p>

      {ready && !userId && (
        <div
          className="mt-3 rounded-xl px-4 py-3 text-sm font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent-dark)", border: "1.5px solid var(--accent)" }}
        >
          💾{" "}
          <Link href="/more/settings" className="underline">
            내 번호
          </Link>
          를 설정하면 학습 진행 상황이 기기 간에 저장됩니다.
        </div>
      )}

      {saved && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">
            저장된 학습 진행이 있습니다: {fileSummaryOf(saved.filesLabel)} · {saved.studyIndex} / {saved.words.length}
          </div>
          <button onClick={resume} className="btn-3d btn-blue mt-3 w-full">
            이어서 학습하기
          </button>
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
        onRestore={(paths) => {
          // "이 학습 다시 하기"가 지금 이어서 볼 수 있는 저장된 진행(saved)과 정확히 같은
          // 파일 조합을 가리키면, 처음부터 다시 시작하는 대신 그 위치를 그대로 이어간다.
          if (saved && fileKeyOf(saved.filePaths) === fileKeyOf(paths)) {
            resume();
            return;
          }
          setRestoreRequest({ paths, autoStart: true });
        }}
      />
    </div>
  );
}
