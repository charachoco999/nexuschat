-- Nexus v0.7.2 — robust MIME allowlist for profile images and custom fonts.
-- Safe to run more than once. Does not allow application/octet-stream.

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
