"use client";

import { useState } from "react";
import { useUserId } from "@/hooks/useUserId";
import { useTheme } from "@/contexts/ThemeContext";
import { isSyncEnabled } from "@/lib/progress";

export default function SettingsPage() {
  const { userId, setUserId, ready } = useUserId();
  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);

  const displayValue = touched ? input : userId;
  const syncEnabled = isSyncEnabled();

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <h1 className="text-xl font-extrabold">설정</h1>

      <div className="mt-5 study-card p-4">
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
    </div>
  );
}
