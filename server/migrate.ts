import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS public._migrations (name text primary key, applied_at timestamptz not null default now())');

  const already = await client.query('SELECT 1 FROM public._migrations WHERE name = $1', ['001_add_sync_columns']);
  if (already.rowCount && already.rowCount > 0) {
    console.log('skip (already applied): 001_add_sync_columns');
  } else {
    // Migration 001 — additive columns for client-side sync fields. Static literal.
    await client.query(`
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score_weight integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.leads
  ALTER COLUMN nurture_until TYPE timestamptz
  USING nurture_until AT TIME ZONE 'Asia/Dhaka';`);
    await client.query('INSERT INTO public._migrations (name) VALUES ($1)', ['001_add_sync_columns']);
    console.log('applied: 001_add_sync_columns');
  }

  const already2 = await client.query('SELECT 1 FROM public._migrations WHERE name = $1', ['002_task_priority_and_channel']);
  if (already2.rowCount && already2.rowCount > 0) {
    console.log('skip (already applied): 002_task_priority_and_channel');
  } else {
    // Migration 002 — task priority column + 'direct_chat' channel value + task title. Static literal.
    await client.query(`ALTER TABLE public.follow_up_tasks ADD COLUMN IF NOT EXISTS priority text`);
    await client.query(`ALTER TABLE public.follow_up_tasks ADD COLUMN IF NOT EXISTS title text`);
    await client.query(`ALTER TYPE public.lead_channel ADD VALUE IF NOT EXISTS 'direct_chat'`);
    await client.query('INSERT INTO public._migrations (name) VALUES ($1)', ['002_task_priority_and_channel']);
    console.log('applied: 002_task_priority_and_channel');
  }
} finally {
  client.release();
  await pool.end();
}
