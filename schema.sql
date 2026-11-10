-- ============================================================
-- Kanban Task Board — Supabase Schema
-- ============================================================

-- Profiles (one per auth.users row, created on first sign-in)
create table profiles (
  id            uuid        primary key references auth.users on delete cascade,
  display_name  text        not null,
  avatar_color  text        not null default '#6366f1',
  created_at    timestamptz not null default now()
);

-- Tasks (also holds context cards via type discriminator)
--
-- type = 'task'    → uses title, description, status, due_date
-- type = 'context' → uses question, answer; status is always 'context'
--
-- status mirrors the board columns:
--   backlog | ready | in_progress | in_review | completed | context
create table tasks (
  id           uuid        primary key default gen_random_uuid(),
  ref_key      bigint      generated always as identity,  -- human-readable e.g. KAN-42
  type         text        not null default 'task'
                             check (type in ('task', 'context')),

  -- task-only fields
  title        text,
  description  text,
  due_date     date,

  -- context-card-only fields
  question     text,
  answer       text,

  -- shared fields
  status       text        not null
                             check (status in ('backlog', 'ready', 'in_progress', 'in_review', 'completed', 'context')),
  priority     text        check (priority in ('low', 'normal', 'high')),
  position     float8      not null default 0,  -- fractional for drag-and-drop ordering
  assignee_id  uuid        references profiles(id) on delete set null,

  -- ownership (tied to anonymous guest session)
  user_id      uuid        not null references auth.users on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Labels (user-created tags, e.g. "Bug", "Feature", "Design")
create table labels (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null,
  color      text        not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- Task ↔ Label (many-to-many; works for both tasks and context cards)
create table task_labels (
  task_id   uuid not null references tasks(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- Task relationships (directional; inverse is derived in app logic)
--
--   type          forward meaning       inverse meaning
--   blocked_by    A is blocked by B     B is blocking A
--   waiting_on    A is waiting on B     B completes A
--   subtask       A is subtask of B     B is parent of A (B waits on all children)
--   details       A details B           B is subject of A
create table task_relationships (
  id           uuid        primary key default gen_random_uuid(),
  from_task_id uuid        not null references tasks(id) on delete cascade,
  to_task_id   uuid        not null references tasks(id) on delete cascade,
  type         text        not null
                             check (type in ('blocked_by', 'waiting_on', 'subtask', 'details')),
  created_at   timestamptz not null default now(),
  unique (from_task_id, to_task_id, type)
);

-- Activity log (per-task change history, shown in task detail view)
--
-- action examples: 'status_changed', 'priority_changed', 'assigned',
--                  'answer_added', 'relationship_added', 'title_edited'
-- payload holds before/after values as needed, e.g.:
--   { "from": "ready", "to": "in_progress" }
create table activity_log (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references tasks(id) on delete cascade,
  actor_id   uuid        references profiles(id) on delete set null,
  action     text        not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles           enable row level security;
alter table tasks              enable row level security;
alter table labels             enable row level security;
alter table task_labels        enable row level security;
alter table task_relationships enable row level security;
alter table activity_log       enable row level security;

-- Shared board: all authenticated users (including anonymous guests) can read
-- everything. Writes are scoped to the creator (user_id = auth.uid()).

-- profiles: anyone can read; only own row is writable
create policy "profiles: read all"
  on profiles for select using (auth.uid() is not null);

create policy "profiles: write own row"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles: update own row"
  on profiles for update using (auth.uid() = id);

-- tasks: anyone can read; only creator can insert/update/delete
create policy "tasks: read all"
  on tasks for select using (auth.uid() is not null);

create policy "tasks: write own rows"
  on tasks for insert with check (auth.uid() = user_id);

create policy "tasks: update own rows"
  on tasks for update using (auth.uid() = user_id);

create policy "tasks: delete own rows"
  on tasks for delete using (auth.uid() = user_id);

-- labels: anyone can read; only creator can write
create policy "labels: read all"
  on labels for select using (auth.uid() is not null);

create policy "labels: write own rows"
  on labels for insert with check (auth.uid() = user_id);

create policy "labels: update own rows"
  on labels for update using (auth.uid() = user_id);

create policy "labels: delete own rows"
  on labels for delete using (auth.uid() = user_id);

-- task_labels: anyone can read; write gated on owning the parent task
create policy "task_labels: read all"
  on task_labels for select using (auth.uid() is not null);

create policy "task_labels: write via task ownership"
  on task_labels for insert with check (exists (
    select 1 from tasks where tasks.id = task_id and tasks.user_id = auth.uid()
  ));

create policy "task_labels: delete via task ownership"
  on task_labels for delete using (exists (
    select 1 from tasks where tasks.id = task_id and tasks.user_id = auth.uid()
  ));

-- task_relationships: anyone can read; write gated on owning the from_task
create policy "task_relationships: read all"
  on task_relationships for select using (auth.uid() is not null);

create policy "task_relationships: write via task ownership"
  on task_relationships for insert with check (exists (
    select 1 from tasks where tasks.id = from_task_id and tasks.user_id = auth.uid()
  ));

create policy "task_relationships: delete via task ownership"
  on task_relationships for delete using (exists (
    select 1 from tasks where tasks.id = from_task_id and tasks.user_id = auth.uid()
  ));

-- activity_log: anyone can read; write gated on owning the parent task
create policy "activity_log: read all"
  on activity_log for select using (auth.uid() is not null);

create policy "activity_log: write via task ownership"
  on activity_log for insert with check (exists (
    select 1 from tasks where tasks.id = task_id and tasks.user_id = auth.uid()
  ));

-- ============================================================
-- Indexes
-- ============================================================

create index on tasks(user_id);
create index on tasks(status);
create index on tasks(assignee_id);
create index on tasks(ref_key);
create index on task_labels(task_id);
create index on task_labels(label_id);
create index on task_relationships(from_task_id);
create index on task_relationships(to_task_id);
create index on activity_log(task_id);
create index on activity_log(created_at);
