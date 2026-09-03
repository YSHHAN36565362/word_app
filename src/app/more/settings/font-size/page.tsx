"use client";

import PageHeader from "@/components/PageHeader";
import FontSizeControl from "@/components/FontSizeControl";
import HintThemeSettings from "@/components/HintThemeSettings";
import { useFontScale } from "@/hooks/useFontScale";

/**
 * 힌트/한자 등 "글자 크기·색상" 관련 설정을 한곳에 모은 전용 페이지.
 * 예전엔 메인 설정 화면에 다 같이 있었는데, 화면 테마·내 번호 같은 핵심 설정이
 * 힌트 표시 설정(구간이 9개)에 묻혀버린다는 지적으로 이 페이지로 분리했다.
 *
 * 학습/연습/시험/지문 각 파트는 카드 앞면(문제) 글자 크기를 독립적으로
 * sessionStorage에 저장한다(useFontScale, 파트별로 다른 key). 이 페이지에서
 * 바꿔도 각 파트 화면에 있는 인라인 −/+/기본값 컨트롤과 완전히 같은 값을
 * 공유한다 — 같은 브라우저 탭 안에서는 어느 쪽에서 바꾸든 즉시 반영된다.
 */
export default function FontSizeSettingsPage() {
  const study = useFontScale("word_app_study_font_scale", "--study-font-scale");
  const practice = useFontScale("word_app_practice_font_scale", "--practice-font-scale");
  const exam = useFontScale("word_app_exam_font_scale", "--exam-font-scale");
  const script = useFontScale("word_app_script_font_scale", "--script-font-scale");

  const rows: { label: string; hook: typeof study }[] = [
    { label: "학습 화면", hook: study },
    { label: "연습 화면", hook: practice },
    { label: "시험 화면", hook: exam },
    { label: "지문 화면", hook: script },
  ];

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader icon="글" accent="var(--blue)" title="글자 크기 설정" subtitle="한자·힌트의 크기·색상·표시 여부를 여기서 관리합니다." />

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">화면별 단어(한자) 글자 크기</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          각 화면 맨 위에 크게 나오는 문제(단어/한자)의 크기입니다. 화면마다 따로
          저장되며, 해당 화면의 −/+/기본값 버튼과 값을 공유합니다. (이 기기·이 탭이
          열려 있는 동안만 유지되고, 학습 기록에는 영향을 주지 않습니다)
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--hint-bg)" }}>
              <span className="text-xs font-bold">{r.label}</span>
              <FontSizeControl fontScale={r.hook.fontScale} onAdjust={r.hook.adjustFontScale} onReset={() => r.hook.setFontScale(1)} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <HintThemeSettings />
      </div>
    </div>
  );
}
