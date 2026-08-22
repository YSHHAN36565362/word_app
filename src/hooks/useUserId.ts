"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStoredUserId, sanitizeUserId, storeUserId } from "@/lib/userId";

export function useUserId() {
  const [userId, setUserIdState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage/URL 쿼리는 서버에 없으므로, hydration 불일치를 피하기 위해
    // 빈 문자열로 먼저 렌더한 뒤 마운트 후에만 실제 값으로 갱신한다.
    /* eslint-disable react-hooks/set-state-in-effect */
    setUserIdState(loadStoredUserId());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setUserId = useCallback((raw: string) => {
    const clean = sanitizeUserId(raw);
    setUserIdState(clean);
    storeUserId(clean);
  }, []);

  return { userId, setUserId, ready };
}
