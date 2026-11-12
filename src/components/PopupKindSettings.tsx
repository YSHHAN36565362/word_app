"use client";

import { useState } from "react";
import { usePopupKinds } from "@/hooks/usePopupKinds";
import { POPUP_KINDS } from "@/lib/popupKinds";

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
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id, !on)}
            aria-pressed={on}
            aria-label={`${k.label} 팝업 ${on ? "끄기" : "켜기"}`}
            className="flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold whitespace-nowrap"
            style={{
              background: on ? "var(--accent)" : "var(--hint-bg)",
              color: on ? "#fff" : "var(--text-muted)",
            }}
          >
            {k.label}
          </button>
        );
      })}
    </div>
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
          <div className="mb-1 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
            누르면 뜻이 뜨는 단어 종류
          </div>
          <PopupKindChips />
        </div>
      )}
    </div>
  );
}
