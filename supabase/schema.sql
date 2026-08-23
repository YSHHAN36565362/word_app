-- word_app: Supabase 스키마
-- Supabase 대시보드 -> SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- "내 번호"(user_id, 예: 생년월일 등 자유 문자열)를 식별자로 쓰는 무-인증 방식이며,
-- 같은 수업을 듣는 30명 미만의 신뢰 그룹 내 사용을 전제로 합니다.
-- (기존 Streamlit 앱의 "내 번호" 방식과 동일한 보안 수준: 번호만 알면 접근 가능)

create table if not exists progress (
  user_id text not null,
  part text not null check (part in ('study', 'practice', 'exam', 'script')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, part)
);

create table if not exists wrong_notes (
  user_id text primary key,
  words jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists study_stats (
  id bigint generated always as identity primary key,
  user_id text not null,
  date date not null,
  part text not null check (part in ('practice', 'exam')),
  total int not null,
  correct int not null,
  created_at timestamptz not null default now()
);

create index if not exists study_stats_user_id_idx on study_stats (user_id);

-- 단어별 장기 숙련도. 연습/시험에서 채점할 때마다 그 단어의 "최신 점수"만 덮어쓴다
-- (연습: 100/60/40/0, 시험: 맞음=100/틀림=0). 다음에 연습·시험을 시작할 때 이 점수가
-- 낮은 단어일수록 큐/출제 앞쪽에 오도록 정렬해서, 세션이 끝나도 "약한 단어"가 기억되게 한다.
create table if not exists word_mastery (
  user_id text not null,
  word_key text not null,
  score int not null check (score in (0, 40, 60, 100)),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_key)
);

create index if not exists word_mastery_user_id_idx on word_mastery (user_id);

-- 파일 조합별 진행 기록 요약. progress 테이블은 "진행 중인 세션 딱 1개"만 담고 완료하면
-- 지워지는 데 반해, 이 테이블은 (user_id, part, file_key) 조합마다 별도 행으로 남아서
-- - 같은 파트라도 어떤 파일 묶음으로 공부했는지에 따라 독립적으로 진행률/시각을 보여주고
-- - 완료된 뒤에도 "최근 학습 시간"과 마지막 진행률이 남아있고
-- - 과거에 공부했던 다른 파일 묶음들을 드롭다운으로 훑어볼 수 있게 한다.
-- file_key는 선택한 파일 경로들을 정렬해서 이어붙인 값(순서 무관, 같은 조합이면 항상 같은 key).
create table if not exists learning_log (
  user_id text not null,
  part text not null check (part in ('study', 'practice', 'exam', 'script')),
  file_key text not null,
  file_summary text not null,
  total_count int not null default 0,
  done_count int not null default 0,
  mode text,
  updated_at timestamptz not null default now(),
  primary key (user_id, part, file_key)
);

-- 이미 만들어진 테이블에도 mode 컬럼을 추가한다(기존 배포에 대한 마이그레이션).
-- 연습 모드(word_only/meaning_only/random)를 기록해서, "이 학습 다시 하기"를 누르면
-- 파일 선택뿐 아니라 마지막으로 하던 모드로 곧장 이어서 시작할 수 있게 한다.
alter table learning_log add column if not exists mode text;

create index if not exists learning_log_user_part_idx on learning_log (user_id, part, updated_at desc);

-- Row Level Security: anon key로 접근하는 클라이언트 전용 테이블이므로,
-- 익명 역할(anon)에 전체 CRUD를 허용한다. (실 서비스 수준 보안은 아니며,
-- 기존 앱의 "번호만 알면 됨" 신뢰 모델을 그대로 웹으로 옮긴 것)
alter table progress enable row level security;
alter table wrong_notes enable row level security;
alter table study_stats enable row level security;
alter table word_mastery enable row level security;
alter table learning_log enable row level security;

drop policy if exists "anon full access" on progress;
create policy "anon full access" on progress for all to anon using (true) with check (true);

drop policy if exists "anon full access" on wrong_notes;
create policy "anon full access" on wrong_notes for all to anon using (true) with check (true);

drop policy if exists "anon full access" on study_stats;
create policy "anon full access" on study_stats for all to anon using (true) with check (true);

drop policy if exists "anon full access" on word_mastery;
create policy "anon full access" on word_mastery for all to anon using (true) with check (true);

drop policy if exists "anon full access" on learning_log;
create policy "anon full access" on learning_log for all to anon using (true) with check (true);
