# 단어장 (word_app)

기존 Streamlit(`word_test/app.py`) 단어 암기 프로그램을 Next.js + Tailwind + Framer Motion 기반의
모바일 웹앱(PWA)으로 새로 만든 프론트엔드입니다. 단어장 데이터(`word_list/*.txt`)는 그대로
[`word_test`](https://github.com/YSHHAN36565362/word_test) 저장소를 읽어옵니다. 학습/연습/시험
진행 상황, 오답노트, 통계는 Supabase에 저장되어 여러 기기에서 같은 "내 번호"로 이어서 볼 수 있습니다.

## 아키텍처

- **단어장 읽기**: 브라우저가 GitHub API를 직접 호출하지 않습니다. 토큰이 브라우저에 노출되면 안 되므로,
  Next.js 서버(Route Handler, `src/app/api/wordlist/*`, `src/app/api/wordbook`)가
  GitHub Contents API를 대신 호출하고 5분(`revalidate = 300`) 동안 결과를 캐시합니다.
- **단어장 쓰기**(단어장 추가): 같은 서버 라우트가 `GITHUB_TOKEN`으로 커밋합니다.
  비밀번호는 서버에서 `UPLOAD_PASSWORD`와 상수시간 비교로 검증합니다.
- **진행 상황 동기화**: `src/lib/supabase.ts` + `src/lib/progress.ts`가 Supabase 테이블
  (`progress`, `wrong_notes`, `study_stats`)에 직접 읽고 씁니다. "내 번호"를 식별자로 쓰는
  무-인증 방식으로, 기존 Streamlit 앱과 동일한 신뢰 모델입니다(같은 수업을 듣는 소규모 그룹 전제).
  `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`가 없으면 `src/app/api/config`가 `STORAGE_` 접두사가
  붙은 Vercel Integration 변수명(`STORAGE_SUPABASE_URL` 등)까지 서버에서 대신 읽어 내려줍니다 —
  `NEXT_PUBLIC_` 접두사가 아닌 변수는 브라우저 번들에 애초에 포함되지 않으므로, 클라이언트
  코드만으로는 다른 이름의 변수를 읽을 방법이 없기 때문입니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 아래 "환경변수" 참고해서 값 채우기
npm run dev
```

`GITHUB_TOKEN` 없이도(공개 저장소이므로) 단어장 읽기는 되지만, 시간당 요청 한도가 60회로 낮아
접속자가 많으면 금방 소진됩니다. 토큰을 넣는 것을 권장합니다.

## 환경변수

`.env.example` 참고. 배포 시 Vercel 프로젝트 설정의 Environment Variables에 아래를 등록하세요.

| 변수 | 용도 | 필수 |
|---|---|---|
| `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` | 단어장이 있는 저장소 (`YSHHAN36565362/word_test`, `main`) | 필수 |
| `GITHUB_TOKEN` | 단어장 추가(쓰기) + 읽기 한도 상향. repo에 Contents: Read and write 권한의 Fine-grained PAT | 쓰기 기능에 필수 |
| `UPLOAD_PASSWORD` | 단어장 추가 시 확인하는 비밀번호 | 쓰기 기능에 필수 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 진행 상황/오답노트/통계 동기화 | 동기화 기능에 필수 (Vercel Supabase Integration이 `STORAGE_` 접두사로 저장했다면 그대로 둬도 `/api/config`가 대신 읽음) |

Supabase 없이 배포해도 앱은 정상 동작하며, 이 경우 "내 번호"를 입력해도 진행 상황이 저장되지
않는다는 안내만 뜹니다.

## Supabase 설정 (기기 간 진행 상황 동기화)

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 플랜으로 충분).
2. 프로젝트의 SQL Editor에서 `supabase/schema.sql` 파일 전체를 붙여넣고 실행.
3. Project Settings → API에서 `Project URL`과 `anon public` 키를 복사해
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 설정.

> 이 스키마는 실제 로그인 없이 "내 번호" 문자열만으로 접근하는 방식이라 엄밀한 보안은 아닙니다
> (기존 Streamlit 앱의 "내 번호" 저장 방식과 동일한 수준). 같은 수업을 듣는 30명 미만의 신뢰
> 그룹 안에서 쓰는 것을 전제로 합니다.

## GitHub 토큰 발급 (단어장 추가용)

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
2. Repository access를 `word_test` 저장소로 제한.
3. Permissions → Contents: **Read and write**.
4. 발급된 토큰을 `GITHUB_TOKEN`에 설정.

## Vercel 배포

1. 이 폴더(`word_app`)를 새 GitHub 저장소로 push.
2. [vercel.com](https://vercel.com) → New Project → 방금 만든 저장소 선택 (Next.js 자동 인식).
3. Environment Variables에 위 표의 값들을 입력 후 Deploy.
4. 배포된 주소로 접속 → 모바일 브라우저에서 "홈 화면에 추가"를 하면 PWA로 설치되어
   주소창 없이 전체화면 앱처럼 실행됩니다 (`public/manifest.json` 참고).

## 폴더 구조

```
src/
  app/
    study/ practice/ exam/ wrongnotes/ stats/ script/ wordbook/  # 각 파트 페이지
    more/                        # 더보기 메뉴, 설정(내 번호 · 테마)
    api/
      config/                    # 브라우저에 Supabase URL/anon key를 내려줌 (STORAGE_ 접두사 fallback 포함)
      wordlist/tree/             # word_list 폴더 트리 (카테고리 > 세부카테고리 > 파일)
      wordlist/words/            # 선택한 파일들의 단어 풀 파싱 (POST)
      wordlist/script/           # 지문 외우기용 줄 단위 파싱
      wordbook/                  # 단어장 추가 (GitHub 커밋, 비밀번호 검증)
  components/                    # FileSelector, FlashCard(3D 플립), Mascot(피드백 캐릭터), ProgressBar 등
  contexts/                      # ThemeContext(다크모드), FocusModeContext(학습 중 하단 네비 숨김)
  lib/                           # parser, queue(망각곡선), github(서버 전용), supabase, progress
  hooks/useUserId.ts             # localStorage + URL 쿼리(?uid=) 기반 "내 번호"
supabase/schema.sql              # progress / wrong_notes / study_stats 테이블 + RLS
scripts/generate-icons.mjs       # PWA 아이콘(PNG) 생성 스크립트 (외부 라이브러리 없이 zlib만 사용)
public/images/                   # 하단 네비 아이콘 + 연습/학습 피드백 캐릭터 이미지 (images/에서 복사)
```

## 기존 Streamlit 앱과의 차이

- 새로고침 없이 카드가 3D로 뒤집히고(Framer Motion), 채점 시 마스코트가 반응합니다.
- 하단 탭 내비게이션 + PWA로 실제 모바일 앱처럼 홈 화면에 설치할 수 있습니다.
- 진행 상황 저장이 GitHub 커밋이 아닌 Supabase로 바뀌어 훨씬 빠르고, 커밋 히스토리가
  더러워지지 않습니다.
- "떠다니는 메모장", "세션 킵얼라이브" 등 Streamlit iframe 특유의 우회 기능은 필요 없어져
  포팅하지 않았습니다.
