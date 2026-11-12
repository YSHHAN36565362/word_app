"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { plainFront } from "@/lib/queue";
import { usePopupKinds } from "@/hooks/usePopupKinds";
import type { PopupKind } from "@/lib/popupKinds";

interface KanjiInfo {
  c: string;
  h: string;
  j: string;
  e: string;
}

// 한자 없이 쓰인 단어의 뜻
interface KanaWord {
  e: string;
  k?: string;
  ko?: string;
}

interface Tok {
  s: string;
  r: string | null;
  k?: KanjiInfo[];
  c?: PopupKind; // 팝업 종류(없으면 팝업이 없는 조각)
  b?: string; // 가나 단어의 기본형
  w?: KanaWord;
}

interface Tip {
  tok: Tok;
  x: number; // 글자 가운데(가로)
  top: number; // 글자 위쪽
  bottom: number; // 글자 아래쪽
}

// 일본어 글자가 하나도 없는 문장(한국어 뜻풀이 등)은 서버에 묻지 않는다.
const JAPANESE = /[ぁ-ゖァ-ヶ一-鿿々]/;

// 예시 단어: [표기, 읽기, 영어 뜻]. 팝업을 열 때 그 한자들만 서버에서 받아 브라우저 메모리에 둔다.
type Word = [string, string, string];
const exCache = new Map<string, Word[]>();
const exPending = new Map<string, Promise<void>>();

function ensureExamples(chars: string[]): Promise<void> {
  const need = chars.filter((c) => !exCache.has(c));
  if (need.length === 0) return Promise.resolve();
  const key = need.join("");
  const running = exPending.get(key);
  if (running) return running;
  const job = fetch(`/api/kanji-words?c=${encodeURIComponent(key)}`)
    .then((res) => (res.ok ? (res.json() as Promise<Record<string, Word[]>>) : null))
    .then((data) => {
      if (data) for (const c of need) exCache.set(c, data[c] ?? []);
    })
    .catch(() => {
      /* 실패해도 예시만 안 보일 뿐이다. 다음에 열 때 다시 시도한다. */
    })
    .finally(() => exPending.delete(key));
  exPending.set(key, job);
  return job;
}

const MAX_EXAMPLES = 10; // 읽기(음독·훈독) 하나당 단어 하나씩이라 한자에 따라 여러 줄이 된다.

// 같은 문장은 한 번만 물어본다(브라우저 메모리). 한 화면에서 여러 줄이 동시에 요청하면
// 30ms 모아서 한 번의 요청으로 보낸다.
const cache = new Map<string, Tok[]>();
const waiting = new Map<string, ((t: Tok[] | null) => void)[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  const batch = [...waiting.entries()];
  waiting.clear();
  for (let i = 0; i < batch.length; i += 80) {
    const part = batch.slice(i, i + 80);
    let results: Tok[][] | null = null;
    try {
      const res = await fetch("/api/furigana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: part.map(([t]) => t) }),
      });
      if (res.ok) results = (await res.json()).results as Tok[][];
    } catch {
      /* 네트워크 오류면 읽기 없이 그대로 보여준다 */
    }
    part.forEach(([text, resolvers], k) => {
      const toks = results?.[k] ?? null;
      if (toks) cache.set(text, toks);
      resolvers.forEach((fn) => fn(toks));
    });
  }
}

function load(text: string): Promise<Tok[] | null> {
  const hit = cache.get(text);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const list = waiting.get(text) ?? [];
    list.push(resolve);
    waiting.set(text, list);
    if (!flushTimer) flushTimer = setTimeout(flush, 30);
  });
}

/**
 * 일본어 문장 안의 단어에 마우스를 올리거나(컴퓨터) 탭하면(휴대폰) 툴팁을 띄운다.
 * - 한자가 든 단어: 히라가나 읽기 + 한자별 정보(한국 한자음 · 음독/훈독 · 영어 뜻) + 읽기별 예시 단어
 * - 한자 없이 쓰인 부사·접속사·동사·형용사·명사·가타카나어: 기본형 · 한자 표기 · 뜻
 * 종류별로 켜고 끌 수 있다(usePopupKinds — 학습·연습 화면의 설정).
 *
 * - 한자가 없는 문장은 서버에 묻지 않고 그대로 출력한다.
 * - enabled=false(예: 블러로 가려둔 줄, 정답 확인 전 문제)면 읽기가 보이지 않는다. 읽기는 미리 받아
 *   두므로 enabled가 true로 바뀌는 순간 바로 탭할 수 있다.
 * - 한자를 탭할 때는 이벤트가 바깥(블러 토글 등)으로 번지지 않게 막는다 — 휴대폰에서 한자를 눌렀는데
 *   블러만 다시 켜지는 문제를 막기 위함이다. 툴팁은 화면 안에 들어오도록 위치를 보정한다.
 */
export default function Furigana({ text: rawText, enabled = true }: { text: string; enabled?: boolean }) {
  // 면접 카드의 【키워드】 칸·{번호|…} 표시는 목록 등 다른 화면에서는 걷어 내고 보통 글로 보여준다.
  const text = plainFront(rawText);
  const [loaded, setLoaded] = useState<{ text: string; toks: Tok[] } | null>(() => {
    const hit = cache.get(text);
    return hit ? { text, toks: hit } : null;
  });
  const [tip, setTip] = useState<Tip | null>(null);
  const [kindsOff] = usePopupKinds();
  const [exTick, setExTick] = useState(0); // 예시 단어가 도착하면 팝업을 다시 그리고 위치를 다시 잡는다.
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!JAPANESE.test(text)) return;
    let alive = true;
    load(text).then((toks) => {
      if (alive && toks) setLoaded({ text, toks });
    });
    return () => {
      alive = false;
    };
  }, [text]);

  // 툴팁이 떠 있는 동안 바깥을 누르거나 스크롤하면 닫는다.
  useEffect(() => {
    if (!tip) return;
    const close = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest && el.closest(".furi-token, .furi-tip")) return;
      setTip(null);
    };
    // 팝업 안을 스크롤할 때(예시가 많아 길어진 경우)는 닫지 않는다.
    const closeOnScroll = (e: Event) => {
      const el = e.target as Node | null;
      if (el && tipRef.current && tipRef.current.contains(el)) return;
      setTip(null);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [tip]);

  // 툴팁이 화면 밖으로 나가지 않게 가로 위치를 보정하고, 위쪽이 모자라면 글자 아래에 띄운다.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!tip || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const left = Math.max(8, Math.min(tip.x - w / 2, vw - w - 8));
    let top = tip.top - h - 6;
    if (top < 8) top = tip.bottom + 6;
    // 예시 단어가 붙어 팝업이 길어져도 화면 아래로 잘리지 않게 한다.
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [tip, exTick]);

  if (!enabled || !loaded || loaded.text !== text) return <>{text}</>;

  function open(t: Tok, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setTip({ tok: t, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
    const kanji = t.k ?? [];
    if (kanji.length) ensureExamples(kanji.map((k) => k.c)).then(() => setExTick((n) => n + 1));
  }

  return (
    <>
      {loaded.toks.map((t, i) =>
        t.c && !kindsOff.has(t.c) ? (
          <span
            key={i}
            className="furi-token"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") open(t, e.currentTarget);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setTip(null);
            }}
            onClick={(e) => {
              e.stopPropagation(); // 블러 토글 등 바깥 클릭 동작이 같이 실행되지 않게
              open(t, e.currentTarget);
            }}
          >
            {t.s}
          </span>
        ) : (
          <span key={i}>{t.s}</span>
        )
      )}
      {tip &&
        createPortal(
          <div
            ref={tipRef}
            className="furi-tip"
            style={{ visibility: "hidden", left: 0, top: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {tip.tok.r ? (
              <div className="furi-read">{tip.tok.r}</div>
            ) : (
              <div className="furi-read">
                {tip.tok.b ?? tip.tok.s}
                {tip.tok.w?.k && <span className="furi-word-kanji"> 【{tip.tok.w.k}】</span>}
              </div>
            )}
            {tip.tok.w && (
              <div className="furi-kanji">
                {tip.tok.w.ko && <div className="furi-hangul">{tip.tok.w.ko}</div>}
                <div className="furi-en">{tip.tok.w.e}</div>
              </div>
            )}
            {(tip.tok.k ?? []).map((k) => (
              <div key={k.c} className="furi-kanji">
                <div>
                  <b>{k.c}</b> {k.h && <span className="furi-hangul">{k.h}</span>}
                  {k.j && <span> · {k.j}</span>}
                  {k.e && <span className="furi-en"> · {k.e}</span>}
                </div>
                {(exCache.get(k.c) ?? []).slice(0, MAX_EXAMPLES).map(([w, r, g]) => (
                  <div key={w} className="furi-ex">
                    <span className="furi-ex-w">{w}</span> <span>{r}</span>
                    <span className="furi-en"> · {g}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
