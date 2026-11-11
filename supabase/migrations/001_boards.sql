-- ── Boards ──────────────────────────────────────────────────────────────────
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'New Board',
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.boards enable row level security;

-- Anyone can read boards (access is gated by knowing the invite_code)
create policy "boards_select" on public.boards
  for select using (true);

-- Any authenticated user (including anonymous) can create a board
create policy "boards_insert" on public.boards
  for insert with check (auth.uid() is not null);

-- Any authenticated user can rename a board
create policy "boards_update" on public.boards
  for update using (auth.uid() is not null);


-- ── Add board_id to tasks ────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists board_id uuid references public.boards(id) on delete cascade;

-- Allow reads/writes scoped to a board (anyone who knows the board_id)
drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;

create policy "tasks_select" on public.tasks
  for select using (true);

create policy "tasks_insert" on public.tasks
  for insert with check (auth.uid() is not null);

create policy "tasks_update" on public.tasks
  for update using (auth.uid() is not null);

create policy "tasks_delete" on public.tasks
  for delete using (auth.uid() is not null);


-- ── Add board_id to labels ───────────────────────────────────────────────────
alter table public.labels
  add column if not exists board_id uuid references public.boards(id) on delete cascade;

drop policy if exists "labels_select" on public.labels;
drop policy if exists "labels_insert" on public.labels;

create policy "labels_select" on public.labels
  for select using (true);

create policy "labels_insert" on public.labels
  for insert with check (auth.uid() is not null);
