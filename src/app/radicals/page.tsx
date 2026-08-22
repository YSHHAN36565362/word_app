"use client";

import { useEffect, useState } from "react";
import { RadicalLibrary } from "@/lib/types";

export default function RadicalsPage() {
  const [library, setLibrary] = useState<RadicalLibrary>({});
  const [loading, setLoading] = useState(true);

  const [seedPw, setSeedPw] = useState("");
  const [seedMsg, setSeedMsg] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);

  const [char, setChar] = useState("");
  const [reading, setReading] = useState("");
  const [desc, setDesc] = useState("");
  const [addPw, setAddPw] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const [delPw, setDelPw] = useState("");
  const [delMsg, setDelMsg] = useState("");

  useEffect(() => {
    fetch("/api/radicals")
      .then((r) => r.json())
      .then((data) => {
        setLibrary(data.library || {});
        setLoading(false);
      });
  }, []);

  async function loadSeed() {
    setSeedBusy(true);
    setSeedMsg("");
    const res = await fetch("/api/radicals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: seedPw }),
    });
    const data = await res.json();
    setSeedBusy(false);
    if (data.ok) {
      setLibrary(data.library);
      setSeedMsg("기본 세트를 추가했습니다.");
    } else {
      setSeedMsg(data.error || "실패했습니다.");
    }
  }

  async function addChar() {
    setAddBusy(true);
    setAddMsg("");
    const res = await fetch("/api/radicals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ char, reading, desc, password: addPw }),
    });
    const data = await res.json();
    setAddBusy(false);
    if (data.ok) {
      setLibrary(data.library);
      setAddMsg(`'${char}' 저장했습니다.`);
      setChar("");
      setReading("");
      setDesc("");
    } else {
      setAddMsg(data.error || "실패했습니다.");
    }
  }

  async function removeChar(ch: string) {
    setDelMsg("");
    const res = await fetch("/api/radicals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ char: ch, password: delPw }),
    });
    const data = await res.json();
    if (data.ok) {
      setLibrary(data.library);
      setDelMsg(`'${ch}' 삭제했습니다.`);
    } else {
      setDelMsg(data.error || "실패했습니다.");
    }
  }

  const entries = Object.entries(library).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">한자 풀이 사전</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        여기 등록한 한자는 그 글자가 들어있는 모든 단어의 학습 화면에 &quot;한자 풀이&quot;로 자동 표시됩니다.
      </p>

      <div className="mt-4 text-sm font-bold">현재 등록된 글자 수: {loading ? "..." : entries.length}개</div>

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">1. 214개 한 번에 불러오기</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          강희자전 부수 214개 전체를 채워 넣습니다 (이미 있는 글자는 건드리지 않음).
        </p>
        <input
          type="password"
          placeholder="업로드 비밀번호"
          value={seedPw}
          onChange={(e) => setSeedPw(e.target.value)}
          className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
        <button onClick={loadSeed} disabled={seedBusy || !seedPw} className="btn-3d btn-blue mt-3 w-full">
          {seedBusy ? "불러오는 중..." : "기본 세트 추가하기"}
        </button>
        {seedMsg && <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{seedMsg}</div>}
      </div>

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">2. 글자 하나씩 직접 추가 / 수정</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            placeholder="한자 (한 글자)"
            value={char}
            maxLength={1}
            onChange={(e) => setChar(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
          />
          <input
            placeholder="훈음 (예: 물 수)"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
          />
        </div>
        <textarea
          placeholder="설명"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
        <input
          type="password"
          placeholder="업로드 비밀번호"
          value={addPw}
          onChange={(e) => setAddPw(e.target.value)}
          className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
        <button onClick={addChar} disabled={addBusy || !char.trim() || !addPw} className="btn-3d btn-accent mt-3 w-full">
          {addBusy ? "저장 중..." : "저장"}
        </button>
        {addMsg && <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{addMsg}</div>}
      </div>

      <div className="mt-5">
        <div className="text-sm font-bold mb-2">등록된 글자 목록 ({entries.length}개)</div>
        <input
          type="password"
          placeholder="삭제할 때 사용할 비밀번호"
          value={delPw}
          onChange={(e) => setDelPw(e.target.value)}
          className="mb-2 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--hint-bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}
        />
        {delMsg && <div className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>{delMsg}</div>}
        <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto">
          {entries.map(([ch, info]) => (
            <div key={ch} className="study-card flex items-center justify-between px-4 py-2.5">
              <div className="text-sm min-w-0 truncate">
                <b>{ch}</b> ({info.reading}) — {info.desc}
              </div>
              <button onClick={() => removeChar(ch)} disabled={!delPw} className="btn-3d btn-red shrink-0 px-3 py-1.5 text-xs ml-2">
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
