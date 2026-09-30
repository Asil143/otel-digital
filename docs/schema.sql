-- Otel Digital V1 production schema draft.
-- Target database: PostgreSQL.

create table hotels (
  id text primary key,
  name text not null,
  timezone text not null,
  currency text not null,
  brand_promise text not null,
  created_at timestamptz not null default now()
);

create table users (
  id text primary key,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table hotel_memberships (
  hotel_id text not null references hotels(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('Hotel manager', 'Department manager', 'Admin')),
  primary key (hotel_id, user_id)
);

create table business_areas (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  area_key text not null check (area_key in ('rooms', 'spa', 'restaurant')),
  name text not null,
  manager_user_id text references users(id),
  created_at timestamptz not null default now(),
  unique (hotel_id, area_key)
);

create table file_assets (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  business_area_id text references business_areas(id) on delete set null,
  file_type text not null,
  storage_url text not null,
  original_filename text not null,
  usage_rights text,
  approval_state text not null default 'Not requested',
  extracted_facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table source_signals (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  business_area_id text not null references business_areas(id) on delete cascade,
  source_type text not null check (source_type in ('quick_update', 'file_upload', 'forwarded_email', 'adaptive_check_in', 'integration')),
  source_state text not null check (source_state in ('Confirmed', 'Detected', 'Approximate', 'Stale', 'Unavailable')),
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  summary text not null,
  extracted_fields jsonb not null default '{}'::jsonb,
  file_asset_id text references file_assets(id) on delete set null,
  confirmed_by text references users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table recommendations (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  business_area_id text not null references business_areas(id) on delete cascade,
  title text not null,
  summary text not null,
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  reasons jsonb not null default '[]'::jsonb,
  not_recommended jsonb not null default '[]'::jsonb,
  source_signal_ids text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table campaigns (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  business_area_id text not null references business_areas(id) on delete cascade,
  recommendation_id text references recommendations(id) on delete set null,
  name text not null,
  objective text not null,
  offer text not null,
  date_start date,
  date_end date,
  status text not null check (status in ('Draft', 'Generated', 'In review', 'Approved', 'Scheduled', 'Published', 'Completed', 'Failed')),
  created_by text references users(id),
  created_at timestamptz not null default now()
);

create table campaign_assets (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  channel text not null check (channel in ('Social', 'Design', 'Email', 'Website', 'Paid media')),
  template_id text,
  title text not null,
  content_json jsonb not null default '{}'::jsonb,
  preview_url text,
  approval_state text not null check (approval_state in ('Not requested', 'Pending', 'Approved', 'Changes requested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audiences (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  name text not null,
  provider_ref text,
  consent_basis text not null,
  suppression_status text not null default 'clean',
  segment_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table approvals (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  asset_id text references campaign_assets(id) on delete cascade,
  requested_by text references users(id),
  approver_role text not null,
  status text not null check (status in ('Pending', 'Approved', 'Changes requested')),
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table publish_jobs (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  channel text not null check (channel in ('email', 'wordpress', 'social', 'paid_media')),
  provider text not null,
  status text not null check (status in ('queued', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  published_url text,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table result_snapshots (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  source text not null,
  metrics jsonb not null default '{}'::jsonb,
  attribution_model text not null check (attribution_model in ('direct_click', 'assisted', 'manual_reconciliation')),
  imported_at timestamptz not null default now()
);

create table design_preferences (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  business_area_id text references business_areas(id) on delete cascade,
  feedback_type text not null,
  strength integer not null default 1,
  examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table audit_events (
  id text primary key,
  hotel_id text not null references hotels(id) on delete cascade,
  actor_user_id text references users(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
