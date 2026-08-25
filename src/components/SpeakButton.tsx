"use client";

/**
 * 브라우저 내장 음성 합성(Web Speech API)으로 단어 발음을 들려준다. 외부 API/과금 없이
 * 동작하고, 일본어 단어장 앱에서 뜻만 외우고 발음은 놓치기 쉬운 부분을 보완해준다.
 * 지원하지 않는 브라우저에서는 조용히 아무 동작도 하지 않는다.
 */
function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
  window.speechSynthesis.cancel(); // 이전 발화가 남아있으면 먼저 끊는다
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  window.speechSynthesis.speak(utter);
}

function SpeakerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      <path d="M16.5 12c0-1.77-.77-3.29-2-4.24v8.48c1.23-.95 2-2.47 2-4.24z" />
      <path d="M14.5 3.23v2.06c2.89 1.06 5 3.9 5 7.21s-2.11 6.15-5 7.21v2.06c4.01-1.09 7-4.98 7-9.27s-2.99-8.18-7-9.27z" />
    </svg>
  );
}

interface Props {
  text: string;
  lang?: string;
  /** true면 아이콘만 있는 작은 원형 버튼(즐겨찾기 별표 옆 등 좁은 자리용). */
  compact?: boolean;
}

export default function SpeakButton({ text, lang = "ja-JP", compact = false }: Props) {
  if (compact) {
    return (
      <button
        onClick={() => speak(text, lang)}
        aria-label="발음 듣기"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ color: "var(--text-muted)" }}
      >
        <SpeakerIcon size={16} />
      </button>
    );
  }
  return (
    <button onClick={() => speak(text, lang)} className="btn-3d btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
      <SpeakerIcon />
      발음 듣기
    </button>
  );
}
