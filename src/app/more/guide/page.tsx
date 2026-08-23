import PageHeader from "@/components/PageHeader";
import UsageGuide from "@/components/UsageGuide";

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8">
      <PageHeader
        icon="설"
        accent="var(--accent)"
        title="사용법 설명"
        subtitle="처음 오셨다면 아래에서 파트별 기능과 편의 기능을 화면과 함께 확인해보세요."
      />
      <UsageGuide />
    </div>
  );
}
