"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/hooks/useUserId";
import { useTheme } from "@/contexts/ThemeContext";
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
