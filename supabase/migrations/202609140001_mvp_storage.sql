create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Only the server's PostgreSQL connection reads application bodies.
-- Two-person MVP; domain/version checks run inside a shared transaction lock.
create table if not exists private.app_entities (
  kind text not null,
  id text not null,
  body jsonb not null,
  primary key (kind, id),
  check (jsonb_typeof(body) = 'object'),
  check (body ->> 'id' = id)
);
alter table private.app_entities enable row level security;
revoke all on private.app_entities from public, anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 26214400, array['audio/mp4'])
on conflict (id) do update set public = false;
-- No client Storage policies. Audio is uploaded/read through the authorized API.
