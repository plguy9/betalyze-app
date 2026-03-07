create table if not exists nba_odds_events_cache (
  date_key text primary key,
  league text not null default 'NBA',
  starts_after timestamptz,
  starts_before timestamptz,
  events jsonb not null default '[]'::jsonb,
  events_count integer not null default 0,
  source text not null default 'sportsgameodds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nba_odds_events_cache_updated_idx
  on nba_odds_events_cache (updated_at desc);

