create table if not exists public.workspace_states (
  id text not null,
  tool text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint workspace_states_pkey primary key (id, tool)
);

create index if not exists workspace_states_updated_idx
  on public.workspace_states (updated_at desc);
