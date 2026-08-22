"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FileSelector from "@/components/FileSelector";
import ExitFocusButton from "@/components/ExitFocusButton";
import FocusScreen from "@/components/FocusScreen";
import ProgressBar from "@/components/ProgressBar";
import KeyBadge from "@/components/KeyBadge";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserId } from "@/hooks/useUserId";
import { fetchScriptLines } from "@/lib/api";
import { deleteProgress, loadProgress, saveProgress } from "@/lib/progress";
import { FileRef, ScriptProgress } from "@/lib/types";

export default function ScriptPage() {
  const { focus, setFocus } = useFocusMode();
  const { userId, ready } = useUserId();

  const [selectedFiles, setSelectedFiles] = useState<FileRef[]>([]);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState<ScriptProgress | null>(null);

  const [lines, setLines] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [filesLabel, setFilesLabel] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !userId) return;
    loadProgress<ScriptProgress>(userId, "script").then((p) => {
      if (p && p.lines && p.lines.length > 0) setSaved(p);
    });
  }, [ready, userId]);

  async function begin() {
    if (selectedFiles.length === 0) return;
    setStarting(true);
    const merged = await fetchScriptLines(selectedFiles.map((f) => f.path));
    setStarting(false);
    if (merged.length === 0) return;
    const labels = selectedFiles.map((f) => f.label);
    setLines(merged);
    setIndex(0);
    setFilesLabel(labels);
    setFocus(true);
    if (userId) {
      saveProgress(userId, "script", { lines: merged, filesLabel: labels, scriptIndex: 0 } as ScriptProgress);
    }
  }

  function resume() {
    if (!saved) return;
    setLines(saved.lines);
    setIndex(saved.scriptIndex);
    setFilesLabel(saved.filesLabel);
    setFocus(true);
  }

  function go(delta: number) {
    const nextIndex = index + delta;
    setIndex(nextIndex);
    if (userId) {
      saveProgress(userId, "script", { lines, filesLabel, scriptIndex: nextIndex } as ScriptProgress);
    }
  }

  const done = index >= lines.length;

  useEffect(() => {
    if (focus && done && userId) deleteProgress(userId, "script");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useKeyboardShortcuts(
    {
      ArrowRight: () => go(1),
      ArrowLeft: () => { if (index > 0) go(-1); },
    },
    focus && !done
  );

  if (focus) {
    return (
      <FocusScreen
        top={
          !done ? (
            <>
              <ProgressBar ratio={index / Math.max(1, lines.length)} />
              <div className="mt-2 text-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                {index + 1} / {lines.length}
              </div>
            </>
          ) : null
        }
        actions={
          !done ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => go(-1)} disabled={index === 0} className="btn-3d btn-ghost">
                이전 문장
                <KeyBadge>←</KeyBadge>
              </button>
              <button onClick={() => go(1)} className="btn-3d btn-accent">
                다음 문장
                <KeyBadge>→</KeyBadge>
              </button>
            </div>
          ) : undefined
        }
      >
        {!done ? (
          <div className="study-card mt-4 p-8 min-h-[160px] flex items-center">
            <p className="text-lg font-semibold leading-relaxed" style={{ color: "var(--blue)" }}>
              {lines[index]}
            </p>
          </div>
        ) : (
          <div className="study-card mt-10 p-8 text-center">
            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
              모든 대본/지문 학습을 완료했습니다.
            </div>
          </div>
        )}
        <ExitFocusButton onExit={() => setSaved(null)} label="지문 학습 종료하기" />
      </FocusScreen>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">지문 한 줄 외우기</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        대화 및 지문을 순서대로 연상하며 외웁니다.
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        단축키: ←/→=이전/다음 문장
      </p>

      {ready && !userId && (
        <div className="mt-3 rounded-xl px-4 py-2.5 text-xs" style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}>
          <Link href="/more/settings" className="font-bold underline">
            내 번호
          </Link>
          를 설정하면 진행 상황이 기기 간에 저장됩니다.
        </div>
      )}

      {saved && (
        <div className="mt-4 study-card p-4">
          <div className="text-sm">
            저장된 진행이 있습니다: {saved.scriptIndex + 1} / {saved.lines.length}번째 문장
          </div>
          <button onClick={resume} className="btn-3d btn-blue mt-3 w-full">
            이어서 외우기
          </button>
        </div>
      )}

      <div className="mt-5">
        <FileSelector onSelectionChange={setSelectedFiles} />
      </div>

      <button onClick={begin} disabled={selectedFiles.length === 0 || starting} className="btn-3d btn-accent mt-5 w-full">
        {starting ? "불러오는 중..." : "대본 학습 시작"}
      </button>
    </div>
  );
}
