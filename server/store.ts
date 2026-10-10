import { pool, withUserTx } from './db';

/**
 * Wire-format store: reads every org table for bootstrap and applies
 * client changesets as idempotent upserts.
 *
 * Security model:
 *  - client rows are sanitized (typed + enum/uuid/length-checked), then sent
 *    to Postgres as ONE jsonb parameter per table; every SQL statement below
 *    is a static literal — no identifiers or values are ever interpolated
 *  - org_id is injected server-side from the authenticated user's employee
 *    row; the client can never choose an org
 *  - `score`, `updated_at` and stage_history rows are server-owned: DB
 *    triggers recompute them and we return the authoritative rows
 */

type Row = Record<string, unknown>;

export class ValidationError extends Error {}

// ---------------------------------------------------------------------------
// Validators (client wire row -> typed JSON object for the jsonb parameter)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function vUuid(row: Row, key: string, required: boolean): string | null {
  const v = row[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(`${key}: required uuid missing`);
    return null;
  }
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new ValidationError(`${key}: not a uuid (${v})`);
  return v;
}

function vText(row: Row, key: string, maxLen = 4096, required = false): string | null {
  const v = row[key];
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(`${key}: required text missing`);
    return null;
  }
  if (typeof v !== 'string') throw new ValidationError(`${key}: not a string`);
  if (v.length > maxLen) throw new ValidationError(`${key}: too long (${v.length} > ${maxLen})`);
  return v;
}

function vEnum<T extends string>(row: Row, key: string, allowed: readonly T[], required = false): T | null {
  const v = row[key];
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(`${key}: required enum missing`);
    return null;
  }
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new ValidationError(`${key}: not one of ${allowed.join('|')} (got ${v})`);
  }
  return v as T;
}

function vBool(row: Row, key: string): boolean | null {
  const v = row[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'boolean') throw new ValidationError(`${key}: not a boolean`);
  return v;
}

function vInt(row: Row, key: string, min: number, max: number): number | null {
  const v = row[key];
  if (v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${key}: not an int in [${min},${max}]`);
  return n;
}

function vNum(row: Row, key: string): number | null {
  const v = row[key];
  if (v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${key}: not a non-negative number`);
  return n;
}

function vDate(row: Row, key: string, fallback?: string): string | null {
  const v = row[key];
  if (v === undefined || v === null || v === '') return fallback ?? null;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${key}: not a valid date (${v})`);
  return d.toISOString();
}

function vStrArr(row: Row, key: string): string[] | null {
  const v = row[key];
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.length > 64)) {
    throw new ValidationError(`${key}: not a string array`);
  }
  return (v as string[]).slice(0, 20);
}

// enum value sets (mirror the DB types)
const LEAD_STAGES = ['new', 'contacted', 'qualified', 'consultation_booked', 'consultation_done', 'office_visit_booked', 'office_visit_done', 'paid', 'enrolled', 'lost', 'nurture'] as const;
const TEMPERATURES = ['hot', 'warm', 'cold'] as const;
const ACTIVITY_TYPES = ['call', 'whatsapp', 'sms', 'email', 'meeting', 'consultation', 'office_visit', 'note', 'system'] as const;
const ACTIVITY_OUTCOMES = ['connected', 'no_answer', 'busy', 'switched_off', 'wrong_number', 'replied', 'no_reply', 'booked', 'not_interested', 'other'] as const;
const TASK_STATUSES = ['open', 'done', 'skipped', 'cancelled'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
const VISIT_STATUSES = ['booked', 'confirmed', 'attended', 'no_show', 'rescheduled', 'cancelled'] as const;
const ROLES = ['admin', 'manager', 'counsellor'] as const;
const PACKAGES = ['guidance', 'complete_admission'] as const;
const PAYMENT_TYPES = ['package_fee', 'deposit', 'instalment'] as const;
const VISIT_MODES = ['office', 'video'] as const;
const DIRECTIONS = ['outbound', 'inbound'] as const;
const COUNTRIES = ['BD', 'IN', 'PK', 'NP', 'OTHER'] as const;

// ---------------------------------------------------------------------------
// Sanitizers — one per syncable table
// ---------------------------------------------------------------------------

function sanitizeLead(row: Row): Row {
  return {
    id: vUuid(row, 'id', true),
    full_name: vText(row, 'full_name', 200, true),
    phone_raw: vText(row, 'phone_raw', 40),
    phone_e164: vText(row, 'phone_e164', 24),
    whatsapp_e164: vText(row, 'whatsapp_e164', 24),
    email: vText(row, 'email', 320),
    city: vText(row, 'city', 120),
    country: vEnum(row, 'country', COUNTRIES) ?? 'BD',
    source_id: vUuid(row, 'source_id', false),
    source_ref: vText(row, 'source_ref', 200),
    owner_id: vUuid(row, 'owner_id', false),
    stage: vEnum(row, 'stage', LEAD_STAGES, true),
    temperature: vEnum(row, 'temperature', TEMPERATURES, true),
    score_weight: vInt(row, 'score_weight', 1, 10),
    education_level: vText(row, 'education_level', 120),
    last_result: vText(row, 'last_result', 120),
    target_degree: vText(row, 'target_degree', 160),
    target_programme: vText(row, 'target_programme', 160),
    target_intake: vText(row, 'target_intake', 80),
    english_level: vText(row, 'english_level', 120),
    funding_confirmed: vBool(row, 'funding_confirmed'),
    parent_involved: vBool(row, 'parent_involved'),
    has_passport: vBool(row, 'has_passport'),
    first_contact_at: vDate(row, 'first_contact_at'),
    next_action_at: vDate(row, 'next_action_at'),
    next_action_note: vText(row, 'next_action_note', 400),
    lost_reason_id: vInt(row, 'lost_reason_id', 1, 9999),
    lost_note: vText(row, 'lost_note', 1000),
    nurture_until: vDate(row, 'nurture_until'),
    duplicate_of: vUuid(row, 'duplicate_of', false),
    tags: vStrArr(row, 'tags') ?? [],
  };
}

function sanitizeActivity(row: Row): Row {
  return {
    id: vUuid(row, 'id', true),
    lead_id: vUuid(row, 'lead_id', true),
    employee_id: vUuid(row, 'employee_id', false),
    activity_type: vEnum(row, 'activity_type', ACTIVITY_TYPES, true),
    direction: vEnum(row, 'direction', DIRECTIONS),
    outcome: vEnum(row, 'outcome', ACTIVITY_OUTCOMES),
    summary: vText(row, 'summary', 2000, true),
    next_action_at: vDate(row, 'next_action_at'),
    next_action_note: vText(row, 'next_action_note', 400),
    occurred_at: vDate(row, 'occurred_at', new Date().toISOString()),
  };
}

function sanitizeTask(row: Row): Row {
  return {
    id: vUuid(row, 'id', true),
    lead_id: vUuid(row, 'lead_id', true),
    assigned_to: vUuid(row, 'assigned_to', true),
    task_type: vText(row, 'task_type', 40, true),
    cadence_step: vInt(row, 'cadence_step', 0, 365),
    due_at: vDate(row, 'due_at', new Date().toISOString()),
    status: vEnum(row, 'status', TASK_STATUSES, true),
    priority: vEnum(row, 'priority', TASK_PRIORITIES),
    completed_at: vDate(row, 'completed_at'),
    activity_id: vUuid(row, 'activity_id', false),
    title: vText(row, 'title', 300, true),
  };
}

function sanitizeVisit(row: Row): Row {
  return {
    id: vUuid(row, 'id', true),
    lead_id: vUuid(row, 'lead_id', true),
    counsellor_id: vUuid(row, 'counsellor_id', false),
    scheduled_at: vDate(row, 'scheduled_at', new Date().toISOString()),
    duration_min: vInt(row, 'duration_min', 5, 480) ?? 45,
    mode: vEnum(row, 'mode', VISIT_MODES, true),
    attendees: vText(row, 'attendees', 300),
    status: vEnum(row, 'status', VISIT_STATUSES, true),
    outcome_note: vText(row, 'outcome_note', 2000),
  };
}

function sanitizePayment(row: Row): Row {
  return {
    id: vUuid(row, 'id', true),
    lead_id: vUuid(row, 'lead_id', true),
    package: vEnum(row, 'package', PACKAGES, true),
    payment_type: vEnum(row, 'payment_type', PAYMENT_TYPES, true),
    amount: vNum(row, 'amount'),
    currency: vText(row, 'currency', 8) ?? 'BDT',
    paid_at: vDate(row, 'paid_at', new Date().toISOString()),
    method: vText(row, 'method', 60),
    receipt_ref: vText(row, 'receipt_ref', 100),
    recorded_by: vUuid(row, 'recorded_by', false),
    verified_by: vUuid(row, 'verified_by', false),
    verified_at: vDate(row, 'verified_at'),
  };
}

function sanitizeEmployeeUpdate(row: Row): Row {
  return {
    id: vUuid(row, 'id', true),
    full_name: row.full_name === undefined ? null : vText(row, 'full_name', 200),
    phone_e164: row.phone_e164 === undefined ? null : vText(row, 'phone_e164', 24),
    role: row.role === undefined ? null : vEnum(row, 'role', ROLES),
    is_active: row.is_active === undefined ? null : vBool(row, 'is_active'),
    accepts_new_leads: row.accepts_new_leads === undefined ? null : vBool(row, 'accepts_new_leads'),
    last_assigned_at: row.last_assigned_at === undefined ? null : vDate(row, 'last_assigned_at'),
    title: row.title === undefined ? null : vText(row, 'title', 200),
  };
}

// ---------------------------------------------------------------------------
// Literal upsert statements. Each takes ($1 = jsonb rows, $2 = org_id) and
// unpacks with jsonb_array_elements — column names are static SQL literals.
// ---------------------------------------------------------------------------

const UPSERT_LEADS = `
INSERT INTO public.leads
  (id, org_id, full_name, phone_raw, phone_e164, whatsapp_e164, email, city, country,
   source_id, source_ref, owner_id, stage, temperature, score_weight, education_level,
   last_result, target_degree, target_programme, target_intake, english_level,
   funding_confirmed, parent_involved, has_passport, first_contact_at, next_action_at,
   next_action_note, lost_reason_id, lost_note, nurture_until, duplicate_of, tags)
SELECT
  (r->>'id')::uuid, $2::uuid, r->>'full_name', r->>'phone_raw', r->>'phone_e164',
  r->>'whatsapp_e164', r->>'email', r->>'city', r->>'country',
  (r->>'source_id')::uuid, r->>'source_ref', (r->>'owner_id')::uuid,
  (r->>'stage')::public.lead_stage, (r->>'temperature')::public.lead_temperature,
  (r->>'score_weight')::integer, r->>'education_level', r->>'last_result',
  r->>'target_degree', r->>'target_programme', r->>'target_intake', r->>'english_level',
  (r->>'funding_confirmed')::boolean, (r->>'parent_involved')::boolean,
  (r->>'has_passport')::boolean, (r->>'first_contact_at')::timestamptz,
  (r->>'next_action_at')::timestamptz, r->>'next_action_note',
  (r->>'lost_reason_id')::smallint, r->>'lost_note', (r->>'nurture_until')::timestamptz,
  (r->>'duplicate_of')::uuid,
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(r->'tags', '[]'::jsonb)))
FROM jsonb_array_elements($1::jsonb) AS r
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name, phone_raw = EXCLUDED.phone_raw,
  phone_e164 = EXCLUDED.phone_e164, whatsapp_e164 = EXCLUDED.whatsapp_e164,
  email = EXCLUDED.email, city = EXCLUDED.city, country = EXCLUDED.country,
  source_id = EXCLUDED.source_id, source_ref = EXCLUDED.source_ref,
  owner_id = EXCLUDED.owner_id, stage = EXCLUDED.stage, temperature = EXCLUDED.temperature,
  score_weight = EXCLUDED.score_weight, education_level = EXCLUDED.education_level,
  last_result = EXCLUDED.last_result, target_degree = EXCLUDED.target_degree,
  target_programme = EXCLUDED.target_programme, target_intake = EXCLUDED.target_intake,
  english_level = EXCLUDED.english_level, funding_confirmed = EXCLUDED.funding_confirmed,
  parent_involved = EXCLUDED.parent_involved, has_passport = EXCLUDED.has_passport,
  first_contact_at = EXCLUDED.first_contact_at, next_action_at = EXCLUDED.next_action_at,
  next_action_note = EXCLUDED.next_action_note, lost_reason_id = EXCLUDED.lost_reason_id,
  lost_note = EXCLUDED.lost_note, nurture_until = EXCLUDED.nurture_until,
  duplicate_of = EXCLUDED.duplicate_of, tags = EXCLUDED.tags`;

const UPSERT_ACTIVITIES = `
INSERT INTO public.lead_activities
  (id, org_id, lead_id, employee_id, activity_type, direction, outcome, summary,
   next_action_at, next_action_note, occurred_at)
SELECT
  (r->>'id')::uuid, $2::uuid, (r->>'lead_id')::uuid, (r->>'employee_id')::uuid,
  (r->>'activity_type')::public.activity_type, r->>'direction',
  (r->>'outcome')::public.activity_outcome, r->>'summary',
  (r->>'next_action_at')::timestamptz, r->>'next_action_note',
  (r->>'occurred_at')::timestamptz
FROM jsonb_array_elements($1::jsonb) AS r
ON CONFLICT (id) DO UPDATE SET
  lead_id = EXCLUDED.lead_id, employee_id = EXCLUDED.employee_id,
  activity_type = EXCLUDED.activity_type, direction = EXCLUDED.direction,
  outcome = EXCLUDED.outcome, summary = EXCLUDED.summary,
  next_action_at = EXCLUDED.next_action_at, next_action_note = EXCLUDED.next_action_note,
  occurred_at = EXCLUDED.occurred_at`;

const UPSERT_TASKS = `
INSERT INTO public.follow_up_tasks
  (id, org_id, lead_id, assigned_to, task_type, cadence_step, due_at, status, priority,
   completed_at, activity_id, title)
SELECT
  (r->>'id')::uuid, $2::uuid, (r->>'lead_id')::uuid, (r->>'assigned_to')::uuid,
  r->>'task_type', (r->>'cadence_step')::smallint, (r->>'due_at')::timestamptz,
  (r->>'status')::public.task_status, r->>'priority', (r->>'completed_at')::timestamptz,
  (r->>'activity_id')::uuid, r->>'title'
FROM jsonb_array_elements($1::jsonb) AS r
ON CONFLICT (id) DO UPDATE SET
  lead_id = EXCLUDED.lead_id, assigned_to = EXCLUDED.assigned_to,
  task_type = EXCLUDED.task_type, cadence_step = EXCLUDED.cadence_step,
  due_at = EXCLUDED.due_at, status = EXCLUDED.status, priority = EXCLUDED.priority,
  completed_at = EXCLUDED.completed_at, activity_id = EXCLUDED.activity_id,
  title = EXCLUDED.title`;

const UPSERT_VISITS = `
INSERT INTO public.office_visits
  (id, org_id, lead_id, counsellor_id, scheduled_at, duration_min, mode, attendees,
   status, outcome_note)
SELECT
  (r->>'id')::uuid, $2::uuid, (r->>'lead_id')::uuid, (r->>'counsellor_id')::uuid,
  (r->>'scheduled_at')::timestamptz, (r->>'duration_min')::integer, r->>'mode',
  r->>'attendees', (r->>'status')::public.visit_status, r->>'outcome_note'
FROM jsonb_array_elements($1::jsonb) AS r
ON CONFLICT (id) DO UPDATE SET
  lead_id = EXCLUDED.lead_id, counsellor_id = EXCLUDED.counsellor_id,
  scheduled_at = EXCLUDED.scheduled_at, duration_min = EXCLUDED.duration_min,
  mode = EXCLUDED.mode, attendees = EXCLUDED.attendees, status = EXCLUDED.status,
  outcome_note = EXCLUDED.outcome_note`;

const UPSERT_PAYMENTS = `
INSERT INTO public.payments
  (id, org_id, lead_id, package, payment_type, amount, currency, paid_at, method,
   receipt_ref, recorded_by, verified_by, verified_at)
SELECT
  (r->>'id')::uuid, $2::uuid, (r->>'lead_id')::uuid, r->>'package', r->>'payment_type',
  (r->>'amount')::numeric, r->>'currency', (r->>'paid_at')::timestamptz, r->>'method',
  r->>'receipt_ref', (r->>'recorded_by')::uuid, (r->>'verified_by')::uuid,
  (r->>'verified_at')::timestamptz
FROM jsonb_array_elements($1::jsonb) AS r
ON CONFLICT (id) DO UPDATE SET
  lead_id = EXCLUDED.lead_id, package = EXCLUDED.package,
  payment_type = EXCLUDED.payment_type, amount = EXCLUDED.amount,
  currency = EXCLUDED.currency, paid_at = EXCLUDED.paid_at, method = EXCLUDED.method,
  receipt_ref = EXCLUDED.receipt_ref, recorded_by = EXCLUDED.recorded_by,
  verified_by = EXCLUDED.verified_by, verified_at = EXCLUDED.verified_at`;

const UPDATE_EMPLOYEES = `
UPDATE public.employees e SET
  full_name = COALESCE(v.full_name, e.full_name),
  phone_e164 = COALESCE(v.phone_e164, e.phone_e164),
  role = COALESCE(v.role, e.role),
  is_active = COALESCE(v.is_active, e.is_active),
  accepts_new_leads = COALESCE(v.accepts_new_leads, e.accepts_new_leads),
  last_assigned_at = COALESCE(v.last_assigned_at, e.last_assigned_at),
  title = COALESCE(v.title, e.title),
  updated_at = now()
FROM (
  SELECT
    (r->>'id')::uuid AS id,
    r->>'full_name' AS full_name,
    r->>'phone_e164' AS phone_e164,
    (r->>'role')::public.app_role AS role,
    (r->>'is_active')::boolean AS is_active,
    (r->>'accepts_new_leads')::boolean AS accepts_new_leads,
    (r->>'last_assigned_at')::timestamptz AS last_assigned_at,
    r->>'title' AS title
  FROM jsonb_array_elements($1::jsonb) AS r
) v
WHERE e.id = v.id AND e.org_id = $2`;

// ---------------------------------------------------------------------------
// Wire-format mappers (DB row -> client row)
// ---------------------------------------------------------------------------

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const num = (v: unknown): number | null => (v == null ? null : Number(v));

const mapLead = (r: Row): Row => ({
  id: r.id, full_name: r.full_name, phone_raw: r.phone_raw, phone_e164: r.phone_e164,
  whatsapp_e164: r.whatsapp_e164, email: r.email, city: r.city, country: r.country,
  source_id: r.source_id, source_ref: r.source_ref, owner_id: r.owner_id, stage: r.stage,
  temperature: r.temperature, score: r.score, score_weight: r.score_weight,
  education_level: r.education_level, last_result: r.last_result, target_degree: r.target_degree,
  target_programme: r.target_programme, target_intake: r.target_intake, english_level: r.english_level,
  funding_confirmed: r.funding_confirmed, parent_involved: r.parent_involved, has_passport: r.has_passport,
  first_contact_at: iso(r.first_contact_at), next_action_at: iso(r.next_action_at),
  next_action_note: r.next_action_note, lost_reason_id: r.lost_reason_id, lost_note: r.lost_note,
  nurture_until: iso(r.nurture_until), duplicate_of: r.duplicate_of, tags: r.tags ?? [],
  created_at: iso(r.created_at), updated_at: iso(r.updated_at),
});

const mapEmployee = (r: Row): Row => ({
  id: r.id,
  user_id: r.user_id ?? null, // null for counsellor-scoped reads (names+roles only)
  full_name: r.full_name,
  email: r.email ?? null,
  phone_e164: r.phone_e164 ?? null,
  role: r.role,
  is_active: r.is_active,
  accepts_new_leads: r.accepts_new_leads,
  last_assigned_at: iso(r.last_assigned_at),
  created_at: iso(r.created_at),
  title: r.title ?? null,
});

const mapSource = (r: Row): Row => ({
  id: r.id, channel: r.channel, name: r.name, campaign: r.campaign,
  utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign,
  default_owner_id: r.default_owner_id, is_active: r.is_active,
});

const mapLostReason = (r: Row): Row => ({
  id: r.id, code: r.code, label: r.label, requires_note: r.requires_note, sort_order: r.sort_order,
});

const mapActivity = (r: Row): Row => ({
  id: r.id, lead_id: r.lead_id, employee_id: r.employee_id, activity_type: r.activity_type,
  direction: r.direction, outcome: r.outcome, summary: r.summary,
  next_action_at: iso(r.next_action_at), next_action_note: r.next_action_note,
  occurred_at: iso(r.occurred_at), created_at: iso(r.created_at),
});

const mapTask = (r: Row): Row => ({
  id: r.id, lead_id: r.lead_id, assigned_to: r.assigned_to, task_type: r.task_type,
  cadence_step: r.cadence_step, due_at: iso(r.due_at), status: r.status,
  priority: r.priority, completed_at: iso(r.completed_at), activity_id: r.activity_id,
  title: r.title, created_at: iso(r.created_at),
});

const mapVisit = (r: Row): Row => ({
  id: r.id, lead_id: r.lead_id, counsellor_id: r.counsellor_id, scheduled_at: iso(r.scheduled_at),
  duration_min: r.duration_min, mode: r.mode, attendees: r.attendees, status: r.status,
  outcome_note: r.outcome_note, created_at: iso(r.created_at),
});

const mapPayment = (r: Row): Row => ({
  id: r.id, lead_id: r.lead_id, package: r.package, payment_type: r.payment_type,
  amount: num(r.amount), currency: r.currency, paid_at: iso(r.paid_at), method: r.method,
  receipt_ref: r.receipt_ref, recorded_by: r.recorded_by, verified_by: r.verified_by,
  verified_at: iso(r.verified_at),
});

const mapStageHistory = (r: Row): Row => ({
  id: String(r.id), lead_id: r.lead_id, from_stage: r.from_stage, to_stage: r.to_stage,
  changed_by: r.changed_by, changed_at: iso(r.changed_at), note: r.note,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function resolveOrgId(userId: string): Promise<string | null> {
  const res = await pool.query('SELECT org_id FROM public.employees WHERE user_id = $1 LIMIT 1', [userId]);
  return res.rowCount ? (res.rows[0].org_id as string) : null;
}

/**
 * Who is asking: org, employee row id, and role. Counsellor scoping is
 * decided from this — managers/admins see the whole org.
 */
export interface Viewer {
  userId: string;
  orgId: string;
  employeeId: string;
  role: 'admin' | 'manager' | 'counsellor';
}

export async function resolveViewer(userId: string): Promise<Viewer | null> {
  const res = await pool.query(
    'SELECT org_id, id, role FROM public.employees WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (!res.rowCount) return null;
  const row = res.rows[0] as { org_id: string; id: string; role: Viewer['role'] };
  return { userId, orgId: row.org_id, employeeId: row.id, role: row.role };
}

export interface BootstrapPayload {
  orgId: string;
  // Server-stated identity of the requesting viewer. The client must resolve
  // currentEmployee from this — counsellor-scoped employees rows omit user_id,
  // so a session-user_id match cannot identify a counsellor.
  viewer?: { employeeId: string; role: Viewer['role'] };
  employees: Row[];
  sources: Row[];
  lostReasons: Row[];
  leads: Row[];
  activities: Row[];
  tasks: Row[];
  visits: Row[];
  payments: Row[];
  stageHistory: Row[];
  serverTime: string;
}

export async function bootstrap(orgId: string, viewer?: Viewer): Promise<BootstrapPayload> {
  const scoped = viewer?.role === 'counsellor';
  const employeeId = viewer?.employeeId ?? '';
  const params = [orgId, employeeId];

  const client = await pool.connect();
  try {
    const [employees, sources, lostReasons, leads, activities, tasks, visits, payments, stageHistory] = await Promise.all([
      // Counsellors get a names+roles directory only — no colleagues'
      // emails / phone numbers / auth bindings.
      scoped
        ? client.query(
            'SELECT id, full_name, role, is_active, accepts_new_leads, last_assigned_at, created_at FROM public.employees WHERE org_id = $1 ORDER BY created_at',
            [orgId]
          )
        : client.query('SELECT * FROM public.employees WHERE org_id = $1 ORDER BY created_at', [orgId]),
      // lead_sources are reference data; return all (they're not org-scoped at the
      // application level even though the schema carries org_id for tenancy tracking)
      client.query('SELECT * FROM public.lead_sources ORDER BY created_at'),
      client.query('SELECT * FROM public.lost_reasons ORDER BY sort_order'),
      scoped
        ? client.query('SELECT * FROM public.leads WHERE org_id = $1 AND owner_id = $2 ORDER BY created_at DESC', params)
        : client.query('SELECT * FROM public.leads WHERE org_id = $1 ORDER BY created_at DESC', [orgId]),
      scoped
        ? client.query(
            'SELECT * FROM public.lead_activities WHERE org_id = $1 AND lead_id IN (SELECT id FROM public.leads WHERE org_id = $1 AND owner_id = $2) ORDER BY occurred_at DESC',
            params
          )
        : client.query('SELECT * FROM public.lead_activities WHERE org_id = $1 ORDER BY occurred_at DESC', [orgId]),
      scoped
        ? client.query('SELECT * FROM public.follow_up_tasks WHERE org_id = $1 AND assigned_to = $2 ORDER BY created_at DESC', params)
        : client.query('SELECT * FROM public.follow_up_tasks WHERE org_id = $1 ORDER BY created_at DESC', [orgId]),
      scoped
        ? client.query(
            'SELECT * FROM public.office_visits WHERE org_id = $1 AND (counsellor_id = $2 OR lead_id IN (SELECT id FROM public.leads WHERE org_id = $1 AND owner_id = $2)) ORDER BY scheduled_at DESC',
            params
          )
        : client.query('SELECT * FROM public.office_visits WHERE org_id = $1 ORDER BY scheduled_at DESC', [orgId]),
      scoped
        ? client.query(
            'SELECT * FROM public.payments WHERE org_id = $1 AND lead_id IN (SELECT id FROM public.leads WHERE org_id = $1 AND owner_id = $2) ORDER BY paid_at DESC',
            params
          )
        : client.query('SELECT * FROM public.payments WHERE org_id = $1 ORDER BY paid_at DESC', [orgId]),
      scoped
        ? client.query(
            'SELECT * FROM public.stage_history WHERE org_id = $1 AND lead_id IN (SELECT id FROM public.leads WHERE org_id = $1 AND owner_id = $2) ORDER BY changed_at DESC LIMIT 2000',
            params
          )
        : client.query('SELECT * FROM public.stage_history WHERE org_id = $1 ORDER BY changed_at DESC LIMIT 2000', [orgId]),
    ]);
    return {
      orgId,
      viewer: viewer ? { employeeId: viewer.employeeId, role: viewer.role } : undefined,
      employees: employees.rows.map(mapEmployee),
      sources: sources.rows.map(mapSource),
      lostReasons: lostReasons.rows.map(mapLostReason),
      leads: leads.rows.map(mapLead),
      activities: activities.rows.map(mapActivity),
      tasks: tasks.rows.map(mapTask),
      visits: visits.rows.map(mapVisit),
      payments: payments.rows.map(mapPayment),
      stageHistory: stageHistory.rows.map(mapStageHistory),
      serverTime: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}

export interface SyncPayload {
  upserts: {
    leads?: Row[];
    lead_activities?: Row[];
    follow_up_tasks?: Row[];
    office_visits?: Row[];
    payments?: Row[];
    employees?: Row[];
  };
}

export interface SyncResponse {
  ok: true;
  refreshedLeads: Row[];
  refreshedStageHistory: Row[];
  serverTime: string;
}

const MAX_ROWS_PER_TABLE = 500;

export async function applySync(userId: string, orgId: string, payload: SyncPayload, viewer?: Viewer): Promise<SyncResponse> {
  const startedAt = new Date();
  const scoped = viewer?.role === 'counsellor';
  const { leads = [], lead_activities = [], follow_up_tasks = [], office_visits = [], payments = [], employees = [] } = payload.upserts ?? {};

  for (const [name, rows] of Object.entries({ leads, lead_activities, follow_up_tasks, office_visits, payments, employees })) {
    if (!Array.isArray(rows)) throw new ValidationError(`upserts.${name}: expected array`);
    if (rows.length > MAX_ROWS_PER_TABLE) throw new ValidationError(`upserts.${name}: too many rows (${rows.length} > ${MAX_ROWS_PER_TABLE})`);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new ValidationError(`upserts.${name}: row is not an object`);
    }
  }

  const leadRows = leads.map(sanitizeLead);
  const activityRows = lead_activities.map(sanitizeActivity);
  const taskRows = follow_up_tasks.map(sanitizeTask);
  const visitRows = office_visits.map(sanitizeVisit);
  const paymentRows = payments.map(sanitizePayment);
  const employeeRows = employees.map(sanitizeEmployeeUpdate);

  return withUserTx<SyncResponse>(userId, async (client) => {
    // -----------------------------------------------------------------
    // Counsellor write guards: they may only touch their own leads, and
    // tasks assigned to them. New lead ids arriving in this same payload
    // are allowed so "create lead + cadence tasks in one sync" works.
    // -----------------------------------------------------------------
    let allowedLeadIds: Set<string> | null = null;
    if (scoped && viewer) {
      const referenced = new Set<string>();
      for (const r of leadRows) referenced.add(r.id as string);
      for (const rows of [activityRows, taskRows, visitRows, paymentRows]) {
        for (const r of rows) {
          const leadId = r.lead_id as string | null;
          if (leadId) referenced.add(leadId);
        }
      }
      const existing = referenced.size
        ? await client.query('SELECT id, owner_id FROM public.leads WHERE id = ANY($1::uuid[])', [[...referenced]])
        : { rows: [] as Row[] };
      const owned = new Set<string>();
      const foreign = new Map<string, string>();
      for (const row of existing.rows as Array<{ id: string; owner_id: string | null }>) {
        if (row.owner_id === viewer.employeeId) owned.add(row.id);
        else foreign.set(row.id, row.owner_id ?? 'nobody');
      }
      // new lead ids in this payload are insertable by anyone
      const newIds = new Set(leadRows.map((r) => r.id as string));
      allowedLeadIds = new Set([...owned, ...newIds]);

      for (const r of leadRows) {
        if (foreign.has(r.id as string)) {
          throw new ValidationError(`leads: lead ${r.id} is owned by another counsellor — update rejected`);
        }
      }
      for (const r of activityRows) {
        if (!allowedLeadIds.has(r.lead_id as string)) {
          throw new ValidationError(`lead_activities: activity for lead ${r.lead_id} is outside your leads — rejected`);
        }
      }
      for (const r of visitRows) {
        if (!allowedLeadIds.has(r.lead_id as string)) {
          throw new ValidationError(`office_visits: visit for lead ${r.lead_id} is outside your leads — rejected`);
        }
      }
      for (const r of paymentRows) {
        if (!allowedLeadIds.has(r.lead_id as string)) {
          throw new ValidationError(`payments: payment for lead ${r.lead_id} is outside your leads — rejected`);
        }
      }
      for (const r of taskRows) {
        const mine = r.assigned_to === viewer.employeeId || allowedLeadIds.has(r.lead_id as string);
        if (!mine) {
          throw new ValidationError(`follow_up_tasks: task for lead ${r.lead_id} is outside your scope — rejected`);
        }
      }
    }

    // Counsellors may not change roles or activation state of employees;
    // strip those fields but keep the rest (round-robin last_assigned_at
    // sync keeps working).
    const employeeRowsToWrite = scoped
      ? employeeRows.map((r) => ({ ...r, role: null, is_active: null }))
      : employeeRows;

    // order matters for FK references: leads -> activities -> tasks -> visits/payments
    if (leadRows.length) await client.query(UPSERT_LEADS, [JSON.stringify(leadRows), orgId]);
    if (activityRows.length) await client.query(UPSERT_ACTIVITIES, [JSON.stringify(activityRows), orgId]);
    if (taskRows.length) await client.query(UPSERT_TASKS, [JSON.stringify(taskRows), orgId]);
    if (visitRows.length) await client.query(UPSERT_VISITS, [JSON.stringify(visitRows), orgId]);
    if (paymentRows.length) await client.query(UPSERT_PAYMENTS, [JSON.stringify(paymentRows), orgId]);
    if (employeeRowsToWrite.length) await client.query(UPDATE_EMPLOYEES, [JSON.stringify(employeeRowsToWrite), orgId]);

    // authoritative refresh: DB triggers may have adjusted score / phones /
    // stage history while applying the changeset
    const affected = new Set<string>();
    for (const r of leadRows) affected.add(r.id as string);
    for (const rows of [activityRows, taskRows, visitRows, paymentRows]) {
      for (const r of rows) {
        const leadId = r.lead_id as string | null;
        if (leadId) affected.add(leadId);
      }
    }
    let leadIds = [...affected];
    if (allowedLeadIds) {
      // never echo back rows outside the viewer's scope
      leadIds = leadIds.filter((id) => allowedLeadIds!.has(id));
    }
    if (!leadIds.length) {
      return { ok: true, refreshedLeads: [], refreshedStageHistory: [], serverTime: new Date().toISOString() };
    }

    const refreshed = await client.query('SELECT * FROM public.leads WHERE id = ANY($1::uuid[])', [leadIds]);
    const history = await client.query(
      'SELECT * FROM public.stage_history WHERE lead_id = ANY($1::uuid[]) AND changed_at >= $2 ORDER BY changed_at',
      [leadIds, startedAt],
    );

    return {
      ok: true as const,
      refreshedLeads: refreshed.rows.map(mapLead),
      refreshedStageHistory: history.rows.map(mapStageHistory),
      serverTime: new Date().toISOString(),
    };
  });
}
