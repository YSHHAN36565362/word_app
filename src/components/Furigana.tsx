"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface KanjiInfo {
  c: string;
  h: string;
  j: string;
  e: string;
}

interface Tok {
  s: string;
  r: string | null;
  k?: KanjiInfo[];
}

const KANJI = /[一-鿿々]/;

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
 * 일본어 문장 안의 한자에 마우스를 올리면 히라가나 읽기를 툴팁으로 띄운다.
 * 툴팁에는 읽기와 함께 한자별 정보(한국 한자음 · 일본 음독/훈독 · 영어 뜻)도 보여준다.
 * 한자가 없는 문장은 서버에 묻지 않고 그대로 출력한다. enabled=false(예: 블러로 가려둔 줄)면
 * 읽기가 보이지 않도록 일반 글자로만 출력한다.
 */
export default function Furigana({ text, enabled = true }: { text: string; enabled?: boolean }) {
  const [loaded, setLoaded] = useState<{ text: string; toks: Tok[] } | null>(() => {
    const hit = cache.get(text);
    return hit ? { text, toks: hit } : null;
  });
  const [tip, setTip] = useState<{ r: string; k: KanjiInfo[]; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled || !KANJI.test(text)) return;
    let alive = true;
    load(text).then((toks) => {
      if (alive && toks) setLoaded({ text, toks });
    });
    return () => {
      alive = false;
    };
  }, [text, enabled]);

  if (!enabled || !loaded || loaded.text !== text) return <>{text}</>;

  return (
    <>
      {loaded.toks.map((t, i) =>
        t.r ? (
          <span
            key={i}
            className="furi-token"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTip({ r: t.r as string, k: t.k ?? [], x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseLeave={() => setTip(null)}
          >
            {t.s}
          </span>
        ) : (
          <span key={i}>{t.s}</span>
        )
      )}
      {tip &&
        createPortal(
          <div className="furi-tip" style={{ left: tip.x, top: tip.y - 6 }}>
            <div className="furi-read">{tip.r}</div>
            {tip.k.map((k) => (
              <div key={k.c} className="furi-kanji">
                <b>{k.c}</b> {k.h && <span className="furi-hangul">{k.h}</span>}
                {k.j && <span> · {k.j}</span>}
                {k.e && <span className="furi-en"> · {k.e}</span>}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
