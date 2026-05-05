alter table if exists photos
  add column if not exists insert_after_paragraph int not null default 0,
  add column if not exists annotation text,
  add column if not exists show_annotation boolean not null default false;
