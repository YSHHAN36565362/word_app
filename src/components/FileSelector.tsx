"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryNode, FileRef, WordTree } from "@/lib/types";
import { extractYearMonth } from "@/lib/parser";

interface Props {
  onSelectionChange: (files: FileRef[]) => void;
  /**
   * 외부(예: 이전 학습 기록의 "이 학습 다시 하기")에서 특정 파일 경로들을 강제로
   * 선택 상태로 만들고 싶을 때 넘긴다. 버튼을 누를 때마다 새 배열을 넘기면(내용이
   * 같아도) 매번 다시 적용된다. 대분류/세부카테고리/월 아코디언까지 자동으로 맞춰준다.
   */
  restorePaths?: string[] | null;
}

export default function FileSelector({ onSelectionChange, restorePaths }: Props) {
  const [tree, setTree] = useState<WordTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mainCat, setMainCat] = useState<string | null>(null);
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
  const detailsRefs = useRef<Map<string, HTMLDetailsElement>>(new Map());

  // restorePaths의 "최신 값"을 fetch 완료 시점에 읽기 위한 ref. 개발 모드(React
  // Strict Mode)에서는 마운트 시 이 effect가 두 번 실행되어 트리 fetch도 두 번
  // 나갈 수 있는데, 그중 하나가 restorePaths 복원이 끝난 뒤에 뒤늦게 도착하면
  // 아래 "기본 카테고리" 지정 로직이 방금 복원된 선택을 되돌려버리는 문제가 있었다.
  const restorePathsRef = useRef(restorePaths);
  useEffect(() => {
    restorePathsRef.current = restorePaths;
  }, [restorePaths]);
  // 트리를 불러온 뒤 "기본 카테고리"를 정하는 건 처음 한 번만 해야 한다 — 두 번째
  // fetch 응답이 늦게 와도 다시 기본값으로 되돌리지 않도록 가드한다.
  const categoryInitializedRef = useRef(false);

  useEffect(() => {
    fetch("/api/wordlist/tree")
      .then((r) => r.json())
      .then((data: WordTree) => {
        setTree(data);
        if (data.error) setError(data.error);
        if (!categoryInitializedRef.current) {
          // 복원 요청이 대기 중이면 기본 카테고리를 정하지 않고, 아래 복원 effect가
          // 알맞은 카테고리/체크 상태를 대신 정하도록 넘긴다.
          const hasPendingRestore = !!restorePathsRef.current && restorePathsRef.current.length > 0;
          if (data.categories.length > 0 && !hasPendingRestore) {
            categoryInitializedRef.current = true;
            setMainCat(data.categories[0].name);
            setSelectedSubs(new Set(data.categories[0].subfolders.map((s) => s.name)));
          } else if (hasPendingRestore) {
            categoryInitializedRef.current = true;
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError("단어장 목록을 불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  // 외부에서 파일 조합을 복원 요청하면, 그 파일들이 들어있는 대분류/세부카테고리로
  // 전환하고 체크 상태까지 맞춘다. 트리가 아직 없으면(로딩 중) 로드된 뒤에 다시 시도된다.
  // restorePaths가 바뀔 때만 외부 요청을 React 상태로 동기화하는 것이라 setState를
  // 곧바로 호출해도 안전하다(SSR/하이드레이션 순서 문제 없음).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!tree || !restorePaths || restorePaths.length === 0) return;
    const pathSet = new Set(restorePaths);

    for (const cat of tree.categories) {
      if (cat.subfolders.length > 0) {
        const matchedSubs = new Set<string>();
        const matchedPaths = new Set<string>();
        for (const sub of cat.subfolders) {
          for (const f of sub.files) {
            if (pathSet.has(f.path)) {
              matchedSubs.add(sub.name);
              matchedPaths.add(f.path);
            }
          }
        }
        if (matchedPaths.size > 0) {
          setMainCat(cat.name);
          setSelectedSubs(matchedSubs);
          setCheckedPaths(matchedPaths);
          return;
        }
      } else {
        const matchedPaths = new Set(cat.files.filter((f) => pathSet.has(f.path)).map((f) => f.path));
        if (matchedPaths.size > 0) {
          setMainCat(cat.name);
          setSelectedSubs(new Set());
          setCheckedPaths(matchedPaths);
          return;
        }
      }
    }
  }, [tree, restorePaths]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  // 복원된 체크 파일이 속한 월 그룹을 자동으로 펼쳐서, 체크된 걸 스크롤 없이도 바로 보이게 한다.
  useEffect(() => {
    if (!restorePaths || restorePaths.length === 0) return;
    const pathSet = new Set(restorePaths);
    for (const group of monthGroups) {
      if (group.files.some((f) => pathSet.has(f.path))) {
        const el = detailsRefs.current.get(group.key);
        if (el) el.open = true;
      }
    }
  }, [monthGroups, restorePaths]);

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

  function setFilesChecked(paths: string[], checked: boolean) {
    setCheckedPaths((prev) => {
      const next = new Set(prev);
      for (const p of paths) {
        if (checked) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  }

  function monthAllChecked(files: FileRef[]): boolean {
    return files.length > 0 && files.every((f) => checkedPaths.has(f.path));
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
          <details
            key={group.key}
            ref={(el) => {
              if (el) detailsRefs.current.set(group.key, el);
              else detailsRefs.current.delete(group.key);
            }}
            open={idx === 0}
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "var(--card-border)" }}
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold select-none [&::-webkit-details-marker]:hidden"
              style={{ background: "var(--hint-bg)", color: "var(--text)" }}
            >
              <span>
                <span className="details-chevron mr-1 inline-block" style={{ color: "var(--text-muted)" }}>
                  ▸
                </span>
                {group.label} ({group.files.length}개)
              </span>
              <label
                className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  background: monthAllChecked(group.files) ? "var(--accent)" : "var(--card)",
                  color: monthAllChecked(group.files) ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${monthAllChecked(group.files) ? "var(--accent)" : "var(--card-border)"}`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={monthAllChecked(group.files)}
                  onChange={(e) => {
                    e.stopPropagation();
                    setFilesChecked(group.files.map((f) => f.path), e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 accent-white"
                />
                이 달 전체선택
              </label>
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
