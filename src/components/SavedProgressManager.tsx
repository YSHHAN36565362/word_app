"use client";

import { useEffect, useState } from "react";
import { deleteProgress, listSavedProgress, SavedProgressEntry } from "@/lib/progress";
import { deleteLearningLog, fileKeyOf, fileSummaryOf, formatKstDateTime, Part } from "@/lib/learningLog";

type Entry = SavedProgressEntry<Record<string, unknown>>;

interface Props {
  userId: string;
  ready: boolean;
  part: Part;
  /** 지운 항목을 부모 화면의 "이어서 하기" 상태에서도 빼 주기 위한 콜백. */
  onDeleted?: (deleted: Entry[]) => void;
}

const entryKey = (e: Entry) => `${e.fileKey}::${e.deviceId}`;

// 파트마다 저장된 진행 데이터의 모양이 달라서, 화면에 보여줄 "이름 · 진행률"만 여기서 뽑는다.
function describe(part: Part, d: Record<string, unknown>): string {
  const label = Array.isArray(d.filesLabel) ? fileSummaryOf(d.filesLabel as string[]) : "(이름 없음)";
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  let progress = "";
  if (part === "study") progress = `${num(d.studyIndex)} / ${len(d.words)}`;
  else if (part === "practice") progress = `완료 ${num(d.doneCount)} / ${num(d.totalCount)}`;
  else if (part === "exam") progress = `${num(d.currentNumber)} / ${num(d.totalCount)}`;
  else progress = `${num(d.scriptIndex)} / ${len(d.lines)}`;
  return `${label} · ${progress}`;
}

/**
 * 학습/연습/시험/지문 파트 공통: 저장해 둔 "이어서 하기" 진행 기록을 체크박스로 골라 한꺼번에 지운다.
 * 진행 기록(progress)과 같은 파일 조합의 학습 기록(learning_log)을 같이 지운다.
 */
export default function SavedProgressManager({ userId, ready, part, onDeleted }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !userId) return;
    let alive = true;
    listSavedProgress<Record<string, unknown>>(userId, part).then((list) => {
      if (alive) setEntries(list.filter((e) => e.data));
    });
    return () => {
      alive = false;
    };
  }, [ready, userId, part]);

  if (entries.length === 0) return null;

  const allSelected = selected.size === entries.length;
  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function deleteSelected() {
    const targets = entries.filter((e) => selected.has(entryKey(e)));
    if (targets.length === 0) return;
    if (!window.confirm(`선택한 진행 기록 ${targets.length}개를 삭제할까요?\n진행률이 초기화됩니다.`)) return;
    setBusy(true);
    for (const e of targets) {
      await deleteProgress(userId, part, e.fileKey, e.deviceId);
      // 예전에 파일 구분 없이 저장된 기록(fileKey="")은 안에 들어 있는 파일 목록으로 학습 기록 키를 구한다.
      const paths = Array.isArray(e.data.filePaths) ? (e.data.filePaths as string[]) : [];
      const logKey = e.fileKey || (paths.length > 0 ? fileKeyOf(paths) : "");
      if (logKey) await deleteLearningLog(userId, part, logKey, e.deviceId);
    }
    const gone = new Set(targets.map(entryKey));
    setEntries((prev) => prev.filter((e) => !gone.has(entryKey(e))));
    setSelected(new Set());
    setBusy(false);
    onDeleted?.(targets);
  }

  return (
    <details className="mt-3 study-card p-3">
      <summary className="cursor-pointer text-xs font-bold" style={{ color: "var(--text-muted)" }}>
        진행 기록 관리 · 선택 삭제 ({entries.length}개)
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {entries.map((e) => {
          const key = entryKey(e);
          return (
            <label key={key} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--hint-bg)" }}>
              <input type="checkbox" className="mt-0.5" checked={selected.has(key)} onChange={() => toggle(key)} />
              <span className="min-w-0 flex-1 overflow-x-auto">
                <span className="block whitespace-nowrap text-xs">{describe(part, e.data)}</span>
                <span className="block whitespace-nowrap text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {e.deviceLabel}
                  {e.isThisDevice && " (이 기기)"} · {formatKstDateTime(e.updatedAt)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setSelected(allSelected ? new Set() : new Set(entries.map(entryKey)))}
          className="btn-3d btn-ghost flex-1 px-3 py-1.5 text-xs"
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
        <button
          onClick={deleteSelected}
          disabled={selected.size === 0 || busy}
          className="btn-3d btn-red flex-1 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {busy ? "삭제 중..." : `선택 삭제 (${selected.size})`}
        </button>
      </div>
    </details>
  );
}
