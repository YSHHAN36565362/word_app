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

-- Row Level Security: anon key로 접근하는 클라이언트 전용 테이블이므로,
-- 익명 역할(anon)에 전체 CRUD를 허용한다. (실 서비스 수준 보안은 아니며,
-- 기존 앱의 "번호만 알면 됨" 신뢰 모델을 그대로 웹으로 옮긴 것)
alter table progress enable row level security;
alter table wrong_notes enable row level security;
alter table study_stats enable row level security;

drop policy if exists "anon full access" on progress;
create policy "anon full access" on progress for all to anon using (true) with check (true);

drop policy if exists "anon full access" on wrong_notes;
create policy "anon full access" on wrong_notes for all to anon using (true) with check (true);

drop policy if exists "anon full access" on study_stats;
create policy "anon full access" on study_stats for all to anon using (true) with check (true);
