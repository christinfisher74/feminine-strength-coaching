# Feminine Strength Co. — Master Client Platform v2

This folder is the reusable client app template for Feminine Strength Co.

## Architecture

One codebase serves every client.

- Authenticated client → sees only their own client record and data.
- Authenticated coach → sees only clients assigned to that coach.
- Exercises and workout templates are reusable platform assets.
- Workouts, check-ins, nutrition, movement, progress, notes, and resources are client-specific data.
- Client attachments use the private `client-attachments` Supabase Storage bucket.

There is intentionally no client name or client UUID hard-coded into `app.js`.

## Current Supabase setup

The database master schema has already been created in the Feminine Strength Co. Supabase project, along with RLS and the private `client-attachments` bucket policies.

`master_schema_v1_reference.sql` is the reference copy of the schema used for the master platform. Do not rerun it against a database that already contains these tables unless you are deliberately managing migrations.

## Configure the app

1. Open `config.js`.
2. Paste the existing Supabase public anon/publishable key into `SUPABASE_PUBLISHABLE_KEY`.
3. Never put a service-role or secret key in this file.
4. Deploy the folder to the single Feminine Strength Co. GitHub Pages app.

## Authentication

The app uses Supabase Auth email/password sign-in.

A client must have:
- a Supabase Auth user
- a matching row in `public.clients` with `user_id` set to that Auth user's UUID
- a `public.coach_clients` assignment linking the client to the coach

Coach users must have a `public.profiles` row with `role = 'coach'`.

## Existing prototype data

The old Aliyah prototype tables are intentionally not used by this master app:

- `aliyah_checkins`
- `aliyah_photos`
- `aliyah_plan`
- `aliyah_protein_log`
- `aliyah_sessions`
- `aliyah_wins`
- `subscriptions`

Those tables remain untouched so existing prototype data can be migrated deliberately later.

## Important

Do not create separate client apps for new clients. Add the client to the master database and assign programming to that client. The client receives the same app experience.
