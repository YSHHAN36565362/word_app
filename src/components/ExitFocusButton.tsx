"use client";

import { useFocusMode } from "@/contexts/FocusModeContext";

export default function ExitFocusButton({ onExit, label = "종료하기" }: { onExit: () => void; label?: string }) {
  const { setFocus } = useFocusMode();
  return (
    <div className="flex justify-center py-6">
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
