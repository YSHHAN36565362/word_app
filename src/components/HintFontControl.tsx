"use client";

import FontSizeControl from "@/components/FontSizeControl";
import { useFontScale } from "@/hooks/useFontScale";

/**
 * 힌트 글자만 따로 키우고 줄이는 컨트롤. 단어/뜻 글자 크기(각 화면의 A−/A+)와 별개로,
 * `--hint-font-scale` 값을 힌트 상자 글자 크기에 곱해 쓴다. 힌트 상자 바로 위에 둔다.
 */
export default function HintFontControl() {
  const { fontScale, setFontScale, adjustFontScale } = useFontScale("word_app_hint_font_scale", "--hint-font-scale");
  return (
    <div className="mt-2 flex items-center justify-end gap-1.5">
      <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
        힌트 글자
      </span>
      <FontSizeControl fontScale={fontScale} onAdjust={adjustFontScale} onReset={() => setFontScale(1)} />
    </div>
  );
}
