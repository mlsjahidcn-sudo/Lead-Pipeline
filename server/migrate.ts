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

  const already3 = await client.query('SELECT 1 FROM public._migrations WHERE name = $1', ['003_query_performance_indexes']);
  if (already3.rowCount && already3.rowCount > 0) {
    console.log('skip (already applied): 003_query_performance_indexes');
  } else {
    // Migration 003 — B-tree indexes for the hot read/write paths. Static DDL
    // literals, no interpolated values:
    //  - employees(user_id): resolveViewer / resolveOrgId / withUserTx hit this
    //    on EVERY authenticated request (previously a sequential scan)
    //  - leads(org_id, owner_id) and (org_id, created_at): counsellor-scoped
    //    bootstrap reads and the org-wide feed ordering
    //  - lead_activities(lead_id): counsellor bootstrap subquery + per-lead
    //    sync refresh lookups
    //  - tasks / visits / payments / stage_history: org-scoped bootstrap reads
    await client.query('CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees (user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_employees_org_created ON public.employees (org_id, created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leads_org_owner ON public.leads (org_id, owner_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads (org_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_lead_activities_org_occurred ON public.lead_activities (org_id, occurred_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities (lead_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_org_assigned ON public.follow_up_tasks (org_id, assigned_to)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_org_created ON public.follow_up_tasks (org_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_office_visits_org_counsellor ON public.office_visits (org_id, counsellor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_office_visits_org_scheduled ON public.office_visits (org_id, scheduled_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payments_org_lead ON public.payments (org_id, lead_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payments_org_paid_at ON public.payments (org_id, paid_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stage_history_org_changed ON public.stage_history (org_id, changed_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stage_history_lead_changed ON public.stage_history (lead_id, changed_at)');
    await client.query('INSERT INTO public._migrations (name) VALUES ($1)', ['003_query_performance_indexes']);
    console.log('applied: 003_query_performance_indexes');
  }

  const already4 = await client.query('SELECT 1 FROM public._migrations WHERE name = $1', ['004_quick_reply_templates']);
  if (already4.rowCount && already4.rowCount > 0) {
    console.log('skip (already applied): 004_quick_reply_templates');
  } else {
    // Migration 004 — editable WhatsApp quick replies (org-scoped). Rows are
    // created lazily: clients fall back to code defaults until a row is saved.
    await client.query('CREATE TABLE IF NOT EXISTS public.quick_reply_templates (id uuid PRIMARY KEY, org_id uuid NOT NULL, name text NOT NULL, step text NOT NULL DEFAULT \'\', language text NOT NULL DEFAULT \'en\', purpose text NOT NULL DEFAULT \'\', body text NOT NULL, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quick_replies_org ON public.quick_reply_templates (org_id, sort_order)');
    await client.query('INSERT INTO public._migrations (name) VALUES ($1)', ['004_quick_reply_templates']);
    console.log('applied: 004_quick_reply_templates');
  }
} finally {
  client.release();
  await pool.end();
}
