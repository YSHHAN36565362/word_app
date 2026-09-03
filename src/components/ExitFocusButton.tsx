"use client";

import { useFocusMode } from "@/contexts/FocusModeContext";

interface ExtraAction {
  label: string;
  onClick: () => void;
}

export default function ExitFocusButton({
  onExit,
  label = "종료하기",
  extraAction,
}: {
  onExit: () => void;
  label?: string;
  /** 종료 버튼 옆에 나란히 둘 보조 버튼(들) (예: 단어 순서 섞기, 되돌리기). 배열로 주면 여러 개를 순서대로 나열한다. */
  extraAction?: ExtraAction | ExtraAction[];
}) {
  const { setFocus } = useFocusMode();
  const extras = extraAction ? (Array.isArray(extraAction) ? extraAction : [extraAction]) : [];
  return (
    <div className="flex justify-center gap-2 py-6">
      {extras.map((a) => (
        <button key={a.label} onClick={a.onClick} className="btn-3d btn-ghost px-6 py-2.5 text-sm">
          {a.label}
        </button>
      ))}
      <button
        onClick={() => {
          setFocus(false);
          onExit();
        }}
        className="btn-3d btn-ghost px-6 py-2.5 text-sm"
      >
        {label}
      </button>
    </div>
  );
}
