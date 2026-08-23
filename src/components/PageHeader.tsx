interface Props {
  icon: string;
  accent: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
}

/**
 * 모든 페이지 상단에 쓰는 공통 헤더. 페이지마다 제각각이던 h1/설명 문단을
 * 하나의 시각적 패턴(색상 배지 + 제목 + 설명)으로 통일해 앱 전체의 일관성을 높인다.
 */
export default function PageHeader({ icon, accent, iconColor = "#ffffff", title, subtitle }: Props) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold"
        style={{ background: accent, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 pt-1">
        <h1 className="text-xl font-extrabold leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm leading-snug" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
