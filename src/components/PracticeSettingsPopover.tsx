"use client";

import { useState } from "react";
import { SCORE_BTN_SCALE_MAX, SCORE_BTN_SCALE_MIN } from "@/hooks/useScoreButtonPrefs";
import { ROUND_SIZE_MAX, ROUND_SIZE_MIN, ROUND_SIZE_STEP } from "@/hooks/useRoundSize";
import { ROUND_SIZE } from "@/lib/queue";
import { HINT_SCALE_MAX, HINT_SCALE_MIN, HINT_SCALE_STEP } from "@/lib/hintTheme";

interface Props {
  roundSize: number;
  onAdjustRound: (delta: number) => void;
  onResetRound: () => void;
  scale: number;
  onAdjustScale: (delta: number) => void;
  onResetScale: () => void;
  scoreHidden: boolean;
  onSetScoreHidden: (next: boolean) => void;
  hideMascot: boolean;
  onSetHideMascot: (next: boolean) => void;
  // 한자 부수 분해 등 힌트가 길어질수록 휴대폰 같은 작은 화면에서 잘 안 보인다는
  // 요청으로, 힌트 구간 전체를 다루는 "글자 크기 설정" 화면까지 안 가도 연습
  // 화면에서 바로 한자 크기를 키울 수 있게 했다. 처음 질문으로 나온 한자(카드 앞면),
  // 힌트의 [한자1]/[한자2]… 제목 줄, 그 아래 한자 분해 본문까지 세 가지가 함께
  // 조절된다 — 부모(practice/page.tsx)의 onAdjustKanjiScale/onResetKanjiScale이
  // 세 값을 같이 바꾼다.
  kanjiScale: number;
  onAdjustKanjiScale: (delta: number) => void;
  onResetKanjiScale: () => void;
}

const chip = { background: "var(--hint-bg)", color: "var(--text-muted)" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function RoundBtn({
  onClick,
  disabled,
  label,
  wide,
  ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  wide?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold whitespace-nowrap disabled:opacity-40 ${wide ? "px-2" : "w-6"}`}
      style={chip}
    >
      {label}
    </button>
  );
}

/**
 * 연습 화면의 설정을 톱니바퀴(⚙) 하나로 모은 팝오버. 예전에는 "애니메이션 끄기"
 * 체크박스가 진행바 위에 상시 노출돼 있고 채점 버튼 크기 조절은 따로 있었는데,
 * 학습 중에 늘 보일 필요가 없는 것들이라 한곳으로 합치고 화면 위쪽을 비웠다.
 * 라운드 크기 조절이 새로 들어왔다(한 번에 100~200개씩 하는 사람은 15개마다
 * 완료 화면이 끼어드는 게 오히려 흐름을 끊는다는 피드백).
 */
export default function PracticeSettingsPopover({
  roundSize,
  onAdjustRound,
  onResetRound,
  scale,
  onAdjustScale,
  onResetScale,
  scoreHidden,
  onSetScoreHidden,
  hideMascot,
  onSetHideMascot,
  kanjiScale,
  onAdjustKanjiScale,
  onResetKanjiScale,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="연습 설정"
        aria-expanded={open}
        className="flex h-6 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-bold"
        style={chip}
      >
        ⚙ 설정
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-max rounded-2xl p-2 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <Row label="라운드">
            <RoundBtn
              ariaLabel="라운드 크기 줄이기"
              label="−"
              onClick={() => onAdjustRound(-ROUND_SIZE_STEP)}
              disabled={roundSize <= ROUND_SIZE_MIN}
            />
            <span className="w-10 text-center text-[11px] font-bold" style={{ color: "var(--text)" }}>
              {roundSize}개
            </span>
            <RoundBtn
              ariaLabel="라운드 크기 늘리기"
              label="+"
              onClick={() => onAdjustRound(ROUND_SIZE_STEP)}
              disabled={roundSize >= ROUND_SIZE_MAX}
            />
            <RoundBtn ariaLabel="라운드 기본값" label={`기본 ${ROUND_SIZE}`} wide onClick={onResetRound} />
          </Row>

          <Row label="채점 버튼">
            <RoundBtn
              ariaLabel="채점 버튼 작게"
              label="−"
              onClick={() => onAdjustScale(-0.1)}
              disabled={scale <= SCORE_BTN_SCALE_MIN}
            />
            <span className="w-10 text-center text-[11px] font-bold" style={{ color: "var(--text)" }}>
              {Math.round(scale * 100)}%
            </span>
            <RoundBtn
              ariaLabel="채점 버튼 크게"
              label="+"
              onClick={() => onAdjustScale(0.1)}
              disabled={scale >= SCORE_BTN_SCALE_MAX}
            />
            <RoundBtn ariaLabel="채점 버튼 크기 기본값" label="기본값" wide onClick={onResetScale} />
          </Row>

          <Row label="한자 크기">
            <RoundBtn
              ariaLabel="한자 글자 작게"
              label="−"
              onClick={() => onAdjustKanjiScale(-HINT_SCALE_STEP)}
              disabled={kanjiScale <= HINT_SCALE_MIN}
            />
            <span className="w-10 text-center text-[11px] font-bold" style={{ color: "var(--text)" }}>
              {Math.round(kanjiScale * 100)}%
            </span>
            <RoundBtn
              ariaLabel="한자 글자 크게"
              label="+"
              onClick={() => onAdjustKanjiScale(HINT_SCALE_STEP)}
              disabled={kanjiScale >= HINT_SCALE_MAX}
            />
            <RoundBtn ariaLabel="한자 글자 크기 기본값" label="기본값" wide onClick={onResetKanjiScale} />
          </Row>

          <Row label="채점 버튼 표시">
            <RoundBtn
              ariaLabel="채점 버튼 숨기기"
              label="숨기기"
              wide
              onClick={() => onSetScoreHidden(true)}
              disabled={scoreHidden}
            />
            <RoundBtn
              ariaLabel="채점 버튼 나타내기"
              label="나타내기"
              wide
              onClick={() => onSetScoreHidden(false)}
              disabled={!scoreHidden}
            />
          </Row>

          <Row label="애니메이션">
            <RoundBtn
              ariaLabel="애니메이션 끄기"
              label="끄기"
              wide
              onClick={() => onSetHideMascot(true)}
              disabled={hideMascot}
            />
            <RoundBtn
              ariaLabel="애니메이션 켜기"
              label="켜기"
              wide
              onClick={() => onSetHideMascot(false)}
              disabled={!hideMascot}
            />
          </Row>
        </div>
      )}
    </div>
  );
}
