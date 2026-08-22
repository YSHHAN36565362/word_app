"use client";

import { ReactNode } from "react";

interface FocusScreenProps {
  /** 진행률/카운터/마스코트 등, 화면 위쪽에 오는 고정 내용 */
  top?: ReactNode;
  /** 카드/힌트/종료 버튼 등 스크롤되는 본문. 길어져도 하단 액션바를 밀어내지 않는다. */
  children: ReactNode;
  /** 정답확인/채점/이전·다음 등 주요 액션 버튼. 있을 때만 화면 하단에 고정된다. */
  actions?: ReactNode;
}

/**
 * 학습/연습/시험/지문 화면 공통 레이아웃.
 * 액션 버튼을 뷰포트 하단에 고정(position:fixed)해서, 힌트 텍스트 길이에 따라
 * 버튼 위치가 오르내리지 않게 한다. 본문에는 액션바 높이만큼 하단 패딩을 줘서
 * 마지막 내용이 버튼에 가리지 않게 한다. 종료 버튼은 액션바가 아니라 children
 * 맨 끝에 두어(원래 위치), 진행 중이든 완료했든 항상 스크롤해서 닿을 수 있게 한다.
 */
export default function FocusScreen({ top, children, actions }: FocusScreenProps) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-4">
      {top}
      <div className={actions ? "pb-36" : ""}>{children}</div>
      {actions && (
        <div
          className="fixed inset-x-0 bottom-0 z-40"
          style={{ background: "var(--bg)", borderTop: "1px solid var(--card-border)" }}
        >
          <div className="mx-auto max-w-xl px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">{actions}</div>
        </div>
      )}
    </div>
  );
}
