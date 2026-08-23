"use client";

import { useEffect, useState } from "react";
import { fileKeyOf, fileSummaryOf, formatKstDateTime, listLearningLogs, Part, LearningLogEntry } from "@/lib/learningLog";
import { FileRef } from "@/lib/types";

interface Props {
  userId: string;
  ready: boolean;
  part: Part;
  selectedFiles: FileRef[];
  onRestore?: (paths: string[], mode: string | null) => void;
}

/**
 * 파일 선택 버튼들 바로 아래에 두는 요약 패널.
 * "내 번호 / 선택한 파일 / 최근 학습 시간 / 진행률"을 보여주고, 이 파트에서 예전에
 * 공부했던 다른 파일 조합들을 드롭다운으로 훑어볼 수 있다. 드롭다운 바로 아래에는
 * (현재 선택 기준이든 과거 기록이든) 화면에 표시 중인 조합에 기록이 있으면 항상 같은
 * 자리에 [이 학습 다시 하기] 버튼이 뜬다 — 누르면 그 파일 조합과 마지막 모드로 곧장
 * 단어 화면까지 자동 진입한다.
 */
export default function SessionInfoPanel({ userId, ready, part, selectedFiles, onRestore }: Props) {
  const [logs, setLogs] = useState<LearningLogEntry[]>([]);
  const [viewingKey, setViewingKey] = useState<string>(""); // "" = 현재 선택된 파일 기준

  useEffect(() => {
    if (!ready || !userId) return;
    listLearningLogs(userId, part).then(setLogs);
  }, [ready, userId, part]);

  const currentKey = fileKeyOf(selectedFiles.map((f) => f.path));
  const currentLabel = fileSummaryOf(selectedFiles.map((f) => f.label));
  const currentLog = logs.find((l) => l.fileKey === currentKey);

  const viewed = viewingKey ? logs.find((l) => l.fileKey === viewingKey) : undefined;
  const displaySummary = viewed ? viewed.fileSummary : currentLabel || "선택된 파일 없음";
  const displayLog = viewed ?? currentLog;
  const percent = displayLog && displayLog.totalCount > 0 ? Math.round((displayLog.doneCount / displayLog.totalCount) * 100) : 0;
  const remain = displayLog ? Math.max(0, displayLog.totalCount - displayLog.doneCount) : 0;

  return (
    <div className="mt-4 study-card p-4">
      <div className="grid grid-cols-2 gap-y-2 text-xs">
        <span style={{ color: "var(--text-muted)" }}>내 번호</span>
        <span className="text-right font-bold">{ready && userId ? userId : "설정 안 됨"}</span>

        <span style={{ color: "var(--text-muted)" }}>선택된 파일</span>
        <span className="text-right font-bold truncate" title={displaySummary}>
          {displaySummary}
        </span>

        <span style={{ color: "var(--text-muted)" }}>최근 학습</span>
        <span className="text-right font-bold">{displayLog ? formatKstDateTime(displayLog.updatedAt) : "기록 없음"}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span style={{ color: "var(--text-muted)" }}>진행률</span>
        <span className="text-right font-bold" style={{ color: "var(--accent)" }}>
          {displayLog
            ? `${percent}% (${displayLog.doneCount} / ${displayLog.totalCount}개 완료, ${remain}개 남음)`
            : "-"}
        </span>
      </div>

      {displayLog && (
        <div className="mt-2">
          <ProgressMini ratio={percent / 100} />
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-3">
          <select
            value={viewingKey}
            onChange={(e) => setViewingKey(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-xs"
            style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
          >
            <option value="">현재 선택한 파일 기준</option>
            {logs.map((l) => (
              <option key={l.fileKey} value={l.fileKey}>
                {l.fileSummary} · {formatKstDateTime(l.updatedAt)}
              </option>
            ))}
          </select>

          {displayLog && onRestore && (
            <button
              onClick={() => {
                onRestore(displayLog.fileKey.split("|"), displayLog.mode);
                setViewingKey("");
              }}
              className="btn-3d btn-blue mt-2 w-full py-1.5 text-xs"
            >
              이 학습 다시 하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressMini({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--hint-bg)" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
    </div>
  );
}
