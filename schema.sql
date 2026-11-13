-- ============================================================
-- Kanban Task Board — Supabase Schema
-- Reflects the live database as of 2026-11-13.
-- See supabase-schema-dhfdvwmbutpgwngwyeon(1).png for the ERD.
-- ============================================================

-- Profiles (one per auth.users row, created on first sign-in)
create table profiles (
  id            uuid        primary key references auth.users on delete cascade,
  display_name  text        not null,
  avatar_color  text        not null default '#6366f1',
  created_at    timestamptz not null default now()
);

-- Boards (each has a URL-safe slug used as the shareable link)
-- Note: the slug column is currently named invite_code in the live DB.
create table boards (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  invite_code  text        not null unique,   -- slugified name + random suffix, used as URL key
  created_at   timestamptz not null default now()
);

-- Tasks (also holds context cards via type discriminator)
--
-- type = 'task'    → uses title, description, status, due_date, assignee_id
-- type = 'context' → uses question, answer, context_relation_type, parent_task_id;
--                    status is always 'context'
--
-- status mirrors the board columns:
--   backlog | ready | in_progress | in_review | completed | context
create table tasks (
  id                    uuid        primary key default gen_random_uuid(),
  ref_key               bigint      generated always as identity,
  type                  text        not null default 'task'
                                      check (type in ('task', 'context')),

  -- task-only fields
  title                 text,
  description           text,
  due_date              date,

  -- context-card-only fields
  question              text,
  answer                text,
  context_relation_type text,          -- 'details' | 'question' | 'comment'
  parent_link_type      text,          -- link type for question cards: 'blocking' | 'waiting_on'
  parent_task_id        uuid        references tasks(id) on delete cascade,

  -- shared fields
  status                text        not null
                                      check (status in ('backlog', 'ready', 'in_progress', 'in_review', 'completed', 'context')),
  priority              text        check (priority in ('low', 'normal', 'high')),
  position              float8      not null default 0,
  assignee_id           uuid        references profiles(id) on delete set null,

  -- ownership
  user_id               uuid        not null references auth.users on delete cascade,
  board_id              uuid        references boards(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Labels (board-scoped tags)
create table labels (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  board_id   uuid        references boards(id) on delete cascade,
  name       text        not null,
  color      text        not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (board_id, name)
);

-- Task ↔ Label (many-to-many)
create table task_labels (
  task_id   uuid not null references tasks(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- Task relationships (bidirectional; both directions stored as separate rows)
--
--   type          forward meaning       inverse meaning
--   blocks        A blocks B            B blocked_by A
--   blocked_by    A is blocked by B     B blocks A
--   parent_of     A is parent of B      B is child_of A
--   child_of      A is child of B       B is parent_of A
--   waiting_on    A is waiting on B     B completes A
--   completes     A completes B         B is waiting_on A
--   subtask       legacy alias for child_of
--   details       legacy: context card relationship
create table task_relationships (
  id           uuid        primary key default gen_random_uuid(),
  from_task_id uuid        not null references tasks(id) on delete cascade,
  to_task_id   uuid        not null references tasks(id) on delete cascade,
  type         text        not null
                             check (type in (
                               'blocks', 'blocked_by',
                               'parent_of', 'child_of',
                               'waiting_on', 'completes',
                               'subtask', 'details'
                             )),
  board_id     uuid        references boards(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (from_task_id, to_task_id, type)
);

-- Activity log (per-task change history)
--
-- action examples: 'task_created', 'status_changed', 'priority_changed',
--                  'assigned', 'unassigned', 'title_edited',
--                  'due_date_set', 'due_date_cleared',
--                  'question_added', 'comment_added',
--                  'task_completed_cascade'
-- payload holds before/after values, e.g. { "from": "ready", "to": "in_progress" }
create table activity_log (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references tasks(id) on delete cascade,
  actor_id   uuid        references profiles(id) on delete set null,
  action     text        not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);

-- Team invites (peer-to-peer; accepted pairs share focus-mode visibility)
-- board_id is nullable — invites are currently user-scoped, not board-scoped
create table team_invites (
  id            uuid        primary key default gen_random_uuid(),
  board_id      uuid        references boards(id) on delete cascade,
  inviter_id    uuid        not null references auth.users on delete cascade,
  invitee_id    uuid        not null references auth.users on delete cascade,
  inviter_color text        not null default '#6366f1',
  status        text        not null default 'pending'
                              check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  unique (board_id, inviter_id, invitee_id)
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
alter table boards             enable row level security;
alter table tasks              enable row level security;
alter table labels             enable row level security;
alter table task_labels        enable row level security;
alter table task_relationships enable row level security;
alter table activity_log       enable row level security;
alter table team_invites       enable row level security;

-- profiles: anyone authenticated can read; only own row is writable
create policy "profiles: read all"
  on profiles for select using (auth.uid() is not null);

create policy "profiles: insert own row"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles: update own row"
  on profiles for update using (auth.uid() = id);

-- boards: anyone authenticated can read and create; only creator can update/delete
create policy "boards: read all"
  on boards for select using (auth.uid() is not null);

create policy "boards: insert"
  on boards for insert with check (auth.uid() is not null);

-- tasks: anyone authenticated can read and update; only creator can insert/delete
-- (open update allows assignees and teammates to edit tasks they don't own)
create policy "tasks: read all"
  on tasks for select using (auth.uid() is not null);

create policy "tasks: insert own rows"
  on tasks for insert with check (auth.uid() = user_id);

create policy "tasks: update any"
  on tasks for update using (auth.uid() is not null);

create policy "tasks: delete own rows"
  on tasks for delete using (auth.uid() = user_id);

-- labels: anyone can read; only creator can write
create policy "labels: read all"
  on labels for select using (auth.uid() is not null);

create policy "labels: insert own rows"
  on labels for insert with check (auth.uid() = user_id);

create policy "labels: update own rows"
  on labels for update using (auth.uid() = user_id);

create policy "labels: delete own rows"
  on labels for delete using (auth.uid() = user_id);

-- task_labels: anyone can read; write gated on task ownership
create policy "task_labels: read all"
  on task_labels for select using (auth.uid() is not null);

create policy "task_labels: insert via task ownership"
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

create policy "task_relationships: insert via task ownership"
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

create policy "activity_log: insert via task ownership"
  on activity_log for insert with check (auth.uid() is not null);

-- team_invites: users can see invites they're part of; write own invites
create policy "team_invites: read own"
  on team_invites for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy "team_invites: insert as inviter"
  on team_invites for insert with check (auth.uid() = inviter_id);

create policy "team_invites: update as invitee"
  on team_invites for update using (auth.uid() = invitee_id);

create policy "team_invites: delete as inviter or invitee"
  on team_invites for delete
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- ============================================================
-- Indexes
-- ============================================================

create index on boards(invite_code);
create index on tasks(board_id);
create index on tasks(user_id);
create index on tasks(status);
create index on tasks(assignee_id);
create index on tasks(ref_key);
create index on tasks(parent_task_id);
create index on labels(board_id);
create index on task_labels(task_id);
create index on task_labels(label_id);
create index on task_relationships(from_task_id);
create index on task_relationships(to_task_id);
create index on activity_log(task_id);
create index on activity_log(created_at);
create index on team_invites(inviter_id);
create index on team_invites(invitee_id);
