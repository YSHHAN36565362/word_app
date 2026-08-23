"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FileSelector from "@/components/FileSelector";
import ExitFocusButton from "@/components/ExitFocusButton";
import FocusScreen from "@/components/FocusScreen";
import ProgressBar from "@/components/ProgressBar";
import FlashCard from "@/components/FlashCard";
import KeyBadge from "@/components/KeyBadge";
import Mascot, { MascotState } from "@/components/Mascot";
import Spinner from "@/components/Spinner";
import SessionInfoPanel from "@/components/SessionInfoPanel";
import PageHeader from "@/components/PageHeader";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserId } from "@/hooks/useUserId";
import { fetchWords } from "@/lib/api";
import { getDisplaySide, requeuePosition, shuffle, wordKey } from "@/lib/queue";
import { appendStudyStat, deleteProgress, loadWrongNotes, saveProgress } from "@/lib/progress";
import { loadAllMastery, prioritizeByMastery, saveWordMastery } from "@/lib/mastery";
import { fileKeyOf, fileSummaryOf, upsertLearningLog } from "@/lib/learningLog";
import { addFavorite, loadFavoriteKeys, loadFavorites, removeFavorite } from "@/lib/favorites";
import { FileRef, PracticeProgress, StudyMode, WordEntry } from "@/lib/types";

const WRONG_NOTES_PATH_KEY = "__wrong_notes__";
const FAVORITES_PATH_KEY = "__favorites__";

interface RestoreRequest {
  paths: string[];
  mode: StudyMode;
}

function isStudyMode(v: string | null): v is StudyMode {
  return v === "word_only" || v === "meaning_only" || v === "random";
}

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticePageInner />
    </Suspense>
  );
}

function PracticePageInner() {
  const { focus, setFocus } = useFocusMode();
  const { userId, ready } = useUserId();
  const searchParams = useSearchParams();
  const fromWrongNotes = searchParams.get("from") === "wrongnotes";
  const fromFavorites = searchParams.get("from") === "favorites";

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequest | null>(null);
  const [starting, setStarting] = useState(false);

  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [current, setCurrent] = useState<WordEntry | null>(null);
  const [mode, setMode] = useState<StudyMode>("random");
  const [displaySide, setDisplaySide] = useState<0 | 1>(0);
  const [total, setTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [resultSaved, setResultSaved] = useState(false);
  const [filesLabel, setFilesLabel] = useState<string[]>([]);
  const [activeFilePaths, setActiveFilePaths] = useState<string[]>([]);
  // 단어가 바뀔 때마다 1씩 늘려서 FlashCard의 key로 쓴다. 뒤집기(showAnswer)를 false로
  // 되돌리는 것과 카드 내용을 새 단어로 바꾸는 것이 "같은 렌더"에서 같이 일어나면,
  // 뒤집는 CSS 애니메이션이 절반쯤 진행된 상태에서 뒷면 내용만 먼저 새 단어로 바뀌어
  // 잠깐 다음 단어의 정답이 보였다 사라지는 문제가 있었다. key를 바꿔 카드를 완전히
  // 새로 마운트하면 전환 애니메이션 없이 바로 앞면(새 단어)으로 나타나 이 문제가 없다.
  const [turnId, setTurnId] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready || !userId) return;
    loadFavoriteKeys(userId).then(setFavorites);
  }, [ready, userId]);

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

  function persist(next: { queue: WordEntry[]; current: WordEntry | null; total: number; done: number; side: 0 | 1; m: StudyMode; labels: string[]; paths: string[] }) {
    if (!userId) return;
    saveProgress(userId, "practice", {
      filesLabel: next.labels,
      filePaths: next.paths,
      mode: next.m,
      queue: next.queue,
      currentWord: next.current,
      displaySide: next.side,
      totalCount: next.total,
      doneCount: next.done,
    } as PracticeProgress);
    upsertLearningLog(userId, "practice", next.paths, fileSummaryOf(next.labels), next.total, next.done, next.m);
  }

  function startWithList(list: WordEntry[], mastery: Map<string, number>, selectedMode: StudyMode, labels: string[], paths: string[]) {
    if (list.length === 0) return;
    const shuffled = shuffle(list);
    const pool = mastery.size > 0 ? prioritizeByMastery(shuffled, mastery) : shuffled;
    const q = [...pool];
    const first = q.shift() ?? null;
    const side = getDisplaySide(selectedMode);

    setMode(selectedMode);
    setQueue(q);
    setCurrent(first);
    setTotal(pool.length);
    setDoneCount(0);
    setDisplaySide(side);
    setShowAnswer(false);
    setShowHint(false);
    setResultSaved(false);
    setMascotState("idle");
    setFilesLabel(labels);
    setActiveFilePaths(paths);
    setTurnId((t) => t + 1);
    setFocus(true);

    persist({ queue: q, current: first, total: pool.length, done: 0, side, m: selectedMode, labels, paths });
  }

  async function begin(selectedMode: StudyMode) {
    if (selectedFiles.length === 0) return;
    setStarting(true);
    const paths = selectedFiles.map((f) => f.path);
    const labels = selectedFiles.map((f) => f.label);
    // 단어 목록(GitHub)과 숙련도 기록(Supabase)은 서로 무관한 데이터라 동시에 요청한다.
    // 이전에는 단어 목록을 다 받은 "다음에야" 숙련도를 조회해서(waterfall) 그만큼 더
    // 느렸다 — 이게 최근 체감 지연의 주요 원인이었다.
    const [list, mastery] = await Promise.all([fetchWords(paths), userId ? loadAllMastery(userId) : Promise.resolve(new Map<string, number>())]);
    startWithList(list, mastery, selectedMode, labels, paths);
    setStarting(false);
  }

  // [이 학습 다시 하기]로 복원 요청이 들어오면, FileSelector가 그 파일들을 실제
  // 체크박스 선택(selectedFiles)으로 반영할 때까지 기다렸다가 저장돼 있던 모드로
  // 자동으로 연습을 시작한다. (기록에 있던 파일이 GitHub에서 지워졌다면 완전히 같은
  // 조합이 되지 않을 수 있어 fileKey가 정확히 일치할 때만 시작한다.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restoreRequest || selectedFiles.length === 0) return;
    const selectedKey = fileKeyOf(selectedFiles.map((f) => f.path));
    const targetKey = fileKeyOf(restoreRequest.paths);
    if (selectedKey !== targetKey) return;
    const modeToStart = restoreRequest.mode;
    setRestoreRequest(null);
    begin(modeToStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, restoreRequest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function beginFromWrongNotes() {
    if (!userId) return;
    setStarting(true);
    const [list, mastery] = await Promise.all([loadWrongNotes(userId), loadAllMastery(userId)]);
    startWithList(list, mastery, "random", ["오답 노트"], [WRONG_NOTES_PATH_KEY]);
    setStarting(false);
  }

  async function beginFromFavorites() {
    if (!userId) return;
    setStarting(true);
    const [list, mastery] = await Promise.all([loadFavorites(userId), loadAllMastery(userId)]);
    startWithList(list, mastery, "random", ["즐겨찾기"], [FAVORITES_PATH_KEY]);
    setStarting(false);
  }

  // 아직 채점 안 한 대기열의 순서만 다시 섞는다(현재 보여주고 있는 단어는 그대로 둔다).
  // 같은 조합을 여러 번 반복하다 보면 내용이 아니라 "다음에 뭐가 나올지" 순서로
  // 외워버릴 수 있어서, 진행 중에도 원하면 순서를 바꿀 수 있게 한다.
  function shuffleQueue() {
    setQueue((prev) => {
      const next = shuffle(prev);
      persist({ queue: next, current, total, done: doneCount, side: displaySide, m: mode, labels: filesLabel, paths: activeFilePaths });
      return next;
    });
  }

  function revealAnswer() {
    setShowAnswer(true);
    if (current?.hint.trim()) setShowHint(true);
  }

  function score(level: 100 | 60 | 40 | 0) {
    if (!current) return;
    const nextQueue = [...queue];
    let nextDone = doneCount;
    if (level !== 100) {
      const pos = requeuePosition(nextQueue.length, level);
      nextQueue.splice(pos, 0, current);
    } else {
      nextDone += 1;
    }
    const nextCurrent = nextQueue.length > 0 ? nextQueue.shift()! : null;
    const nextSide = getDisplaySide(mode);

    setMascotState(level >= 60 ? "correct" : "wrong");
    setQueue(nextQueue);
    setCurrent(nextCurrent ?? null);
    setDoneCount(nextDone);
    setDisplaySide(nextSide);
    setShowAnswer(false);
    setShowHint(false);
    setTurnId((t) => t + 1);

    persist({ queue: nextQueue, current: nextCurrent, total, done: nextDone, side: nextSide, m: mode, labels: filesLabel, paths: activeFilePaths });
    if (userId) saveWordMastery(userId, current, level);
  }

  const finished = focus && current === null && queue.length === 0 && total > 0;

  useEffect(() => {
    if (finished && userId && !resultSaved) {
      // 완료 시점에 통계 저장을 1회만 수행하기 위한 가드. 외부 저장소(Supabase) 호출을
      // 트리거하는 부수효과이므로 useEffect가 맞는 자리다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultSaved(true);
      appendStudyStat(userId, "practice", total, total);
      deleteProgress(userId, "practice");
    }
  }, [finished, userId, resultSaved, total]);

  useKeyboardShortcuts(
    {
      " ": () => { if (!showAnswer) revealAnswer(); },
      Enter: () => { if (!showAnswer) revealAnswer(); },
      "1": () => { if (showAnswer) score(0); },
      "2": () => { if (showAnswer) score(40); },
      "3": () => { if (showAnswer) score(60); },
      "4": () => { if (showAnswer) score(100); },
      ArrowLeft: () => { if (showAnswer) score(0); },
      ArrowDown: () => { if (showAnswer) score(40); },
      ArrowUp: () => { if (showAnswer) score(60); },
      ArrowRight: () => { if (showAnswer) score(100); },
    },
    focus && !finished && current !== null
  );

  if (focus) {
    const qText = current ? (displaySide === 0 ? current.word : current.meaning) : "";
    const aText = current ? (displaySide === 0 ? current.meaning : current.word) : "";

    return (
      <FocusScreen
        top={
          !finished && current ? (
            <>
              <ProgressBar ratio={doneCount / Math.max(1, total)} />
              <div className="mt-2 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                <span>완료 {doneCount} / {total}</span>
                <span>남은 큐 {queue.length + 1}개</span>
              </div>
              <div className="mt-4 flex justify-center">
                <Mascot state={mascotState} reactionKey={turnId} />
              </div>
            </>
          ) : null
        }
        actions={
          !finished && current ? (
            !showAnswer ? (
              <button onClick={revealAnswer} className="btn-3d btn-blue w-full">
                정답 확인
                <KeyBadge>Space</KeyBadge>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => score(100)} className="btn-3d btn-accent">
                  완벽함 (100)
                  <KeyBadge>4 / →</KeyBadge>
                </button>
                <button onClick={() => score(60)} className="btn-3d btn-blue">
                  조금 앎 (60)
                  <KeyBadge>3 / ↑</KeyBadge>
                </button>
                <button onClick={() => score(40)} className="btn-3d btn-amber">
                  헷갈림 (40)
                  <KeyBadge>2 / ↓</KeyBadge>
                </button>
                <button onClick={() => score(0)} className="btn-3d btn-red">
                  모름 (0)
                  <KeyBadge>1 / ←</KeyBadge>
                </button>
              </div>
            )
          ) : undefined
        }
      >
        {!finished && current ? (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-end">
              <button onClick={() => toggleFavorite(current)} className="text-lg" aria-label="즐겨찾기">
                {favorites.has(wordKey(current)) ? "★" : "☆"}
              </button>
            </div>
            <FlashCard
              key={turnId}
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
                  {showHint && current.hint.trim() && (
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
        ) : (
          <div className="study-card mt-10 p-8 text-center">
            <div className="flex justify-center mb-3">
              <Mascot state="correct" />
            </div>
            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
              대기열의 모든 연습을 완료했습니다.
            </div>
          </div>
        )}
        <ExitFocusButton
          onExit={() => {}}
          label="연습 종료하기"
          extraAction={!finished && queue.length > 1 ? { label: "단어 순서 섞기", onClick: shuffleQueue } : undefined}
        />
      </FocusScreen>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader
        icon="연"
        accent="var(--blue)"
        title="연습 파트"
        subtitle="망각 곡선 큐 적용. 4단계로 스스로 채점하면 모르는 단어일수록 더 빨리 다시 만납니다."
      />
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        단축키: Space/Enter=정답 확인 · 1~4 또는 방향키(←↓↑→)=모름/헷갈림/조금앎/완벽함
      </p>

      {ready && !userId && (
        <div className="mt-3 rounded-xl px-4 py-2.5 text-xs" style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}>
          <Link href="/more/settings" className="font-bold underline">
            내 번호
          </Link>
          를 설정하면 연습 진행 상황이 기기 간에 저장됩니다.
        </div>
      )}

      {fromWrongNotes && userId && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">오답 노트에 있는 단어로 바로 연습을 시작합니다.</div>
          <button onClick={beginFromWrongNotes} disabled={starting} className="btn-3d btn-red mt-3 w-full">
            {starting ? (
              <>
                <Spinner size={16} className="mr-2" />
                불러오는 중...
              </>
            ) : (
              "오답 노트로 연습 시작"
            )}
          </button>
        </div>
      )}

      {fromFavorites && userId && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">즐겨찾기한 단어로 바로 연습을 시작합니다.</div>
          <button onClick={beginFromFavorites} disabled={starting} className="btn-3d btn-amber mt-3 w-full">
            {starting ? (
              <>
                <Spinner size={16} className="mr-2" />
                불러오는 중...
              </>
            ) : (
              "즐겨찾기로 연습 시작"
            )}
          </button>
        </div>
      )}

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} restorePaths={restoreRequest?.paths ?? null} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <button onClick={() => begin("word_only")} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent text-sm">
          {starting ? <Spinner size={14} /> : "이름만"}
        </button>
        <button onClick={() => begin("meaning_only")} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent text-sm">
          {starting ? <Spinner size={14} /> : "뜻만"}
        </button>
        <button onClick={() => begin("random")} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent text-sm">
          {starting ? <Spinner size={14} /> : "랜덤"}
        </button>
      </div>

      <SessionInfoPanel
        userId={userId}
        ready={ready}
        part="practice"
        selectedFiles={selectedFiles}
        onRestore={(paths, mode) => setRestoreRequest({ paths, mode: isStudyMode(mode) ? mode : "random" })}
      />
    </div>
  );
}
