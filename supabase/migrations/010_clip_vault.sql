-- KINEO-FAST-V4-2026-07-10 — CLIP VAULT (biblioteca própria de B-roll).
-- Every high-scoring stock clip the Fast pipeline picks gets copied into OUR
-- storage and indexed here. Over time this becomes a curated, on-brand library:
-- searches hit the vault FIRST (faster, consistent look, zero API dependency),
-- and it doubles as the CDN proxy that lets us re-enable Pexels (whose CDN
-- 403s Creatomate) by serving clips from our own bucket.

create table if not exists public.clip_vault (
  id uuid primary key default gen_random_uuid(),
  -- Original provider URL (dedup key — we never vault the same clip twice).
  source_url text not null unique,
  provider text not null default 'pixabay', -- pixabay | pexels
  -- Our public storage URL (bucket `broll`) — always Creatomate-fetchable.
  storage_url text not null,
  -- The query that found it + the provider's tags (lowercase, comma-separated).
  query text,
  tags text,
  -- Ranking score at pick time (higher = better production value/topic match).
  score int default 0,
  duration_sec numeric,
  uses int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists clip_vault_tags_idx on public.clip_vault using gin (to_tsvector('simple', coalesce(tags, '') || ' ' || coalesce(query, '')));
create index if not exists clip_vault_score_idx on public.clip_vault (score desc);

alter table public.clip_vault enable row level security;
-- Service role bypasses RLS; no public policies (reads happen server-side).

-- Storage bucket for the vaulted clips (public read so Creatomate can fetch).
insert into storage.buckets (id, name, public)
values ('broll', 'broll', true)
on conflict (id) do nothing;
