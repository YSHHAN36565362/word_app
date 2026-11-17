"use client";

import { useEffect } from "react";
import { usePopupOptions } from "@/hooks/usePopupKinds";
import { loadPopupOptions } from "@/lib/popupKinds";

const CACHE_PREFIX = "word-app-offline";

/**
 * 설정의 "오프라인 저장"에 맞춰 서비스 워커(public/sw.js)를 등록하거나 해제한다. 화면에는 아무것도 그리지 않는다.
 * - 켜면: 그때부터 연 화면·단어장·문장 정보가 기기에 저장되어 네트워크가 끊겨도 다시 열 수 있다.
 * - 끄면: 서비스 워커를 해제하고 저장해 둔 사본을 지운다.
 */
export default function OfflineManager() {
  const [opts] = usePopupOptions();
  const on = opts.offline;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // 훅의 값은 첫 렌더에서 기본값(꺼짐)이라, 저장된 값을 직접 읽는다 — 그러지 않으면 화면을 열 때마다 사본을 지우게 된다.
    if (loadPopupOptions().offline) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* 등록에 실패해도(사생활 보호 모드 등) 평소처럼 온라인으로 동작한다 */
      });
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => (typeof caches === "undefined" ? [] : caches.keys()))
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k))))
      .catch(() => {
        /* 지우지 못해도 다음에 끌 때 다시 시도한다 */
      });
  }, [on]);

  return null;
}
