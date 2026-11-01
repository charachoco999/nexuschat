-- Nexus v0.7.1 — repair profile font MIME allowlist.
-- Safe to run once after the v0.6 migration; re-running is harmless.
-- Do NOT add application/octet-stream: the client now sends explicit font MIME types.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  8388608,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'font/woff', 'font/woff2', 'font/ttf',
    'application/font-woff', 'application/font-woff2', 'application/x-font-ttf'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
