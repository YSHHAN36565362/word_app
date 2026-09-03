"use client";

import { useHintTheme } from "@/hooks/useHintTheme";
import {
  HINT_COLOR_PRESETS,
  HINT_SCALE_MAX,
  HINT_SCALE_MIN,
  HINT_SCALE_STEP,
  HINT_SECTIONS,
} from "@/lib/hintTheme";

const chip = { background: "var(--hint-bg)", color: "var(--text-muted)" } as const;

/**
 * 힌트 구간별 표시 설정 UI. 구간마다 "보이기/숨기기 · 색 · 크기"를 정하고,
 * 바로 아래에 실제 그 스타일이 적용된 예시 줄을 같이 보여줘서 결과를 즉시 확인할 수 있다.
 */
export default function HintThemeSettings() {
  const { theme, update, reset } = useHintTheme();

  return (
    <div className="study-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">힌트 표시 설정</div>
        <button onClick={reset} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={chip}>
          전체 기본값
        </button>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        단어 힌트에 나오는 구간별로 색·크기를 정하고, 필요 없는 설명은 숨길 수 있습니다.
        (이 기기에만 저장되고 단어장 원본은 그대로입니다)
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {HINT_SECTIONS.map((s) => {
          const st = theme[s.key];
          return (
            <div key={s.key} className="rounded-xl p-2.5" style={{ background: "var(--hint-bg)" }}>
              <div className="flex items-center justify-between gap-2">
                <label className="flex min-w-0 items-center gap-1.5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={st.visible}
                    onChange={(e) => update(s.key, { visible: e.target.checked })}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="truncate">{s.label}</span>
                </label>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => update(s.key, { scale: st.scale - HINT_SCALE_STEP })}
                    disabled={!st.visible || st.scale <= HINT_SCALE_MIN}
                    aria-label={`${s.label} 글자 작게`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold disabled:opacity-40"
                    style={{ background: "var(--card)", color: "var(--text-muted)" }}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                    {Math.round(st.scale * 100)}%
                  </span>
                  <button
                    onClick={() => update(s.key, { scale: st.scale + HINT_SCALE_STEP })}
                    disabled={!st.visible || st.scale >= HINT_SCALE_MAX}
                    aria-label={`${s.label} 글자 크게`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold disabled:opacity-40"
                    style={{ background: "var(--card)", color: "var(--text-muted)" }}
                  >
                    +
                  </button>
                </div>
              </div>

              {st.visible && (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {HINT_COLOR_PRESETS.map((c) => (
                      <button
                        key={c.label}
                        onClick={() => update(s.key, { color: c.value })}
                        aria-label={`${s.label} 색상 ${c.label}`}
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          background: st.color === c.value ? "var(--card)" : "transparent",
                          color: c.value || "var(--text)",
                          border: `1px solid ${st.color === c.value ? "var(--card-border)" : "transparent"}`,
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div
                    className="mt-1.5 truncate rounded-lg px-2 py-1"
                    style={{
                      background: "var(--card)",
                      color: st.color || "var(--text)",
                      fontSize: `calc(0.75rem * ${st.scale})`,
                    }}
                  >
                    {s.sample}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
