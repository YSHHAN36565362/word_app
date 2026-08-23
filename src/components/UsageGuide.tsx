"use client";

interface GuideItem {
  title: string;
  body: React.ReactNode;
  image?: string;
  imageAlt?: string;
}

const PART_ITEMS: GuideItem[] = [
  {
    title: "학습 — 순서대로 훑어보기",
    image: "/images/guide/03-study-active.png",
    imageAlt: "학습 화면: 단어, 뜻, 펼쳐진 힌트가 함께 보인다",
    body: (
      <>
        선택한 파일의 단어를 처음부터 끝까지 한 번 훑어보는 모드입니다. 화면을 넘기면서 뜻을
        외우고, 필요하면 힌트를 펼쳐서 상세 설명(어원·예문 등)을 확인합니다. 단축키:{" "}
        <b>←/→</b>로 이전/다음 단어, <b>H</b>로 힌트 보기.
      </>
    ),
  },
  {
    title: "연습 — 망각 곡선 큐",
    image: "/images/guide/05-practice-active.png",
    imageAlt: "연습 화면: 완벽함/조금앎/헷갈림/모름 4단계 채점 버튼",
    body: (
      <>
        단어를 보고 스스로 <b>완벽함(100) · 조금 앎(60) · 헷갈림(40) · 모름(0)</b> 4단계로
        채점합니다. 점수가 낮을수록 큐(대기열)의 더 앞쪽 구간에 다시 꽂혀서 금방 다시
        만나고, 완벽함은 이번 세션에서 아예 빠집니다. 위치는 매번 구간 안에서 무작위로
        정해져서, 단어가 아니라 &ldquo;순서&rdquo;를 외워버리는 것을 막습니다. 채점 결과(단어별
        숙련도)는 서버에 저장되어, 다음에 같은 번호로 연습을 다시 시작해도 예전에 약했던
        단어가 먼저 나옵니다 — 세션이 끝나도 기억됩니다.
      </>
    ),
  },
  {
    title: "시험 — 출제 개수를 정해 채점",
    image: "/images/guide/07-exam-setup.png",
    imageAlt: "시험 설정 화면: 출제 개수 지정과 최대/+5/-5 버튼",
    body: (
      <>
        출제할 단어 개수를 정하고 O/X로 채점합니다. 틀린 단어는 자동으로 <b>오답 노트</b>에
        쌓이고, 시험이 끝나면 틀린 단어만 바로 다시 풀어볼 수 있습니다.
      </>
    ),
  },
  {
    title: "단어장 추가 — GitHub 저장소에 직접 커밋",
    image: "/images/guide/09-wordbook.png",
    imageAlt: "단어장 추가 화면: 대분류/하위 폴더 선택과 내용 입력",
    body: (
      <>
        새 단어장을 앱 안에서 바로 만들 수 있습니다. 직접 입력하거나 txt 파일을 올리면,
        비밀번호 확인 후 GitHub 저장소에 파일로 커밋됩니다. 별도 서버 DB 없이 저장소 자체가
        데이터베이스 역할을 합니다.
      </>
    ),
  },
  {
    title: "지문 암기",
    body: <>회화문이나 독해 지문을 한 문장씩 넘기면서 암송하는 모드입니다.</>,
  },
  {
    title: "오답 노트",
    body: <>시험에서 틀렸던 단어들을 모아서 확인하고, 그 단어들로만 바로 연습을 시작할 수 있습니다.</>,
  },
  {
    title: "통계",
    body: <>날짜별로 얼마나 연습·시험을 봤는지, 정답률은 어땠는지 확인할 수 있습니다.</>,
  },
  {
    title: "매칭 게임 — 단어와 뜻 짝맞추기",
    body: (
      <>
        선택한 파일에서 무작위로 6쌍(12개 타일)을 뽑아, 단어와 뜻이 적힌 타일을 빠르게
        짝지어 맞히는 미니 게임입니다. 완료 시간이 기록되고, 같은 파일 조합의 이전 최고
        기록보다 빠르면 새 기록으로 저장됩니다. &ldquo;더보기 &gt; 매칭 게임&rdquo;에서
        시작할 수 있습니다.
      </>
    ),
  },
];

const FEATURE_ITEMS: GuideItem[] = [
  {
    title: "이전 학습 이어하기 — [이 학습 다시 하기]",
    image: "/images/guide/06-dashboard.png",
    imageAlt: "학습 대시보드: 진행률, 최근 학습 기록 드롭다운, 이 학습 다시 하기 버튼",
    body: (
      <>
        학습·연습 화면 하단의 요약 카드에는 완료/남은 단어 개수까지 포함한 진행률과, 예전에
        공부했던 파일 조합들을 고를 수 있는 드롭다운이 있습니다. 드롭다운에서 과거 기록(또는
        현재 선택한 파일 조합)을 고른 뒤 <b>[이 학습 다시 하기]</b>를 누르면, 그때 썼던 파일
        선택과 모드(이름만/뜻만/랜덤)가 그대로 복원되면서 <b>자동으로 단어 화면까지 진입</b>
        합니다.
      </>
    ),
  },
  {
    title: "학습 기록 지우기",
    image: "/images/guide/11-settings-delete.png",
    imageAlt: "설정 화면: 학습 기록 목록과 개별 삭제 버튼",
    body: (
      <>
        설정 화면의 <b>&ldquo;학습 기록 관리&rdquo;</b>에서 저장된 학습/연습/시험/지문 기록을
        확인하고, 필요 없는 항목을 개별로 삭제할 수 있습니다. 파일을 잘못 선택했거나 특정
        조합의 진도를 처음부터 다시 재고 싶을 때 사용합니다.
      </>
    ),
  },
  {
    title: "단어 순서 섞기",
    body: (
      <>
        학습·연습·시험 화면에서 <b>종료하기</b> 옆의 <b>[단어 순서 섞기]</b> 버튼을 누르면, 아직
        보지 않은 단어들의 순서를 다시 무작위로 섞습니다. 같은 조합을 여러 번 반복해서 보다
        보면 내용이 아니라 &ldquo;다음에 뭐가 나올지&rdquo; 순서로 외워버릴 수 있어서, 언제든
        원할 때 순서를 바꿀 수 있게 했습니다.
      </>
    ),
  },
  {
    title: "즐겨찾기 — 별표 단어 모아보기",
    body: (
      <>
        학습·연습 화면에서 단어 옆의 별표(☆)를 누르면 <b>즐겨찾기</b>에 저장됩니다(다시
        누르면 해제). &ldquo;더보기 &gt; 즐겨찾기&rdquo;에서 별표한 단어만 모아보고, 그
        단어들로만 바로 연습을 시작할 수 있습니다. 오답 노트와 달리 자동으로 쌓이지 않고
        직접 고른 단어만 들어갑니다.
      </>
    ),
  },
  {
    title: "연속 학습일 (스트릭)",
    body: (
      <>
        하루에 한 번이라도 학습/연습/시험/지문 중 무엇이든 하면 그 날이 기록되어, 홈
        화면에 <b>연속 학습 N일째</b>가 표시됩니다. 하루라도 건너뛰면 스트릭이 끊기고
        다시 1일부터 시작합니다.
      </>
    ),
  },
  {
    title: "내 번호 — 기기 간 동기화",
    body: (
      <>
        로그인 없이, 원하는 숫자를 하나 입력하면 그 번호로 학습/연습/시험/지문 진행 상황,
        오답 노트, 통계가 저장됩니다. 다른 기기(휴대폰 · PC 등)에서 같은 번호를 입력하면
        이어서 사용할 수 있습니다. 번호를 입력하지 않아도 학습 자체는 문제없이 동작하며,
        이 경우 진행 상황만 저장되지 않습니다.
      </>
    ),
  },
  {
    title: "키보드 단축키",
    body: (
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <span className="font-bold">학습</span>
        <span>← / → 이전·다음, H 힌트</span>
        <span className="font-bold">연습</span>
        <span>Space/Enter 정답 확인, 1~4 또는 ←↓↑→ 모름·헷갈림·조금앎·완벽함</span>
        <span className="font-bold">시험</span>
        <span>Space/Enter 정답 확인, ← 틀림, → 맞음</span>
      </div>
    ),
  },
];

function GuideAccordion({ items }: { items: GuideItem[] }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {items.map((item) => (
        <details
          key={item.title}
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--card-border)" }}
        >
          <summary
            className="cursor-pointer list-none px-4 py-2.5 text-sm font-bold select-none [&::-webkit-details-marker]:hidden"
            style={{ background: "var(--hint-bg)", color: "var(--text)" }}
          >
            <span className="details-chevron mr-1.5 inline-block" style={{ color: "var(--text-muted)" }}>
              ▸
            </span>
            {item.title}
          </summary>
          <div className="px-4 py-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.imageAlt ?? ""}
                className="mb-3 w-full rounded-xl border"
                style={{ borderColor: "var(--card-border)" }}
              />
            )}
            {item.body}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function UsageGuide() {
  return (
    <>
      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">파트별 기능</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          각 항목을 눌러 화면과 함께 설명을 확인할 수 있습니다.
        </p>
        <GuideAccordion items={PART_ITEMS} />
      </div>

      <div className="mt-4 study-card p-4">
        <div className="text-sm font-bold">편의 기능</div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          학습을 더 편하게 만들어주는 기능들입니다.
        </p>
        <GuideAccordion items={FEATURE_ITEMS} />
      </div>
    </>
  );
}
