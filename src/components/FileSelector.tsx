"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryNode, FileRef, WordTree } from "@/lib/types";
import { extractYearMonth } from "@/lib/parser";

interface Props {
  onSelectionChange: (files: FileRef[]) => void;
}

export default function FileSelector({ onSelectionChange }: Props) {
  const [tree, setTree] = useState<WordTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mainCat, setMainCat] = useState<string | null>(null);
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/wordlist/tree")
      .then((r) => r.json())
      .then((data: WordTree) => {
        setTree(data);
        if (data.error) setError(data.error);
        if (data.categories.length > 0) {
          setMainCat(data.categories[0].name);
          setSelectedSubs(new Set(data.categories[0].subfolders.map((s) => s.name)));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("단어장 목록을 불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  const currentCategory: CategoryNode | undefined = useMemo(
    () => tree?.categories.find((c) => c.name === mainCat),
    [tree, mainCat]
  );

  const visibleFiles: FileRef[] = useMemo(() => {
    if (!currentCategory) return [];
    if (currentCategory.subfolders.length > 0) {
      return currentCategory.subfolders
        .filter((s) => selectedSubs.has(s.name))
        .flatMap((s) => s.files);
    }
    return currentCategory.files;
  }, [currentCategory, selectedSubs]);

  const monthGroups = useMemo(() => {
    const buckets = new Map<string, FileRef[]>();
    for (const f of visibleFiles) {
      const ym = extractYearMonth(f.filename);
      const key = ym ? `${ym[0]}-${String(ym[1]).padStart(2, "0")}` : "__none__";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(f);
    }
    const entries = Array.from(buckets.entries());
    entries.sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return b.localeCompare(a);
    });
    return entries.map(([key, files]) => ({
      key,
      label: key === "__none__" ? "날짜 없음" : `${key.split("-")[0]}년 ${parseInt(key.split("-")[1], 10)}월`,
      files: [...files].sort((a, b) => b.filename.localeCompare(a.filename)),
    }));
  }, [visibleFiles]);

  useEffect(() => {
    const selected = visibleFiles.filter((f) => checkedPaths.has(f.path));
    onSelectionChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedPaths, visibleFiles]);

  function toggleSub(name: string) {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleFile(path: string) {
    setCheckedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAll() {
    setCheckedPaths(new Set(visibleFiles.map((f) => f.path)));
  }
  function deselectAll() {
    setCheckedPaths(new Set());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
        단어장 목록 불러오는 중...
      </div>
    );
  }
  if (error) {
    return <div className="py-6 text-sm text-center" style={{ color: "var(--red)" }}>{error}</div>;
  }
  if (!tree || tree.categories.length === 0) {
    return (
      <div className="py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>
        word_list 폴더에서 단어장을 찾을 수 없습니다.
      </div>
    );
  }

  const selectedCount = visibleFiles.filter((f) => checkedPaths.has(f.path)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tree.categories.map((c) => (
          <button
            key={c.name}
            onClick={() => {
              setMainCat(c.name);
              setSelectedSubs(new Set(c.subfolders.map((s) => s.name)));
            }}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors"
            style={{
              background: c.name === mainCat ? "var(--accent)" : "var(--card)",
              color: c.name === mainCat ? "#fff" : "var(--text)",
              border: `2px solid ${c.name === mainCat ? "var(--accent)" : "var(--card-border)"}`,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {currentCategory && currentCategory.subfolders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentCategory.subfolders.map((s) => (
            <button
              key={s.name}
              onClick={() => toggleSub(s.name)}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                background: selectedSubs.has(s.name) ? "var(--blue)" : "var(--hint-bg)",
                color: selectedSubs.has(s.name) ? "#fff" : "var(--text-muted)",
              }}
            >
              {s.name} ({s.files.length})
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          {selectedCount > 0 ? `${selectedCount}개 파일 선택됨` : "선택된 파일이 없습니다"}
        </span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
            전체 선택
          </button>
          <button onClick={deselectAll} className="btn-3d btn-ghost px-3 py-1.5 text-xs">
            전체 해제
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {monthGroups.map((group, idx) => (
          <details key={group.key} open={idx === 0} className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
            <summary
              className="cursor-pointer px-4 py-2.5 text-sm font-bold select-none"
              style={{ background: "var(--hint-bg)", color: "var(--text)" }}
            >
              {group.label} ({group.files.length}개)
            </summary>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--card-border)" }}>
              {group.files.map((f) => (
                <label
                  key={f.path}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <input
                    type="checkbox"
                    checked={checkedPaths.has(f.path)}
                    onChange={() => toggleFile(f.path)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="truncate">{f.filename}</span>
                </label>
              ))}
            </div>
          </details>
        ))}
        {monthGroups.length === 0 && (
          <div className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            선택한 카테고리에 파일이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
