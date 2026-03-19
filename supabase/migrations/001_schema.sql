-- ============================================
-- DREAM OS — Supabase Schema
-- Personal Project Management + Pomodoro + Habits
-- ============================================

create extension if not exists "uuid-ossp";

-- ── PROJECTS ──────────────────────────────
create table projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  icon        text not null default '📝',
  color       text not null default '#C4E8F4',
  blueprint   text,           -- template key ที่ใช้สร้าง
  xp          integer default 0,
  archived    boolean default false,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── PHASES ────────────────────────────────
create table phases (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      text default 'locked' check (status in ('done','active','next','locked')),
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ── TASKS ─────────────────────────────────
create table tasks (
  id          uuid primary key default uuid_generate_v4(),
  phase_id    uuid references phases(id) on delete cascade,
  project_id  uuid references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  done        boolean default false,
  in_sprint   boolean default false,
  priority    text default 'normal' check (priority in ('normal','high')),
  due_date    date,
  category    text default 'task' check (category in ('task','marketing','finance','ops')),
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── HABITS ────────────────────────────────
create table habits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  icon        text default '✅',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ── HABIT LOGS (daily reset) ──────────────
create table habit_logs (
  id          uuid primary key default uuid_generate_v4(),
  habit_id    uuid references habits(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  date        date not null default current_date,
  done        boolean default false,
  unique(habit_id, date)
);

-- ── POMODORO SESSIONS ─────────────────────
create table pomo_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  project_id  uuid references projects(id) on delete set null,
  task_title  text,
  duration    integer default 25,  -- minutes
  completed   boolean default false,
  started_at  timestamptz default now(),
  ended_at    timestamptz
);

-- ── SPRINT (active tasks pulled from phases) ─
-- sprint = tasks ที่ in_sprint = true (ดึงจาก tasks table โดยตรง)
-- ไม่ต้องมี table แยก

-- ── RLS ───────────────────────────────────
alter table projects     enable row level security;
alter table phases       enable row level security;
alter table tasks        enable row level security;
alter table habits       enable row level security;
alter table habit_logs   enable row level security;
alter table pomo_sessions enable row level security;

-- ทุก table: user เห็นเฉพาะของตัวเอง
create policy "own_projects"      on projects      for all using (user_id = auth.uid());
create policy "own_phases"        on phases        for all using (user_id = auth.uid());
create policy "own_tasks"         on tasks         for all using (user_id = auth.uid());
create policy "own_habits"        on habits        for all using (user_id = auth.uid());
create policy "own_habit_logs"    on habit_logs    for all using (user_id = auth.uid());
create policy "own_pomo_sessions" on pomo_sessions for all using (user_id = auth.uid());

-- ── AUTO UPDATE updated_at ────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger tasks_updated_at    before update on tasks    for each row execute procedure update_updated_at();
create trigger projects_updated_at before update on projects for each row execute procedure update_updated_at();

-- ── REALTIME ──────────────────────────────
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table habit_logs;
