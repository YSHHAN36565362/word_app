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
  /** 종료 버튼 옆에 나란히 둘 보조 버튼 (예: 단어 순서 섞기). */
  extraAction?: ExtraAction;
}) {
  const { setFocus } = useFocusMode();
  return (
    <div className="flex justify-center gap-2 py-6">
      {extraAction && (
        <button onClick={extraAction.onClick} className="btn-3d btn-ghost px-6 py-2.5 text-sm">
          {extraAction.label}
        </button>
      )}
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
