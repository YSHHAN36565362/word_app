"use client";

import { useRouter } from "next/navigation";
import { useTour } from "@/contexts/TourContext";

// 아래 사용법 설명 글이 길어서, 글을 읽기 전에 실제 화면을 눌러보며 익힐 수 있는
// 지름길을 맨 위에 둔다. 누르면 처음 화면으로 이동해서 하단 탭을 하나씩 눌러보도록
// 빨간 테두리로 안내한다.
export default function StartTourButton() {
  const { start } = useTour();
  const router = useRouter();

  return (
    <button
      onClick={() => {
        start();
        router.push("/");
      }}
      className="btn-3d btn-accent mt-3 w-full py-4 text-base"
    >
      🚀 사이트 체험하기
    </button>
  );
}
