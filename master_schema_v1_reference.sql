-- Feminine Strength Co. — Master Schema v1
-- Creates NEW reusable tables only.
-- DOES NOT alter/delete existing prototype tables.
-- Existing Aliyah data remains untouched.
-- Run only after reviewing this file.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('coach','client')),
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',
             new.raw_user_meta_data->>'full_name',
             new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text,
  preferred_name text,
  email text,
  phone text,
  date_of_birth date,
  goals text,
  coaching_focus text,
  active boolean not null default true,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_clients (
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_user_id, client_id)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  equipment text,
  muscle_focus text,
  coaching_cues text,
  video_url text,
  default_sets integer,
  default_reps_min integer,
  default_reps_max integer,
  default_duration_seconds integer,
  default_rest_seconds integer,
  timer_enabled boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  training_focus text,
  category text,
  created_by uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null default 0,
  prescribed_sets integer,
  prescribed_reps_min integer,
  prescribed_reps_max integer,
  prescribed_duration_seconds integer,
  rest_seconds integer,
  coaching_cues text,
  progression_rule text,
  optional boolean not null default false,
  timer_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.client_workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  name text not null,
  day_label text,
  scheduled_date date,
  training_focus text,
  description text,
  coach_notes text,
  completion_status text not null default 'assigned'
    check (completion_status in ('assigned','in_progress','completed','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  client_workout_id uuid not null references public.client_workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  sort_order integer not null default 0,
  exercise_name text not null,
  prescribed_sets integer,
  prescribed_reps_min integer,
  prescribed_reps_max integer,
  prescribed_duration_seconds integer,
  rest_seconds integer,
  coaching_cues text,
  progression_rule text,
  optional boolean not null default false,
  timer_enabled boolean not null default false,
  video_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_set_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_workout_id uuid not null references public.client_workouts(id) on delete cascade,
  client_workout_exercise_id uuid not null references public.client_workout_exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric,
  reps_completed integer,
  duration_seconds integer,
  rpe numeric,
  notes text,
  completed boolean not null default false,
  logged_at timestamptz not null default now()
);

create table if not exists public.checkin_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  field_key text not null,
  response_type text not null check (response_type in ('number','scale','text','boolean','select')),
  options jsonb not null default '[]'::jsonb,
  description text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_checkin_questions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  question_id uuid not null references public.checkin_questions(id) on delete cascade,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (client_id, question_id)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  checkin_date date not null,
  energy numeric,
  sleep numeric,
  stress numeric,
  recovery numeric,
  hydration numeric,
  nutrition_adherence numeric,
  movement numeric,
  cycle_info jsonb,
  symptoms text,
  feedback text,
  coach_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, checkin_date)
);

create table if not exists public.checkin_responses (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  question_id uuid not null references public.checkin_questions(id) on delete cascade,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (checkin_id, question_id)
);

create table if not exists public.nutrition_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  calorie_target numeric,
  protein_target_g numeric,
  carb_target_g numeric,
  fat_target_g numeric,
  hydration_target_oz numeric,
  approach text,
  dietary_requirements jsonb not null default '[]'::jsonb,
  minerals_guidance text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  log_date date not null,
  meal_name text,
  item text,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  calories numeric,
  water_oz numeric,
  electrolytes_logged boolean,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.movement_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  log_date date not null,
  activity_type text not null,
  duration_minutes numeric,
  steps integer,
  distance numeric,
  distance_unit text,
  intensity text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_date date not null,
  entry_type text not null,
  value_numeric numeric,
  value_text text,
  unit text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  private_to_coach boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_resources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  resource_type text,
  external_url text,
  storage_path text,
  file_name text,
  mime_type text,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_clients_client on public.coach_clients(client_id);
create index if not exists idx_client_workouts_client_date on public.client_workouts(client_id, scheduled_date);
create index if not exists idx_client_workout_exercises_workout on public.client_workout_exercises(client_workout_id, sort_order);
create index if not exists idx_workout_set_logs_client_date on public.workout_set_logs(client_id, logged_at);
create index if not exists idx_checkins_client_date on public.checkins(client_id, checkin_date);
create index if not exists idx_nutrition_logs_client_date on public.nutrition_logs(client_id, log_date);
create index if not exists idx_movement_logs_client_date on public.movement_logs(client_id, log_date);
create index if not exists idx_progress_entries_client_date on public.progress_entries(client_id, entry_date);
create index if not exists idx_coach_notes_client on public.coach_notes(client_id);
create index if not exists idx_client_resources_client on public.client_resources(client_id);

create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'coach'
  );
$$;

create or replace function public.is_client_owner(_client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.clients
    where id = _client_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_assigned_coach(_client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coach_clients
    where client_id = _client_id and coach_user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_coach() from public, anon;
revoke all on function public.is_client_owner(uuid) from public, anon;
revoke all on function public.is_assigned_coach(uuid) from public, anon;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.is_client_owner(uuid) to authenticated;
grant execute on function public.is_assigned_coach(uuid) to authenticated;

-- RLS on all new application tables
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.coach_clients enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.client_workouts enable row level security;
alter table public.client_workout_exercises enable row level security;
alter table public.workout_set_logs enable row level security;
alter table public.checkin_questions enable row level security;
alter table public.client_checkin_questions enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_responses enable row level security;
alter table public.nutrition_settings enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.movement_logs enable row level security;
alter table public.progress_entries enable row level security;
alter table public.coach_notes enable row level security;
alter table public.client_resources enable row level security;

revoke all on table
  public.profiles, public.clients, public.coach_clients, public.exercises,
  public.workout_templates, public.workout_template_exercises,
  public.client_workouts, public.client_workout_exercises, public.workout_set_logs,
  public.checkin_questions, public.client_checkin_questions, public.checkins,
  public.checkin_responses, public.nutrition_settings, public.nutrition_logs,
  public.movement_logs, public.progress_entries, public.coach_notes, public.client_resources
from anon, authenticated;

grant select, insert, update, delete on table
  public.profiles, public.clients, public.coach_clients, public.exercises,
  public.workout_templates, public.workout_template_exercises,
  public.client_workouts, public.client_workout_exercises, public.workout_set_logs,
  public.checkin_questions, public.client_checkin_questions, public.checkins,
  public.checkin_responses, public.nutrition_settings, public.nutrition_logs,
  public.movement_logs, public.progress_entries, public.coach_notes, public.client_resources
to authenticated;

-- Profiles
create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_select_assigned_clients" on public.profiles for select to authenticated
using (
  public.is_coach() and exists (
    select 1 from public.clients c
    join public.coach_clients cc on cc.client_id = c.id
    where cc.coach_user_id = (select auth.uid()) and c.user_id = profiles.id
  )
);

-- Clients
create policy "clients_select_own_or_assigned" on public.clients for select to authenticated
using (public.is_client_owner(id) or public.is_assigned_coach(id));

create policy "clients_insert_coach" on public.clients for insert to authenticated
with check (public.is_coach());

create policy "clients_update_coach" on public.clients for update to authenticated
using (public.is_coach()) with check (public.is_coach());

create policy "clients_delete_coach" on public.clients for delete to authenticated
using (public.is_coach());

-- Coach assignments
create policy "coach_clients_select" on public.coach_clients for select to authenticated
using (coach_user_id = (select auth.uid()) or public.is_client_owner(client_id));

create policy "coach_clients_insert" on public.coach_clients for insert to authenticated
with check (public.is_coach() and coach_user_id = (select auth.uid()));

create policy "coach_clients_delete" on public.coach_clients for delete to authenticated
using (public.is_coach() and coach_user_id = (select auth.uid()));

-- Exercise/template libraries
create policy "exercises_select" on public.exercises for select to authenticated using (true);
create policy "exercises_manage_coach" on public.exercises for all to authenticated
using (public.is_coach()) with check (public.is_coach());

create policy "templates_select" on public.workout_templates for select to authenticated
using (active = true or public.is_coach());
create policy "templates_manage_coach" on public.workout_templates for all to authenticated
using (public.is_coach()) with check (public.is_coach());

create policy "template_exercises_select" on public.workout_template_exercises for select to authenticated using (true);
create policy "template_exercises_manage_coach" on public.workout_template_exercises for all to authenticated
using (public.is_coach()) with check (public.is_coach());

-- Client workouts
create policy "client_workouts_select" on public.client_workouts for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "client_workouts_manage_coach" on public.client_workouts for all to authenticated
using (public.is_assigned_coach(client_id)) with check (public.is_assigned_coach(client_id));

create policy "client_workout_exercises_select" on public.client_workout_exercises for select to authenticated
using (
  exists (
    select 1 from public.client_workouts cw
    where cw.id = client_workout_exercises.client_workout_id
      and (public.is_client_owner(cw.client_id) or public.is_assigned_coach(cw.client_id))
  )
);

create policy "client_workout_exercises_manage_coach" on public.client_workout_exercises for all to authenticated
using (
  exists (
    select 1 from public.client_workouts cw
    where cw.id = client_workout_exercises.client_workout_id
      and public.is_assigned_coach(cw.client_id)
  )
)
with check (
  exists (
    select 1 from public.client_workouts cw
    where cw.id = client_workout_exercises.client_workout_id
      and public.is_assigned_coach(cw.client_id)
  )
);

-- Set logs
create policy "workout_set_logs_select" on public.workout_set_logs for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "workout_set_logs_insert" on public.workout_set_logs for insert to authenticated
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "workout_set_logs_update" on public.workout_set_logs for update to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id))
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "workout_set_logs_delete" on public.workout_set_logs for delete to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

-- Check-in questions
create policy "checkin_questions_select" on public.checkin_questions for select to authenticated
using (active = true or public.is_coach());

create policy "checkin_questions_manage_coach" on public.checkin_questions for all to authenticated
using (public.is_coach()) with check (public.is_coach());

create policy "client_checkin_questions_select" on public.client_checkin_questions for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "client_checkin_questions_manage_coach" on public.client_checkin_questions for all to authenticated
using (public.is_assigned_coach(client_id)) with check (public.is_assigned_coach(client_id));

-- Check-ins
create policy "checkins_select" on public.checkins for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "checkins_insert" on public.checkins for insert to authenticated
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "checkins_update" on public.checkins for update to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id))
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "checkins_delete" on public.checkins for delete to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "checkin_responses_select" on public.checkin_responses for select to authenticated
using (
  exists (
    select 1 from public.checkins c
    where c.id = checkin_responses.checkin_id
      and (public.is_client_owner(c.client_id) or public.is_assigned_coach(c.client_id))
  )
);

create policy "checkin_responses_manage" on public.checkin_responses for all to authenticated
using (
  exists (
    select 1 from public.checkins c
    where c.id = checkin_responses.checkin_id
      and (public.is_client_owner(c.client_id) or public.is_assigned_coach(c.client_id))
  )
)
with check (
  exists (
    select 1 from public.checkins c
    where c.id = checkin_responses.checkin_id
      and (public.is_client_owner(c.client_id) or public.is_assigned_coach(c.client_id))
  )
);

-- Nutrition
create policy "nutrition_settings_select" on public.nutrition_settings for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "nutrition_settings_manage" on public.nutrition_settings for all to authenticated
using (public.is_assigned_coach(client_id)) with check (public.is_assigned_coach(client_id));

create policy "nutrition_logs_select" on public.nutrition_logs for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "nutrition_logs_manage" on public.nutrition_logs for all to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id))
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

-- Movement
create policy "movement_logs_select" on public.movement_logs for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "movement_logs_manage" on public.movement_logs for all to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id))
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

-- Progress
create policy "progress_entries_select" on public.progress_entries for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "progress_entries_manage" on public.progress_entries for all to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id))
with check (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

-- Coach notes
create policy "coach_notes_select" on public.coach_notes for select to authenticated
using (
  public.is_assigned_coach(client_id)
  or (private_to_coach = false and public.is_client_owner(client_id))
);

create policy "coach_notes_manage" on public.coach_notes for all to authenticated
using (public.is_assigned_coach(client_id))
with check (public.is_assigned_coach(client_id) and coach_user_id = (select auth.uid()));

-- Resources
create policy "client_resources_select" on public.client_resources for select to authenticated
using (public.is_client_owner(client_id) or public.is_assigned_coach(client_id));

create policy "client_resources_manage_coach" on public.client_resources for all to authenticated
using (public.is_assigned_coach(client_id)) with check (public.is_assigned_coach(client_id));

-- Updated-at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clients','exercises','workout_templates',
    'client_workouts','checkins','nutrition_settings','coach_notes'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute procedure public.set_updated_at()', t
    );
  end loop;
end $$;

commit;

-- Storage is intentionally NOT modified in this first migration.
-- The private client-attachments bucket and storage.objects policies
-- will be created in the next controlled step.
