create table if not exists nba_top_props_daily_cache (
  cache_key text primary key,
  date_key text not null,
  game_id integer,
  timezone text not null default 'America/Toronto',
  season text,
  generated_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  props_count integer not null default 0,
  source text not null default 'computed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nba_top_props_daily_cache_date_idx
  on nba_top_props_daily_cache (date_key, updated_at desc);
