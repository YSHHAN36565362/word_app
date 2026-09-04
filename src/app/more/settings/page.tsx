"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { useTheme } from "@/contexts/ThemeContext";
import { DAILY_GOAL_MAX, DAILY_GOAL_MIN, goalStepFor, useDailyGoal } from "@/hooks/useDailyGoal";
import { useHintTheme } from "@/hooks/useHintTheme";
import { useFontScale } from "@/hooks/useFontScale";
import { DEFAULT_HINT_THEME, HINT_SCALE_MAX, HINT_SCALE_MIN, HINT_SCALE_STEP, HINT_SECTIONS } from "@/lib/hintTheme";
import { isSyncEnabled } from "@/lib/progress";
import { deleteLearningLog, formatKstDateTime, listAllLearningLogs, LearningLogEntryWithPart, Part } from "@/lib/learningLog";
import PageHeader from "@/components/PageHeader";

const PART_LABEL: Record<Part, string> = {
  study: "학습",
  practice: "연습",
  exam: "시험",
  script: "지문",
};

export default function SettingsPage() {
  const { userId, setUserId, ready } = useUserId();
  const { theme, toggleTheme } = useTheme();
  const { goal, setGoal, adjustGoal } = useDailyGoal();
  // 한자 부수 분해가 길어질수록 휴대폰 같은 작은 화면에서 잘 안 보인다는 요청으로,
  // 힌트 구간 전체를 다루는 "글자 크기 설정" 화면까지 안 가도 여기서 바로 한자 크기를
  // 조절할 수 있게 했다. 세 가지를 함께 조절한다: 연습 화면 카드 앞면에 크게 나오는
  // 질문(단어/한자), 힌트의 [한자1]/[한자2]… 제목 줄, 그 아래 한자 분해(음독/훈독/
  // 어원) 본문 — "word_app_practice_font_scale"은 연습 화면과 "글자 크기 설정"
  // 페이지의 "연습 화면" 행이 이미 공유하는 값이라, 여기서 같은 키로 저장해두면
  // 다음에 연습 화면을 열 때 그대로 반영된다.
  const { theme: hintTheme, update: updateHintTheme } = useHintTheme();
  const { setFontScale: setPracticeFontScale, adjustFontScale: adjustPracticeFontScale } = useFontScale(
    "word_app_practice_font_scale",
    "--practice-font-scale"
  );
  const kanjiScale = hintTheme.kanji.scale;
  const kanjiSample = HINT_SECTIONS.find((s) => s.key === "kanji")?.sample ?? "";
  const kanjiHeaderSample = HINT_SECTIONS.find((s) => s.key === "kanjiHeader")?.sample ?? "";

  function adjustKanjiSize(delta: number) {
    updateHintTheme("kanji", { scale: kanjiScale + delta });
    updateHintTheme("kanjiHeader", { scale: hintTheme.kanjiHeader.scale + delta });
    adjustPracticeFontScale(delta);
  }

  function resetKanjiSize() {
    updateHintTheme("kanji", { scale: 1 });
    updateHintTheme("kanjiHeader", { scale: DEFAULT_HINT_THEME.kanjiHeader.scale });
    setPracticeFontScale(1);
  }
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [logs, setLogs] = useState<LearningLogEntryWithPart[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string>("");

  const displayValue = touched ? input : userId;

  useEffect(() => {
    // Supabase 클라이언트는 브라우저에서만 만들어져야 하므로(서버/빌드 시 prerender에서
    // 만들면 잘못된 URL 등으로 빌드가 깨질 수 있음) 마운트 후에만 확인한다.
    isSyncEnabled().then(setSyncEnabled);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!ready || !userId) return;
    setLogsLoading(true);
    listAllLearningLogs(userId).then((data) => {
      setLogs(data);
      setLogsLoading(false);
    });
  }, [ready, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleDeleteLog(entry: LearningLogEntryWithPart) {
    const key = `${entry.part}::${entry.fileKey}`;
    if (!window.confirm(`"${entry.fileSummary}" (${PART_LABEL[entry.part]}) 학습 기록을 삭제할까요?\n진행률과 최근 학습 시간이 초기화됩니다.`)) return;
    setDeletingKey(key);
    await deleteLearningLog(userId, entry.part, entry.fileKey);
    setLogs((prev) => prev.filter((l) => !(l.part === entry.part && l.fileKey === entry.fileKey)));
    setDeletingKey("");
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader icon="설" accent="#8a8a94" title="설정" />

      <Link
        href="/more/guide"
        className="mt-4 flex items-center justify-between study-card px-4 py-3 text-sm"
        style={{ color: "var(--text)" }}
      >
        <span>
          처음이신가요? <span className="font-bold">사용법 설명</span>을 먼저 확인해보세요.
        </span>
        <span style={{ color: "var(--text-muted)" }}>›</span>
      </Link>

      <Link
        href="/more/review"
        className="mt-2 flex items-center justify-between study-card px-4 py-3 text-sm"
        style={{ color: "var(--text)" }}
      >
        <span>
          완벽함·조금 앎으로 채점한 단어를 <span className="font-bold">복습</span>에서 다시 볼 수 있어요.
        </span>
        <span style={{ color: "var(--text-muted)" }}>›</span>
      </Link>

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">오늘의 목표</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          하루에 몇 개의 단어를 채점할지 정합니다. 홈 화면의 진행 링이 이 목표를 기준으로
          채워집니다. (이 기기에만 저장되고 학습 기록에는 영향을 주지 않습니다)
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => adjustGoal(-goalStepFor(goal))}
            disabled={goal <= DAILY_GOAL_MIN}
            aria-label="목표 줄이기"
            className="btn-3d btn-ghost h-9 w-12 text-base disabled:opacity-40"
          >
            −
          </button>
          <div className="min-w-20 text-center">
            <div className="text-xl font-extrabold">{goal}개</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              하루 목표
            </div>
          </div>
          <button
            onClick={() => adjustGoal(goalStepFor(goal))}
            disabled={goal >= DAILY_GOAL_MAX}
            aria-label="목표 늘리기"
            className="btn-3d btn-ghost h-9 w-12 text-base disabled:opacity-40"
          >
            +
          </button>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {[30, 50, 100, 150, 200, 300].map((preset) => (
            <button
              key={preset}
              onClick={() => setGoal(preset)}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={
                goal === preset
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--hint-bg)", color: "var(--text-muted)" }
              }
            >
              {preset}개
            </button>
          ))}
        </div>
      </div>

      <Link
        href="/more/settings/font-size"
        className="mt-4 flex items-center justify-between study-card px-4 py-3 text-sm"
        style={{ color: "var(--text)" }}
      >
        <span>
          한자·힌트 <span className="font-bold">글자 크기·색상</span>은 별도 화면에서 조절할 수 있어요.
        </span>
        <span style={{ color: "var(--text-muted)" }}>›</span>
      </Link>

      <div className="mt-4 study-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">한자 크기</div>
          <button onClick={resetKanjiSize} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}>
            기본값
          </button>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          연습 화면에서 처음 질문으로 크게 나오는 한자, 힌트의 [한자1]/[한자2]… 제목
          줄, 그 아래 한자 부수 분해(음독·훈독·어원 등) 글자 크기를 함께 조절합니다.
          부수가 많은 한자일수록 휴대폰 같은 작은 화면에서 잘 안 보인다는 의견을
          반영했습니다. 다른 힌트 구간의 색상·크기는 위 &ldquo;글자 크기
          설정&rdquo;에서 따로 조절할 수 있어요. (이 기기에만 저장되고 학습 기록에는
          영향을 주지 않습니다)
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => adjustKanjiSize(-HINT_SCALE_STEP)}
            disabled={kanjiScale <= HINT_SCALE_MIN}
            aria-label="한자 크기 줄이기"
            className="btn-3d btn-ghost h-9 w-12 text-base disabled:opacity-40"
          >
            −
          </button>
          <div className="min-w-20 text-center">
            <div className="text-xl font-extrabold">{Math.round(kanjiScale * 100)}%</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              한자 크기
            </div>
          </div>
          <button
            onClick={() => adjustKanjiSize(HINT_SCALE_STEP)}
            disabled={kanjiScale >= HINT_SCALE_MAX}
            aria-label="한자 크기 늘리기"
            className="btn-3d btn-ghost h-9 w-12 text-base disabled:opacity-40"
          >
            +
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-1.5 rounded-lg px-3 py-2" style={{ background: "var(--hint-bg)" }}>
          <div
            className="truncate text-center font-bold"
            style={{ color: hintTheme.kanjiHeader.color || "var(--text-muted)", fontSize: `calc(0.8rem * ${hintTheme.kanjiHeader.scale})` }}
          >
            {kanjiHeaderSample}
          </div>
          <div className="truncate text-center" style={{ color: "var(--text-muted)", fontSize: `calc(0.8rem * ${kanjiScale})` }}>
            {kanjiSample}
          </div>
        </div>
      </div>

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">화면 테마</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          다크 모드 / 라이트 모드를 전환합니다.
        </p>
        <button onClick={toggleTheme} className="btn-3d btn-ghost mt-3 w-full">
          {theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
        </button>
      </div>

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">내 번호</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          번호를 입력하면 학습/연습/시험/지문 진행 상황, 오답노트, 통계가 이 번호로 저장되어
          다른 기기에서도 같은 번호로 이어서 할 수 있습니다. 겹치지 않는 숫자(생년월일 등)를 추천합니다.
        </p>
        {!syncEnabled && (
          <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--hint-bg)", color: "var(--red)" }}>
            현재 서버에 동기화 저장소(Supabase)가 설정되지 않아, 번호를 입력해도 진행 상황이 저장되지
            않습니다. 관리자에게 문의하세요.
          </div>
        )}
        <input
          value={displayValue}
          onChange={(e) => {
            setTouched(true);
            setInput(e.target.value);
          }}
          placeholder="예: 010721"
          className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
        <button
          onClick={() => {
            setUserId(displayValue);
            setTouched(false);
          }}
          disabled={!ready}
          className="btn-3d btn-accent mt-3 w-full"
        >
          저장
        </button>
        {ready && userId && (
          <div className="mt-2 text-xs font-bold" style={{ color: "var(--accent)" }}>
            현재 번호: {userId}
          </div>
        )}
      </div>

      {ready && userId && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm font-bold">학습 기록 관리</div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            파일을 잘못 체크했거나 특정 조합의 진도를 리셋하고 싶을 때 개별로 삭제할 수 있습니다.
          </p>

          {logsLoading && (
            <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              불러오는 중...
            </div>
          )}

          {!logsLoading && logs.length === 0 && (
            <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              저장된 학습 기록이 없습니다.
            </div>
          )}

          {!logsLoading && logs.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {logs.map((entry) => {
                const key = `${entry.part}::${entry.fileKey}`;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: "var(--hint-bg)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 font-bold"
                          style={{ background: "var(--card)", color: "var(--text-muted)" }}
                        >
                          {PART_LABEL[entry.part]}
                        </span>
                        <span className="truncate font-bold" title={entry.fileSummary}>
                          {entry.fileSummary}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {formatKstDateTime(entry.updatedAt)} · {entry.doneCount} / {entry.totalCount}개
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteLog(entry)}
                      disabled={deletingKey === key}
                      className="btn-3d btn-red shrink-0 px-3 py-1.5 text-xs"
                    >
                      {deletingKey === key ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
