"use client";

import { useEffect, useState } from "react";
import { POPUP_KINDS_EVENT, loadPopupKindsOff, savePopupKindsOff, type PopupKind } from "@/lib/popupKinds";

/**
 * 단어 팝업 종류별 켬/끔. 학습·연습 어디서 바꿔도 같은 값을 쓰도록 localStorage에 두고,
 * 같은 화면 안의 다른 컴포넌트(문장마다 있는 Furigana)에는 커스텀 이벤트로 알린다.
 * 반환: [꺼 둔 종류 집합, 종류 하나를 켜거나 끄는 함수]
 */
export function usePopupKinds(): [ReadonlySet<PopupKind>, (kind: PopupKind, on: boolean) => void] {
  const [off, setOff] = useState<ReadonlySet<PopupKind>>(() => new Set());

  useEffect(() => {
    const sync = () => setOff(new Set(loadPopupKindsOff()));
    sync();
    window.addEventListener(POPUP_KINDS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(POPUP_KINDS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function set(kind: PopupKind, on: boolean) {
    const next = new Set(loadPopupKindsOff());
    if (on) next.delete(kind);
    else next.add(kind);
    savePopupKindsOff([...next]);
  }

  return [off, set];
}
