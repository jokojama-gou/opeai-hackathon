# Supabase DB certificate

`prod-ca-2021.crt` is the public Supabase Root 2021 CA certificate, downloaded on 2026-09-15 from the URL configured by the [official Supabase dashboard source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).

- Source: [Supabase production CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)
- SHA-256 of the downloaded file: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`
- Used only by the backend PostgreSQL connection with `sslmode=verify-full`. It is not installed into the system trust store.
- This is a public certificate, not a private key. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
