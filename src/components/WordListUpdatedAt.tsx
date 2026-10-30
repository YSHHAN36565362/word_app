const UPDATED_AT = process.env.NEXT_PUBLIC_WORDLIST_UPDATED_AT;

// 한국 시간 기준 "YYYY.MM.DD.HH.mm" 으로 만든다(서버·클라이언트 어디서 렌더해도 같은 결과).
function format(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}.${get("hour")}.${get("minute")}`;
}

/** 모든 화면 오른쪽 위에 작게 보이는 "마지막 단어장 업데이트" 시각. 라이트=검정, 다크=흰색. */
export default function WordListUpdatedAt() {
  const text = UPDATED_AT ? format(UPDATED_AT) : null;
  if (!text) return null;
  return (
    <div
      className="pointer-events-none fixed right-2 z-50 text-[10px] leading-none tabular-nums"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 4px)", color: "var(--update-stamp)" }}
      aria-label={`마지막 단어장 업데이트 ${text}`}
    >
      {text}
    </div>
  );
}
