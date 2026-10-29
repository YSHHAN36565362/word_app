# 2026-10-29 · 단어장을 word_app 폴더에서 직접 읽기

> 상태: 완료 (로컬 검증) · 배포 전 Vercel 환경변수 변경 필요 · 커밋은 사용자가 직접

## 요약

단어장(`word_list/`)을 다른 저장소(`word_test`)에서 GitHub API로 가져오던 방식을 없애고,
`word_app/word_list/`를 서버가 파일시스템으로 직접 읽도록 바꿨다.

## 배경 (Context)

- 요청: "word_test/word_list를 GitHub API로 불러오는 건 비효율적이니 word_app 폴더에서 직접 불러오게."
- 점검 결과 **절반만 이전된 상태**였다.
  - 단어 내용 API(`words`, `script`)는 이미 로컬 파일을 읽음.
  - 목록 API(`tree`)는 여전히 GitHub API로 `word_test`를 조회함.
  - `word_app/word_list`는 옛 스냅샷이라 `word_test`에만 있는 새 단어장 15개와 `_IT` 하위 폴더 구조가 없었음.
  - 결과: 목록에는 보이는데 내용은 빈 단어장이 생길 수 있었다.

## 결정 (Decision)

- 읽기는 전부 파일시스템(`src/lib/wordlist-fs.ts`)으로 통일. 읽기용 GitHub 토큰·요청 한도(시간당 60회) 문제 제거.
- 쓰기(단어장 추가)는 서버리스 파일시스템이 읽기 전용이라 기존대로 GitHub Contents API 커밋을 유지하되, **커밋 대상을 `word_app` 자신으로** 변경(환경변수).

## 변경 사항

### Changed
- `src/app/api/wordlist/tree/route.ts`: GitHub API → `wordlist-fs`. 폴더 없을 때 안내 메시지만 반환.
- `src/lib/wordlist-fs.ts`: GitHub API 구현 → 파일시스템 구현(기존 `wordlist-fs 복사본.ts` 내용 사용).
- `.env.example`: `GITHUB_REPO=word_app`, 읽기에는 불필요하다는 주석.
- `README.md`(JA/KO), `word_test/README.md`(JA/KO), `UsageGuide.tsx`: 데이터 저장소·환경변수·단어장 추가 반영 시점(재배포 후) 설명 갱신.

### Added
- `word_test/word_list` → `word_app/word_list` 동기화(추가만, 삭제 없음): 85개 파일.
  N2 10개, N3 5개, `_IT/IT`(6), `_IT/정보처리기사_실기`(12).

### Removed
- 없음.

## 검증

- `tsc --noEmit` 오류 없음.
- 개발 서버에서 `/api/wordlist/tree`: Japanese(N1 1 / N2 39 / N2(Tr.Park_word) 8 / N3 10), `_IT`(정보처리기사_실기 12 / IT 6) 정상.
- `/api/wordlist/words`로 최신 파일(`2026-10-28_Tr.Park_Word.txt`) 내용 로드 확인.

## 결과·주의 (Consequences)

- 단어장이 배포 번들에 포함되므로, **앱에서 추가한 단어장은 커밋 → Vercel 재배포 후**(1~2분) 목록에 나타난다.
- **Vercel 환경변수 `GITHUB_REPO`를 `word_test` → `word_app`으로 바꿔야** 한다. 안 바꾸면 업로드가 word_test로 커밋되어 앱에 안 보인다. 토큰(`GITHUB_TOKEN`)도 `word_app`에 쓰기 권한이 있어야 한다.
- 이제 단어장을 추가·수정할 때는 `word_app/word_list`가 기준이다. `word_test/word_list`는 Streamlit 프로토타입용으로만 남는다.

## 남은 일

- [ ] Vercel `GITHUB_REPO` 변경 후 재배포, 업로드 1건 테스트
- [ ] `word_app/word_list/_IT` 바로 아래 옛 평면 파일 9개 삭제 여부 결정 (하위 폴더가 있어 앱에는 안 보임, 중복본)
- [ ] 안 쓰는 `* 복사본.ts` 파일 4개 정리 여부 결정
