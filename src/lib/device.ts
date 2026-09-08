"use client";

/**
 * 같은 번호를 여러 기기(맥북/데스크탑/아이폰/아이패드 등)에서 쓸 때, 예전에는 나중에
 * 저장한 기기가 이전 기기의 진행을 조용히 덮어썼다("전에는 잘 됐는데 어느 순간부터
 * 동기화가 안 된다"는 제보의 원인 — progress/learning_log가 (user, part, file_key)
 * 하나당 행을 하나만 가져서, 두 기기가 같은 조합을 다루면 마지막에 저장한 쪽이
 * 이겼다). 기기마다 이 device_id를 붙여 별도 행으로 저장해두면, 여러 기기의 기록을
 * 전부 보존하고 사용자가 직접 보고 고를 수 있다.
 */

const ID_KEY = "word_app_device_id";
const LABEL_KEY = "word_app_device_label";
const GUESS_CACHE_KEY = "word_app_device_guess_cache";

// 브라우저는 지문 추적을 막으려고 정확한 기종명을 대부분 숨긴다 — 맥/윈도우/아이폰
// 모두 "Macintosh"/"Windows"/"iPhone"처럼 큰 분류만 알려주고, 이건 어떤 웹사이트도
// 코드로 우회할 방법이 없다(브라우저 자체의 의도된 제약). 유일한 예외가 안드로이드의
// Client Hints API로, 사용자가 허용하면 실제 기종명(예: SM-S918N)까지 알 수 있다.
// 비동기 API라 즉시 쓸 수는 없어서 결과가 오면 캐시에 남겨두고, 다음번
// guessDeviceLabel() 호출(예: 다음 페이지 이동)부터 반영된다.
function refineAndroidModelAsync(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  try {
    if (window.localStorage.getItem(LABEL_KEY) || window.localStorage.getItem(GUESS_CACHE_KEY)) return;
  } catch {
    return;
  }
  const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(hints: string[]): Promise<{ model?: string }> } }).userAgentData;
  if (!uaData) return;
  uaData
    .getHighEntropyValues(["model"])
    .then((info) => {
      const model = info.model?.trim();
      if (!model) return;
      try {
        window.localStorage.setItem(GUESS_CACHE_KEY, `안드로이드 (${model})`);
      } catch {
        /* 무시 */
      }
    })
    .catch(() => {
      /* Client Hints 미지원 브라우저 — 조용히 무시 */
    });
}

function guessDeviceLabel(): string {
  if (typeof navigator === "undefined") return "이 기기";
  try {
    const cached = window.localStorage.getItem(GUESS_CACHE_KEY);
    if (cached) return cached;
  } catch {
    /* 무시 */
  }
  refineAndroidModelAsync();
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)) return "아이패드";
  if (/iPhone/.test(ua)) return "아이폰";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "안드로이드 폰";
  if (/Android/.test(ua)) return "안드로이드 태블릿";
  if (/Macintosh/.test(ua)) return "맥";
  if (/Windows/.test(ua)) return "윈도우 PC";
  return "이 기기";
}

/** 이 브라우저(기기)를 가리키는 값 — 한 번 만들어지면 계속 localStorage에 남아있다. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** 사용자가 직접 정할 수 있는 기기 이름. 안 정했으면 기기 종류를 추측해서 보여준다. */
export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "이 기기";
  try {
    return window.localStorage.getItem(LABEL_KEY) || guessDeviceLabel();
  } catch {
    return "이 기기";
  }
}

export function setDeviceLabel(label: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LABEL_KEY, label.trim().slice(0, 30));
  } catch {
    /* 무시 */
  }
}
