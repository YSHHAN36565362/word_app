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
import Confetti from "@/components/Confetti";
import FeedbackFlash from "@/components/FeedbackFlash";
import SpeakButton from "@/components/SpeakButton";
import MemoPad from "@/components/MemoPad";
import HintText from "@/components/HintText";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserId } from "@/hooks/useUserId";
import { fetchWords } from "@/lib/api";
import { getDisplaySide, requeuePosition, ROUND_SIZE, shuffle, wordKey } from "@/lib/queue";
import { appendStudyStat, deleteProgress, loadProgress, loadWrongNotes, saveProgress } from "@/lib/progress";
import { computeNextMastery, loadAllMastery, loadDueReviewWords, loadMasteredWords, MasteryInfo, prioritizeByMastery, saveWordMastery } from "@/lib/mastery";
import { fileKeyOf, fileSummaryOf, upsertLearningLog } from "@/lib/learningLog";
import { addFavorite, loadFavoriteKeys, loadFavorites, removeFavorite } from "@/lib/favorites";
import { FileRef, isItSelection, PracticeProgress, StudyMode, WordEntry } from "@/lib/types";

const WRONG_NOTES_PATH_KEY = "__wrong_notes__";
const FAVORITES_PATH_KEY = "__favorites__";
const REVIEW_PATH_KEY = "__review__";
const DUE_REVIEW_PATH_KEY = "__due_review__";
// 마이크로 러닝: 한 번에 몰아서 외우게 하지 않고 ROUND_SIZE(queue.ts) 단위 "라운드"로
// 쪼갠다. 라운드를 마칠 때마다 짧은 결과 화면을 보여줘서 큰 대기열(수백 개) 앞에서도
// 매번 작은 목표만 보게 한다. requeuePosition도 이 라운드 크기를 기준으로 모름/헷갈림을
// 몇 라운드 뒤에 다시 보여줄지 정하므로, 값 자체는 queue.ts에서 가져와 공유한다.
// 이 이상 헷갈림/모름으로 채점된 단어는 "자주 틀리는 단어" 배지를 붙인다.
const FREQUENTLY_WRONG_THRESHOLD = 3;

interface RestoreRequest {
  paths: string[];
  mode: StudyMode;
  /** true면 체크박스 복원 후 자동으로 연습을 시작한다. false면 체크박스/대시보드만 맞춰준다. */
  autoStart: boolean;
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
  const fromReview = searchParams.get("from") === "review";
  const fromDueReview = searchParams.get("from") === "due";

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequest | null>(null);
  const [starting, setStarting] = useState(false);
  // 완전히 끝내지 않고 나간 큐/완료 개수를 그대로 이어서 볼 수 있게 저장해둔다. 이게
  // 없으면 "이 학습 다시 하기"가 큐를 처음부터 다시 섞고 완료 개수를 0부터 시작해서,
  // 예전에 쌓아둔 완료 개수가 사라진 것처럼 보이는 문제가 있었다 — 시험 파트는 이미
  // 이 방식(saved/resume)으로 정확히 이어하기가 되고 있어서 그 패턴을 그대로 따른다.
  const [saved, setSaved] = useState<PracticeProgress | null>(null);

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
  const [flashKey, setFlashKey] = useState(0);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  // 단어별 숙련도(점수·틀린 횟수·SRS 간격)를 세션 내내 들고 있는다 — "자주 틀리는 단어"
  // 배지가 채점 즉시 반영되게 하려면 서버 응답을 기다리지 않고 로컬에서도 갱신해야 한다.
  const [mastery, setMastery] = useState<Map<string, MasteryInfo>>(new Map());
  // 라운드(15개) 하나를 다 채웠을 때 true — 다음 카드 대신 짧은 라운드 완료 화면을 보여준다.
  const [roundGateOpen, setRoundGateOpen] = useState(false);
  // 마스코트 일러스트가 무겁게 느껴지는 사람을 위한 끄기 스위치. 기기마다 다르게
  // 켜둘 수 있어서(계정이 아니라) localStorage에만 저장한다 — ThemeContext와 같은
  // 이유로, SSR과 hydration이 어긋나지 않게 기본값 false로 먼저 그린 뒤 마운트 후
  // 저장된 값으로 갱신한다.
  // 주의: 마운트 복원 effect와 "값이 바뀔 때마다 저장" effect를 따로 두면, 개발 모드의
  // React StrictMode가 마운트 effect를 두 번 실행하면서 "복원되기 전(기본값)"의 값을
  // 저장 effect가 먼저 storage에 덮어써 버려 복원 자체가 무효화되는 경우가 있었다
  // (실제로 재현됨). 그래서 저장은 항상 "값을 바꾸는 시점"(토글/버튼 클릭)에 그 자리에서
  // 하고, 마운트 effect는 상태만 복원할 뿐 storage에 다시 쓰지 않는다.
  const [hideMascot, setHideMascotState] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (window.localStorage.getItem("word_app_practice_hide_mascot") === "1") setHideMascotState(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setHideMascot(next: boolean) {
    setHideMascotState(next);
    window.localStorage.setItem("word_app_practice_hide_mascot", next ? "1" : "0");
  }

  // 데스크탑/노트북에서는 브라우저 확대 없이는 한자·설명 글씨가 작게 느껴진다는
  // 피드백이 있어서 카드 글자 크기를 사용자가 직접 조절할 수 있게 한다. "그 세션
  // 동안"만 유지하면 되므로(기기마다 새로 정하면 됨) sessionStorage에 저장한다 —
  // 탭을 닫으면 초기화되고, 같은 탭 안에서 새로고침하거나 다른 파트로 갔다와도 유지된다.
  // (저장 시점을 값이 바뀌는 자리로 두는 이유는 위 hideMascot 주석과 동일.)
  const FONT_SCALE_MIN = 0.8;
  const FONT_SCALE_MAX = 1.8;
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = Number(window.sessionStorage.getItem("word_app_practice_font_scale"));
    if (stored >= FONT_SCALE_MIN && stored <= FONT_SCALE_MAX) {
      setFontScaleState(stored);
      document.documentElement.style.setProperty("--practice-font-scale", String(stored));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setFontScale(next: number) {
    setFontScaleState(next);
    window.sessionStorage.setItem("word_app_practice_font_scale", String(next));
    document.documentElement.style.setProperty("--practice-font-scale", String(next));
  }

  function adjustFontScale(delta: number) {
    setFontScale(Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, fontScale + delta)) * 10) / 10);
  }

  useEffect(() => {
    if (!ready || !userId) return;
    loadFavoriteKeys(userId).then(setFavorites);
  }, [ready, userId]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadAllMastery(userId).then(setMastery);
  }, [ready, userId]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadProgress<PracticeProgress>(userId, "practice").then((p) => {
      if (p && (p.queue?.length || p.currentWord)) setSaved(p);
    });
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

  function startWithList(list: WordEntry[], mastery: Map<string, MasteryInfo>, selectedMode: StudyMode, labels: string[], paths: string[]) {
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
    setMastery(mastery);
    setRoundGateOpen(false);
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
    const [list, mastery] = await Promise.all([
      fetchWords(paths),
      userId ? loadAllMastery(userId) : Promise.resolve(new Map<string, MasteryInfo>()),
    ]);
    startWithList(list, mastery, selectedMode, labels, paths);
    setStarting(false);
  }

  // 저장된 큐를 그대로(다시 섞지 않고, 완료 개수도 그대로) 복원한다 — begin()과 달리
  // 단어 목록을 새로 받아오지 않는다.
  function resume() {
    if (!saved) return;
    setMode(saved.mode);
    setQueue(saved.queue);
    setCurrent(saved.currentWord);
    setTotal(saved.totalCount);
    setDoneCount(saved.doneCount);
    setDisplaySide(saved.displaySide);
    setShowAnswer(false);
    setShowHint(false);
    setResultSaved(false);
    setMascotState("idle");
    setFilesLabel(saved.filesLabel);
    setActiveFilePaths(saved.filePaths);
    setTurnId((t) => t + 1);
    setRoundGateOpen(false);
    setFocus(true);
  }

  // 복원 요청이 들어오면, FileSelector가 그 파일들을 실제 체크박스 선택(selectedFiles)으로
  // 반영할 때까지 기다린다. [이 학습 다시 하기]처럼 autoStart가 true면 저장돼 있던
  // 모드로 그대로 연습을 시작하고, 연습을 마치고 나왔을 때처럼 false면 체크박스와
  // 대시보드만 방금 연습한 파일 조합으로 맞춰서 "진행 상황이 저장됐다"는 게 바로
  // 보이게만 한다. (기록에 있던 파일이 GitHub에서 지워졌다면 완전히 같은 조합이 되지
  // 않을 수 있어 fileKey가 정확히 일치할 때만 처리한다.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restoreRequest || selectedFiles.length === 0) return;
    const selectedKey = fileKeyOf(selectedFiles.map((f) => f.path));
    const targetKey = fileKeyOf(restoreRequest.paths);
    if (selectedKey !== targetKey) return;
    const { mode: modeToStart, autoStart } = restoreRequest;
    setRestoreRequest(null);
    if (autoStart) begin(modeToStart);
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

  async function beginFromReview() {
    if (!userId) return;
    setStarting(true);
    const [list, mastery] = await Promise.all([loadMasteredWords(userId), loadAllMastery(userId)]);
    startWithList(list, mastery, "random", ["복습"], [REVIEW_PATH_KEY]);
    setStarting(false);
  }

  // 간격 반복(SRS) 주기가 다 돼서 오늘 다시 볼 때가 된 단어만 골라 시작한다.
  async function beginFromDueReview() {
    if (!userId) return;
    setStarting(true);
    const [list, mastery] = await Promise.all([loadDueReviewWords(userId), loadAllMastery(userId)]);
    startWithList(list, mastery, "random", ["오늘의 복습"], [DUE_REVIEW_PATH_KEY]);
    setStarting(false);
  }

  // 아직 채점 안 한 대기열의 순서만 다시 섞는다(현재 보여주고 있는 단어는 그대로 둔다).
  // 같은 조합을 여러 번 반복하다 보면 내용이 아니라 "다음에 뭐가 나올지" 순서로
  // 외워버릴 수 있어서, 진행 중에도 원하면 순서를 바꿀 수 있게 한다.
  function shuffleQueue() {
    // 이제 큐 순서 자체가 "모름은 이번 라운드 안에, 헷갈림은 몇 라운드 뒤에" 같은
    // 의미를 담고 있어서, 섞으면 그 순서(스택)가 흐트러진다 — 실수로 누르지 않도록
    // 확인을 한 번 받는다.
    if (!window.confirm("단어를 섞으시겠습니까?\n모름/헷갈림 단어가 다시 나올 순서가 흐트러질 수 있어요.")) return;
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
    // 완벽함(100)·조금 앎(60)은 큐에서 빼고 완료로 친다. 헷갈림(40)·모름(0)만 다시 꽂는다.
    if (level < 60) {
      const pos = requeuePosition(nextQueue.length, level as 40 | 0);
      nextQueue.splice(pos, 0, current);
    } else {
      nextDone += 1;
    }
    const nextCurrent = nextQueue.length > 0 ? nextQueue.shift()! : null;
    const nextSide = getDisplaySide(mode);
    // 15개짜리 라운드를 막 채웠고(전에는 아니었고) 아직 큐에 남은 게 있으면, 다음 카드로
    // 바로 넘어가는 대신 짧은 라운드 완료 화면을 한 번 보여준다.
    const crossedRound = nextDone > doneCount && nextDone % ROUND_SIZE === 0 && (nextQueue.length > 0 || nextCurrent !== null);

    const key = wordKey(current);
    const nextInfo = computeNextMastery(mastery.get(key), level);

    setMascotState(level >= 60 ? "correct" : "wrong");
    setQueue(nextQueue);
    setCurrent(nextCurrent ?? null);
    setDoneCount(nextDone);
    setDisplaySide(nextSide);
    setShowAnswer(false);
    setShowHint(false);
    setTurnId((t) => t + 1);
    setFlashColor(level >= 60 ? "var(--accent)" : "var(--red)");
    setFlashKey((k) => k + 1);
    setMastery((m) => {
      const next = new Map(m);
      next.set(key, nextInfo);
      return next;
    });
    if (crossedRound) setRoundGateOpen(true);

    persist({ queue: nextQueue, current: nextCurrent, total, done: nextDone, side: nextSide, m: mode, labels: filesLabel, paths: activeFilePaths });
    if (userId) saveWordMastery(userId, current, nextInfo);
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
      setSaved(null);
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
      // 방향키: 위=완벽함, 아래=모름, 왼쪽=조금 앎, 오른쪽=헷갈림.
      ArrowUp: () => { if (showAnswer) score(100); },
      ArrowDown: () => { if (showAnswer) score(0); },
      ArrowLeft: () => { if (showAnswer) score(60); },
      ArrowRight: () => { if (showAnswer) score(40); },
      // WASD도 방향키와 같은 배치(W=위, S=아래, A=왼쪽, D=오른쪽).
      w: () => { if (showAnswer) score(100); },
      s: () => { if (showAnswer) score(0); },
      a: () => { if (showAnswer) score(60); },
      d: () => { if (showAnswer) score(40); },
      // 오른쪽 숫자 키패드(8/2/4/6)도 같은 배치 — code로 매칭해서 NumLock 상태와
      // 무관하게 항상 동작하고, 최상단 숫자키(1~4) 배정과도 충돌하지 않는다.
      Numpad8: () => { if (showAnswer) score(100); },
      Numpad2: () => { if (showAnswer) score(0); },
      Numpad4: () => { if (showAnswer) score(60); },
      Numpad6: () => { if (showAnswer) score(40); },
    },
    // 라운드 완료 화면이 떠 있는 동안은 카드가 안 보이므로 단축키도 꺼둔다 — 안 그러면
    // "정답 확인"/채점 키를 눌렀을 때 화면에 없는 다음 라운드 첫 단어가 몰래 넘어간다.
    focus && !finished && current !== null && !roundGateOpen
  );

  if (focus) {
    const qText = current ? (displaySide === 0 ? current.word : current.meaning) : "";
    const aText = current ? (displaySide === 0 ? current.meaning : current.word) : "";
    const wrongCount = current ? mastery.get(wordKey(current))?.wrongCount ?? 0 : 0;
    const roundSize = Math.min(ROUND_SIZE, total || ROUND_SIZE);
    // doneCount가 라운드 크기의 정확한 배수인 순간은 두 가지 의미가 있다: 라운드 완료
    // 화면이 떠 있는 동안은 "방금 끝난 라운드가 꽉 찼다"(가득 찬 바), 그 화면을 닫고
    // 다음 라운드로 넘어간 뒤에는 "새 라운드에서 아직 아무것도 안 했다"(빈 바)는 뜻이라
    // roundGateOpen 여부로 둘을 구분한다.
    const atRoundBoundary = doneCount > 0 && doneCount % roundSize === 0;
    const posInRound = atRoundBoundary && !roundGateOpen ? 0 : doneCount === 0 ? 0 : ((doneCount - 1) % roundSize) + 1;
    const roundRatio = roundSize > 0 ? posInRound / roundSize : 0;

    return (
      <FocusScreen
        top={
          <>
            <MemoPad />
            <FeedbackFlash flashKey={flashKey} color={flashColor} />
            {!finished && current && (
              <>
                <label className="flex items-center justify-end gap-1.5 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={hideMascot}
                    onChange={(e) => setHideMascot(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  애니메이션 끄기
                </label>
                <ProgressBar ratio={roundRatio} />
                <div className="mt-2 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  <span>이번 라운드 {posInRound} / {roundSize}</span>
                  <span>전체 {doneCount} / {total}</span>
                </div>
                {!roundGateOpen && !hideMascot && (
                  <div className="mt-4 flex justify-center">
                    <Mascot state={mascotState} reactionKey={turnId} />
                  </div>
                )}
              </>
            )}
          </>
        }
        actions={
          !finished && current && !roundGateOpen ? (
            !showAnswer ? (
              <button onClick={revealAnswer} className="btn-3d btn-blue w-full">
                정답 확인
                <KeyBadge>Space</KeyBadge>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => score(100)} className="btn-3d btn-accent">
                  완벽함 (100 · 7일 후)
                  <KeyBadge>4 · ↑ · W · Num8</KeyBadge>
                </button>
                <button onClick={() => score(60)} className="btn-3d btn-blue">
                  조금 앎 (60 · 3일 후)
                  <KeyBadge>3 · ← · A · Num4</KeyBadge>
                </button>
                <button onClick={() => score(40)} className="btn-3d btn-amber">
                  헷갈림 (40 · 잠시 후 다시)
                  <KeyBadge>2 · → · D · Num6</KeyBadge>
                </button>
                <button onClick={() => score(0)} className="btn-3d btn-red">
                  모름 (0 · 곧 다시)
                  <KeyBadge>1 · ↓ · S · Num2</KeyBadge>
                </button>
              </div>
            )
          ) : undefined
        }
      >
        {!finished && current && roundGateOpen ? (
          <div className="study-card relative mt-8 p-8 text-center">
            <Confetti />
            <div className="flex justify-center mb-3">
              <Mascot state="correct" />
            </div>
            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
              {roundSize}개 라운드 완료!
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              전체 {doneCount} / {total} · {queue.length + 1}개 남음
            </div>
            <button onClick={() => setRoundGateOpen(false)} className="btn-3d btn-accent mt-4 w-full">
              다음 라운드 계속하기
            </button>
          </div>
        ) : !finished && current ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-end gap-1.5">
              <div className="flex items-center gap-1 mr-1">
                <button
                  onClick={() => adjustFontScale(-0.1)}
                  disabled={fontScale <= FONT_SCALE_MIN}
                  aria-label="글자 작게"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold disabled:opacity-40"
                  style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
                >
                  −
                </button>
                <span className="w-8 text-center text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
                  {Math.round(fontScale * 100)}%
                </span>
                <button
                  onClick={() => adjustFontScale(0.1)}
                  disabled={fontScale >= FONT_SCALE_MAX}
                  aria-label="글자 크게"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold disabled:opacity-40"
                  style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
                >
                  +
                </button>
                <button
                  onClick={() => setFontScale(1)}
                  aria-label="글자 크기 기본값"
                  className="flex h-6 items-center justify-center rounded-full px-2 text-[11px] font-bold"
                  style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
                >
                  기본값
                </button>
              </div>
              <SpeakButton text={current.word} compact />
              <button onClick={() => toggleFavorite(current)} className="text-lg" aria-label="즐겨찾기">
                {favorites.has(wordKey(current)) ? "★" : "☆"}
              </button>
            </div>
            <FlashCard
              key={turnId}
              flipped={showAnswer}
              front={
                <div className="text-center font-extrabold" style={{ fontSize: "calc(1.5rem * var(--practice-font-scale, 1))" }}>
                  {qText}
                </div>
              }
              back={
                <div className="flex flex-col items-center gap-2">
                  {wrongCount >= FREQUENTLY_WRONG_THRESHOLD && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: "var(--red)", color: "#fff" }}
                    >
                      자주 틀리는 단어 · {wrongCount}회
                    </span>
                  )}
                  <div
                    className="text-center font-bold"
                    style={{ color: "var(--text-muted)", fontSize: "calc(1.125rem * var(--practice-font-scale, 1))" }}
                  >
                    {qText}
                  </div>
                  <div
                    className="text-center font-extrabold"
                    style={{ color: "var(--accent-dark)", fontSize: "calc(1.5rem * var(--practice-font-scale, 1))" }}
                  >
                    {aText}
                  </div>
                  {showHint && current.hint.trim() && (
                    <div
                      className="hint-reveal mt-2 w-full max-h-[42vh] overflow-y-auto rounded-xl px-4 py-3 leading-relaxed whitespace-pre-line"
                      style={{ background: "var(--hint-bg)", color: "var(--text-muted)", fontSize: "calc(0.875rem * var(--practice-font-scale, 1))" }}
                    >
                      <HintText text={current.hint} />
                    </div>
                  )}
                </div>
              }
            />
          </div>
        ) : (
          <div className="study-card relative mt-10 p-8 text-center">
            <Confetti />
            <div className="flex justify-center mb-3">
              <Mascot state="correct" />
            </div>
            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
              대기열의 모든 연습을 완료했습니다.
            </div>
          </div>
        )}
        <ExitFocusButton
          onExit={() => {
            // 종료 직후 방금 연습한 파일 조합으로 체크박스/대시보드를 다시 맞춰서,
            // 방금 한 연습이 저장됐다는 걸 화면에서 바로 확인할 수 있게 한다.
            // selectedFiles를 먼저 비워야 한다 — 그대로 두면 포커스 모드 동안 언마운트됐던
            // FileSelector가 아직 트리도 못 불러온 시점에 "예전 selectedFiles(=방금 연습한
            // 그 파일)가 이미 target과 같다"는 착시로 아래 복원 effect가 restoreRequest를
            // 즉시 지워버려서, 정작 체크박스에는 복원이 반영되지 않는 문제가 있었다.
            if (activeFilePaths.length > 0) {
              setSelectedFiles([]);
              setRestoreRequest({ paths: activeFilePaths, mode, autoStart: false });
              // 아직 다 못 끝낸 채로 나가는 거면, 방금까지의 큐/완료 개수를 그대로
              // "이어서 연습하기" 카드에 반영해서 다음에 정확히 이어할 수 있게 한다.
              if (!finished) {
                setSaved({
                  filesLabel,
                  filePaths: activeFilePaths,
                  mode,
                  queue,
                  currentWord: current,
                  displaySide,
                  totalCount: total,
                  doneCount,
                });
              }
            }
          }}
          label="연습 종료하기"
          extraAction={!finished && !roundGateOpen && queue.length > 1 ? { label: "단어 순서 섞기", onClick: shuffleQueue } : undefined}
        />
      </FocusScreen>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          icon="연"
          accent="var(--blue)"
          title="연습 파트"
          subtitle="망각 곡선 큐 적용. 4단계로 스스로 채점하면 모르는 단어일수록 더 빨리 다시 만납니다."
        />
        {userId && (
          <Link
            href="/practice/frequent"
            className="btn-3d btn-red shrink-0 px-3 py-1.5 text-xs whitespace-nowrap"
          >
            연습 복습
          </Link>
        )}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        단축키: Space/Enter=정답 확인 · 1~4=모름·헷갈림·조금앎·완벽함 · ↑/W/Num8=완벽함 ·
        ↓/S/Num2=모름 · ←/A/Num4=조금앎 · →/D/Num6=헷갈림
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
          를 설정하면 연습 진행 상황이 기기 간에 저장됩니다.
        </div>
      )}

      {saved && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">
            저장된 연습 진행이 있습니다: {fileSummaryOf(saved.filesLabel)} · 완료 {saved.doneCount} / {saved.totalCount}
          </div>
          <button onClick={resume} className="btn-3d btn-blue mt-3 w-full">
            이어서 연습하기
          </button>
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

      {fromReview && userId && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">완벽함/조금 앎으로 채점했던 단어를 다시 복습합니다.</div>
          <button onClick={beginFromReview} disabled={starting} className="btn-3d btn-blue mt-3 w-full">
            {starting ? (
              <>
                <Spinner size={16} className="mr-2" />
                불러오는 중...
              </>
            ) : (
              "복습 시작"
            )}
          </button>
        </div>
      )}

      {fromDueReview && userId && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">간격 반복 주기가 다 돼서 오늘 다시 볼 때가 된 단어만 골라 연습합니다.</div>
          <button onClick={beginFromDueReview} disabled={starting} className="btn-3d btn-accent mt-3 w-full">
            {starting ? (
              <>
                <Spinner size={16} className="mr-2" />
                불러오는 중...
              </>
            ) : (
              "오늘의 복습 시작"
            )}
          </button>
        </div>
      )}

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} restorePaths={restoreRequest?.paths ?? null} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <button onClick={() => begin("word_only")} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent text-sm">
          {starting ? <Spinner size={14} /> : isItSelection(selectedFiles) ? "이름만" : "한자 맞추기"}
        </button>
        <button onClick={() => begin("meaning_only")} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent text-sm">
          {starting ? <Spinner size={14} /> : isItSelection(selectedFiles) ? "뜻만" : "한자 뜻 맞추기"}
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
        onRestore={(paths, mode) => {
          // "이 학습 다시 하기"가 지금 이어서 할 수 있는 저장된 진행(saved)과 정확히 같은
          // 파일 조합을 가리키면, 처음부터 다시 섞어 시작하는 대신 그 진행을 그대로
          // 이어간다 — 안 그러면 방금까지 쌓은 완료 개수가 0으로 리셋된 것처럼 보인다.
          if (saved && fileKeyOf(saved.filePaths) === fileKeyOf(paths)) {
            resume();
            return;
          }
          setRestoreRequest({ paths, mode: isStudyMode(mode) ? mode : "random", autoStart: true });
        }}
      />
    </div>
  );
}
