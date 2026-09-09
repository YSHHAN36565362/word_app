"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { useTheme } from "@/contexts/ThemeContext";
import { DAILY_GOAL_MAX, DAILY_GOAL_MIN, goalStepFor, useDailyGoal } from "@/hooks/useDailyGoal";
import { useHintTheme } from "@/hooks/useHintTheme";
import { useFontScale } from "@/hooks/useFontScale";
import { DEFAULT_HINT_THEME, HINT_SCALE_MAX, HINT_SCALE_MIN, HINT_SCALE_STEP, HINT_SECTIONS } from "@/lib/hintTheme";
import { deleteProgress, isSyncEnabled } from "@/lib/progress";
import { deleteLearningLog, formatKstDateTime, isFileKeyMissing, listAllLearningLogs, LearningLogEntryWithPart, Part } from "@/lib/learningLog";
import { getDeviceLabel, setDeviceLabel } from "@/lib/device";
import { flattenWordTreePaths, WordTree } from "@/lib/types";
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
  // 여러 기기에서 같은 번호를 쓸 때 기록에 "어느 기기"인지 보여주기 위한 이름
  // (device.ts). 처음엔 기기 종류를 추측한 값이 뜨고, 여기서 원하는 이름으로
  // 바꿔둘 수 있다(예: "내 맥북", "거실 아이패드").
  const [deviceLabelInput, setDeviceLabelInput] = useState("");
  const [deviceLabelSaved, setDeviceLabelSaved] = useState(true);
  const [logs, setLogs] = useState<LearningLogEntryWithPart[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // listAllLearningLogs()가 실패(reject)하면 예전에는 .then()이 아예 안 불려서
  // logsLoading이 true인 채로 영원히 "불러오는 중..."만 보였다 — 실패도 잡아서
  // 로딩을 끝내고 이 상태로 안내 문구 + "다시 시도" 버튼을 보여준다.
  const [logsError, setLogsError] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string>("");
  // 예전 학습 기록이 가리키는 파일이 그 뒤 삭제·이름 변경됐으면 다시 시작할 수
  // 없다 — 지금 실제로 존재하는 파일 경로 목록을 받아와서 기록마다 비교한다.
  const [existingPaths, setExistingPaths] = useState<Set<string> | null>(null);

  const displayValue = touched ? input : userId;

  useEffect(() => {
    // Supabase 클라이언트는 브라우저에서만 만들어져야 하므로(서버/빌드 시 prerender에서
    // 만들면 잘못된 URL 등으로 빌드가 깨질 수 있음) 마운트 후에만 확인한다.
    isSyncEnabled().then(setSyncEnabled);
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setDeviceLabelInput(getDeviceLabel());
    fetch("/api/wordlist/tree")
      .then((res) => res.json())
      .then((tree: WordTree) => setExistingPaths(flattenWordTreePaths(tree)))
      .catch(() => {
        /* 실패해도 "학습 불가" 표시만 안 뜰 뿐, 나머지 화면엔 영향 없다. */
      });
  }, []);

  function saveDeviceLabel() {
    setDeviceLabel(deviceLabelInput);
    setDeviceLabelInput(getDeviceLabel());
    setDeviceLabelSaved(true);
  }

  function loadLogs() {
    if (!userId) return;
    setLogsLoading(true);
    setLogsError(false);
    listAllLearningLogs(userId)
      .then((data) => {
        setLogs(data);
        setLogsLoading(false);
      })
      .catch(() => {
        setLogsLoading(false);
        setLogsError(true);
      });
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!ready || !userId) return;
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleDeleteLog(entry: LearningLogEntryWithPart) {
    const key = `${entry.part}::${entry.fileKey}::${entry.deviceId}`;
    const extraNote = entry.part === "practice" ? " 이어서 연습하기 카드에서도 사라집니다." : "";
    const deviceNote = entry.isThisDevice ? "" : ` (${entry.deviceLabel})`;
    if (!window.confirm(`"${entry.fileSummary}"${deviceNote} (${PART_LABEL[entry.part]}) 학습 기록을 삭제할까요?\n진행률과 최근 학습 시간이 초기화됩니다.${extraNote}`)) return;
    setDeletingKey(key);
    await deleteLearningLog(userId, entry.part, entry.fileKey, entry.deviceId);
    // learning_log(요약 기록)만 지우고 progress(실제 이어하기 큐)는 그대로 둬서,
    // 여기서 삭제해도 연습 화면의 "이어서 연습하기" 카드에는 그 조합이 계속 남아있는
    // 문제가 있었다. 연습 파트는 파일 조합별로 독립된 슬롯(file_key=파일 조합)을
    // 쓰므로 같은 키로 같이 지운다 — 학습/시험/지문은 파트당 슬롯이 하나뿐이라
    // (file_key="") 여기서 넘어온 파일 조합과 실제로 같은 진행인지 구분할 수 없어,
    // 잘못 지우는 걸 피하려고 지금은 연습 파트만 같이 지운다.
    if (entry.part === "practice") {
      await deleteProgress(userId, "practice", entry.fileKey, entry.deviceId);
    }
    setLogs((prev) => prev.filter((l) => `${l.part}::${l.fileKey}::${l.deviceId}` !== key));
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
          <div className="text-sm font-bold">이 기기 이름</div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            같은 번호를 여러 기기(맥북·데스크탑·아이폰·아이패드 등)에서 쓸 때, 아래
            학습 기록에 어느 기기의 기록인지 이 이름으로 표시됩니다. 기기 종류를
            추측해 미리 채워뒀으니 원하는 이름으로 바꿔두면 더 알아보기 쉬워요.
            (이 기기에만 저장됩니다)
          </p>
          <input
            value={deviceLabelInput}
            onChange={(e) => {
              setDeviceLabelInput(e.target.value);
              setDeviceLabelSaved(false);
            }}
            placeholder="예: 내 맥북"
            className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
          />
          <button onClick={saveDeviceLabel} disabled={deviceLabelSaved || !deviceLabelInput.trim()} className="btn-3d btn-accent mt-3 w-full disabled:opacity-40">
            저장
          </button>
        </div>
      )}

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

          {!logsLoading && logsError && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--hint-bg)", color: "var(--red)" }}>
              <span>학습 기록을 불러오지 못했어요. 네트워크 상태를 확인해주세요.</span>
              <button onClick={loadLogs} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--card)", color: "var(--text)" }}>
                다시 시도
              </button>
            </div>
          )}

          {!logsLoading && !logsError && logs.length === 0 && (
            <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              저장된 학습 기록이 없습니다.
            </div>
          )}

          {!logsLoading && !logsError && logs.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {logs.map((entry) => {
                const key = `${entry.part}::${entry.fileKey}::${entry.deviceId}`;
                const unusable = existingPaths ? isFileKeyMissing(entry.fileKey, existingPaths) : false;
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
                        {/* 파일 이름이 길면 잘려서 안 보이던 것을, 가로 스크롤로 전부 볼 수 있게 했다. */}
                        <div className="min-w-0 flex-1 overflow-x-auto">
                          <span className="whitespace-nowrap font-bold">{entry.fileSummary}</span>
                        </div>
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {entry.deviceLabel}
                        {entry.isThisDevice && " (이 기기)"} · {formatKstDateTime(entry.updatedAt)} · {entry.doneCount} / {entry.totalCount}개
                      </div>
                      {unusable && (
                        <div className="mt-0.5 text-[10px] font-bold" style={{ color: "var(--red)" }}>
                          학습 불가 — 원본 파일이 삭제되었거나 이름이 바뀌었어요
                        </div>
                      )}
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
