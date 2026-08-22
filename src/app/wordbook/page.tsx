"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryNode, WordTree } from "@/lib/types";

function defaultTitlePrefix(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-");
  return `${parts[0]}-${parts[1]}-${parts[2]}_`;
}

export default function WordbookPage() {
  const [tree, setTree] = useState<WordTree | null>(null);
  const [mainCat, setMainCat] = useState<string>("");
  const [subCatOverride, setSubCatOverride] = useState<string | null>(null);
  const [title, setTitle] = useState(defaultTitlePrefix());
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/wordlist/tree")
      .then((r) => r.json())
      .then((data: WordTree) => {
        setTree(data);
        if (data.categories.length > 0) setMainCat(data.categories[0].name);
      });
  }, []);

  const currentCategory: CategoryNode | undefined = useMemo(
    () => tree?.categories.find((c) => c.name === mainCat),
    [tree, mainCat]
  );

  // 대분류가 바뀌면 하위 폴더는 그 카테고리의 첫 번째 폴더를 기본값으로 쓰고,
  // 사용자가 직접 고른 값(override)이 있으면 그것을 우선한다. 별도 effect 없이 렌더 중 계산한다.
  const subCat = subCatOverride ?? currentCategory?.subfolders[0]?.name ?? "";

  function selectMainCat(name: string) {
    setMainCat(name);
    setSubCatOverride(null);
  }

  const targetFolder = currentCategory
    ? currentCategory.subfolders.length > 0
      ? `word_list/${mainCat}/${subCat}`
      : `word_list/${mainCat}`
    : "";

  async function submit() {
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/wordbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetFolder, title, content, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus({ type: "ok", msg: `업로드 완료: ${data.path} (${data.count}개 단어)` });
        setContent("");
      } else {
        setStatus({ type: "err", msg: data.error + (data.errors ? "\n" + data.errors.join("\n") : "") });
      }
    } catch {
      setStatus({ type: "err", msg: "네트워크 오류가 발생했습니다." });
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">단어장 추가</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        새로운 단어장 파일(.txt)을 GitHub 저장소에 업로드합니다.
      </p>

      {tree && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              대분류
            </label>
            <select
              value={mainCat}
              onChange={(e) => selectMainCat(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
            >
              {tree.categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {currentCategory && currentCategory.subfolders.length > 0 && (
            <div>
              <label className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                하위 폴더
              </label>
              <select
                value={subCat}
                onChange={(e) => setSubCatOverride(e.target.value)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
              >
                {currentCategory.subfolders.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        현재 폴더: {targetFolder}
      </div>

      <div className="mt-4">
        <label className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          파일 제목
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 2026-08-23_N2"
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
      </div>

      <div className="mt-4">
        <label className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          단어 : 뜻, 다음 줄에 힌트 (또는 단어 / 뜻 / 힌트를 각 줄에)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-mono"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
      </div>

      <div className="mt-4">
        <label className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          업로드 비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
      </div>

      {status && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm whitespace-pre-line"
          style={{ background: "var(--hint-bg)", color: status.type === "ok" ? "var(--accent)" : "var(--red)" }}
        >
          {status.msg}
        </div>
      )}

      <button onClick={submit} disabled={submitting || !targetFolder || !content.trim()} className="btn-3d btn-accent mt-5 w-full">
        {submitting ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
