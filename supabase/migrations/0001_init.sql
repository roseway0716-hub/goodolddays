create extension if not exists "pgcrypto";

create table if not exists biographies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  elder_name text not null,
  author_style text not null check (author_style in ('YuHua', 'LiuZhenyun')),
  preface text,
  epilogue text,
  birth_year int,
  hometown text,
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  bio_id uuid not null references biographies(id) on delete cascade,
  stage_type text not null check (stage_type in ('0-12', '13-20', '21-35', '36-60', '61+')),
  raw_input text,
  ai_content text
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  url text not null,
  caption text,
  order_index int not null default 0,
  storage_path text
);
