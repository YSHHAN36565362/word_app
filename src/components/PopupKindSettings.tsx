"use client";

import { useState } from "react";
import { usePopupKinds, usePopupOptions } from "@/hooks/usePopupKinds";
import { POPUP_KINDS, POPUP_OPTIONS } from "@/lib/popupKinds";

function Chip({ on, label, ariaLabel, onClick }: { on: boolean; label: string; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={ariaLabel}
      className="flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold whitespace-nowrap"
      style={{
        background: on ? "var(--accent)" : "var(--hint-bg)",
        color: on ? "#fff" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * 단어 팝업을 종류별로 켜고 끄는 칩 묶음. 누를 때마다 바로 저장되고 화면의 문장에 곧바로 반영된다.
 * 연습 화면에서는 ⚙ 설정 팝오버 안에, 학습 화면에서는 PopupKindButton 으로 띄운다.
 */
export function PopupKindChips() {
  const [off, setKind] = usePopupKinds();
  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {POPUP_KINDS.map((k) => {
        const on = !off.has(k.id);
        return <Chip key={k.id} on={on} label={k.label} ariaLabel={`${k.label} 팝업 ${on ? "끄기" : "켜기"}`} onClick={() => setKind(k.id, !on)} />;
      })}
    </div>
  );
}

/** 한국어 뜻 · JLPT 급수 · 오프라인 저장 켬/끔 칩. */
export function PopupOptionChips() {
  const [opts, setOption] = usePopupOptions();
  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {POPUP_OPTIONS.map((o) => {
        const on = opts[o.id];
        return <Chip key={o.id} on={on} label={o.label} ariaLabel={`${o.label} ${on ? "끄기" : "켜기"}`} onClick={() => setOption(o.id, !on)} />;
      })}
    </div>
  );
}

/** 설정 창에 넣는 묶음: 팝업 종류 + 옵션. 연습 "⚙ 설정"과 학습 "⚙ 팝업"이 같이 쓴다. */
export function PopupSettingsBlock() {
  const label = "mb-1 text-[11px] font-bold";
  return (
    <>
      <div className={label} style={{ color: "var(--text-muted)" }}>
        누르면 뜻이 뜨는 단어 종류
      </div>
      <PopupKindChips />
      <div className={`${label} mt-2`} style={{ color: "var(--text-muted)" }}>
        표시 · 저장
      </div>
      <PopupOptionChips />
    </>
  );
}

/** 학습 화면용: "팝업" 버튼을 누르면 종류 칩이 펼쳐진다. */
export default function PopupKindButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="단어 팝업 설정"
        aria-expanded={open}
        className="rounded-full px-3 py-1 text-[11px] font-bold"
        style={{ background: "var(--hint-bg)", color: "var(--text-muted)" }}
      >
        ⚙ 팝업
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 rounded-2xl p-2 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <PopupSettingsBlock />
        </div>
      )}
    </div>
  );
}
