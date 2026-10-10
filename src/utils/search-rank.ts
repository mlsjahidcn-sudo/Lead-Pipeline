// Pure ranker/matcher for the global search command palette. No React, no
// network — every entity the palette can return is already in memory via
// useCrm(). The module is deliberately framework-agnostic so it can be
// unit-tested in isolation.

import type {
  Employee,
  FollowUpTask,
  Lead,
  LeadActivity,
  LeadSource,
  LostReason,
  OfficeVisit,
  Payment,
  StageHistory,
} from '../types';

export type SearchKind =
  | 'lead'
  | 'task'
  | 'activity'
  | 'employee'
  | 'visit'
  | 'payment'
  | 'source'
  | 'lost_reason'
  | 'stage_history';

export interface SearchResultBase {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  score: number;
}

export interface SearchResultLead extends SearchResultBase {
  kind: 'lead';
  payload: Lead;
}
export interface SearchResultTask extends SearchResultBase {
  kind: 'task';
  payload: FollowUpTask;
}
export interface SearchResultActivity extends SearchResultBase {
  kind: 'activity';
  payload: LeadActivity;
}
export interface SearchResultEmployee extends SearchResultBase {
  kind: 'employee';
  payload: Employee;
}
export interface SearchResultVisit extends SearchResultBase {
  kind: 'visit';
  payload: OfficeVisit;
}
export interface SearchResultPayment extends SearchResultBase {
  kind: 'payment';
  payload: Payment;
}
export interface SearchResultSource extends SearchResultBase {
  kind: 'source';
  payload: LeadSource;
}
export interface SearchResultLostReason extends SearchResultBase {
  kind: 'lost_reason';
  payload: LostReason;
}
export interface SearchResultStageHistory extends SearchResultBase {
  kind: 'stage_history';
  payload: StageHistory;
}

export type SearchResult =
  | SearchResultLead
  | SearchResultTask
  | SearchResultActivity
  | SearchResultEmployee
  | SearchResultVisit
  | SearchResultPayment
  | SearchResultSource
  | SearchResultLostReason
  | SearchResultStageHistory;

export interface SearchContext {
  leads: Lead[];
  employees: Employee[];
  sources: LeadSource[];
  activities: LeadActivity[];
  tasks: FollowUpTask[];
  visits: OfficeVisit[];
  payments: Payment[];
  stageHistory: StageHistory[];
  lostReasons: LostReason[];
}

const MAX_PER_KIND = 5;
const KIND_ORDER: SearchKind[] = [
  'lead',
  'task',
  'activity',
  'employee',
  'visit',
  'payment',
  'source',
  'lost_reason',
  'stage_history',
];

const norm = (s: string | null | undefined): string =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

function includes(haystack: string, q: string): boolean {
  return norm(haystack).includes(q);
}

function startsWith(haystack: string, q: string): boolean {
  return norm(haystack).startsWith(q);
}

function scoreField(value: string | null | undefined, q: string, weight: number, prefixBoost = 1): number {
  if (!value) return 0;
  if (startsWith(value, q)) return weight * prefixBoost;
  if (includes(value, q)) return weight;
  return 0;
}

const tempColor = (t: string): string =>
  t === 'hot' ? 'text-rose-700 bg-rose-50' : t === 'warm' ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100';

function leadMeta(l: Lead): string {
  const parts: string[] = [];
  if (l.score) parts.push(`score ${l.score}`);
  if (l.next_action_at) {
    const ms = new Date(l.next_action_at).getTime() - Date.now();
    if (ms < 0) parts.push('overdue');
  }
  parts.push(l.temperature.toUpperCase());
  parts.push(l.stage.replace(/_/g, ' '));
  return parts.join(' · ');
}

function employeeMeta(e: Employee): string {
  return `${e.role.toUpperCase()}${e.is_active ? '' : ' · INACTIVE'}`;
}

function taskMeta(t: FollowUpTask): string {
  const parts: string[] = [t.task_type, t.status];
  if (t.due_at) {
    const ms = new Date(t.due_at).getTime() - Date.now();
    if (ms < 0) parts.push('overdue');
  }
  return parts.join(' · ').toUpperCase();
}

function activityMeta(): string { return 'ACTIVITY'; }
function visitMeta(v: OfficeVisit): string { return `${v.mode.toUpperCase()} · ${v.status.toUpperCase()}`; }
function paymentMeta(p: Payment): string { return `${p.package} · ${p.payment_type}`.toUpperCase(); }
function sourceMeta(s: LeadSource): string { return s.channel.toUpperCase(); }
function lostReasonMeta(r: LostReason): string { return r.code; }
function stageHistoryMeta(h: StageHistory): string {
  return `${h.from_stage ?? '∅'} → ${h.to_stage}`.toUpperCase();
}

function rankLeads(q: string, leads: Lead[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const l of leads) {
    const s =
      scoreField(l.full_name, q, 100, 1.5) +
      scoreField(l.phone_e164, q, 80) +
      scoreField(l.whatsapp_e164, q, 80) +
      scoreField(l.phone_raw, q, 70) +
      scoreField(l.email, q, 60) +
      scoreField(l.city, q, 40) +
      scoreField(l.target_programme, q, 25) +
      scoreField(l.target_degree, q, 25) +
      scoreField(l.target_intake, q, 20) +
      (Array.isArray(l.tags) ? l.tags.reduce((acc, t) => acc + scoreField(t, q, 25), 0) : 0) +
      scoreField(l.source_ref, q, 20) +
      scoreField(l.next_action_note, q, 15) +
      scoreField(l.last_result, q, 15) +
      scoreField(l.english_level, q, 10) +
      scoreField(l.education_level, q, 10);
    if (s > 0) {
      out.push({
        kind: 'lead',
        id: l.id,
        title: l.full_name,
        subtitle: l.email || l.phone_e164 || l.city || 'Lead',
        meta: leadMeta(l),
        score: s,
        payload: l,
      });
    }
  }
  return out;
}

function rankEmployees(q: string, employees: Employee[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const e of employees) {
    const s =
      scoreField(e.full_name, q, 100, 1.5) +
      scoreField(e.phone_e164, q, 80) +
      scoreField(e.email, q, 60) +
      scoreField(e.title, q, 40) +
      scoreField(e.role, q, 30);
    if (s > 0) {
      out.push({
        kind: 'employee',
        id: e.id,
        title: e.full_name,
        subtitle: e.title || e.email,
        meta: employeeMeta(e),
        score: s,
        payload: e,
      });
    }
  }
  return out;
}

function rankTasks(q: string, tasks: FollowUpTask[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const t of tasks) {
    const s = scoreField(t.title, q, 100, 1.5) + scoreField(t.task_type, q, 40);
    if (s > 0) {
      out.push({
        kind: 'task',
        id: t.id,
        title: t.title,
        subtitle: `${t.task_type} · ${t.status}`,
        meta: taskMeta(t),
        score: s,
        payload: t,
      });
    }
  }
  return out;
}

function rankActivities(q: string, activities: LeadActivity[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const a of activities) {
    const s = scoreField(a.summary, q, 100, 1.5) + scoreField(a.next_action_note, q, 60);
    if (s > 0) {
      out.push({
        kind: 'activity',
        id: a.id,
        title: a.summary,
        subtitle: a.activity_type,
        meta: activityMeta(),
        score: s,
        payload: a,
      });
    }
  }
  return out;
}

function rankVisits(q: string, visits: OfficeVisit[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const v of visits) {
    const s =
      scoreField(v.attendees, q, 100, 1.5) +
      scoreField(v.outcome_note, q, 60) +
      scoreField(v.status, q, 40);
    if (s > 0) {
      out.push({
        kind: 'visit',
        id: v.id,
        title: v.attendees || '(no attendees)',
        subtitle: v.outcome_note || `${v.mode} visit`,
        meta: visitMeta(v),
        score: s,
        payload: v,
      });
    }
  }
  return out;
}

function rankPayments(q: string, payments: Payment[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const p of payments) {
    const s = scoreField(p.receipt_ref, q, 100, 1.5) + scoreField(p.method, q, 40);
    if (s > 0) {
      const amt = p.amount != null ? ` · ${p.amount.toLocaleString()} ${p.currency}` : '';
      out.push({
        kind: 'payment',
        id: p.id,
        title: p.receipt_ref || '(no receipt)',
        subtitle: `${p.package} · ${p.payment_type}${amt}`,
        meta: paymentMeta(p),
        score: s,
        payload: p,
      });
    }
  }
  return out;
}

function rankSources(q: string, sources: LeadSource[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const s of sources) {
    const sc =
      scoreField(s.name, q, 100, 1.5) +
      scoreField(s.channel, q, 60) +
      scoreField(s.campaign, q, 40) +
      scoreField(s.utm_source, q, 30) +
      scoreField(s.utm_medium, q, 30) +
      scoreField(s.utm_campaign, q, 30);
    if (sc > 0) {
      out.push({
        kind: 'source',
        id: s.id,
        title: s.name,
        subtitle: s.channel,
        meta: sourceMeta(s),
        score: sc,
        payload: s,
      });
    }
  }
  return out;
}

function rankLostReasons(q: string, reasons: LostReason[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const r of reasons) {
    const sc = scoreField(r.label, q, 100, 1.5) + scoreField(r.code, q, 80);
    if (sc > 0) {
      out.push({
        kind: 'lost_reason',
        id: String(r.id),
        title: r.label,
        subtitle: r.code,
        meta: lostReasonMeta(r),
        score: sc,
        payload: r,
      });
    }
  }
  return out;
}

function rankStageHistory(q: string, history: StageHistory[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const h of history) {
    const sc = scoreField(h.note, q, 100, 1.5);
    if (sc > 0) {
      out.push({
        kind: 'stage_history',
        id: String(h.id),
        title: h.note || '(stage change)',
        subtitle: `${h.from_stage ?? '∅'} → ${h.to_stage}`,
        meta: stageHistoryMeta(h),
        score: sc,
        payload: h,
      });
    }
  }
  return out;
}

export interface GroupedResults {
  groups: Array<{
    kind: SearchKind;
    label: string;
    items: SearchResult[];
    totalMatches: number;
  }>;
  flat: SearchResult[]; // flat list in render order (kind order, then score desc)
}

export function searchAll(rawQuery: string, ctx: SearchContext): GroupedResults {
  const q = norm(rawQuery.trim());
  if (!q) {
    return { groups: [], flat: [] };
  }
  const all: Record<SearchKind, SearchResult[]> = {
    lead: rankLeads(q, ctx.leads),
    task: rankTasks(q, ctx.tasks),
    activity: rankActivities(q, ctx.activities),
    employee: rankEmployees(q, ctx.employees),
    visit: rankVisits(q, ctx.visits),
    payment: rankPayments(q, ctx.payments),
    source: rankSources(q, ctx.sources),
    lost_reason: rankLostReasons(q, ctx.lostReasons),
    stage_history: rankStageHistory(q, ctx.stageHistory),
  };

  // sort within each kind by descending score
  for (const k of Object.keys(all) as SearchKind[]) {
    all[k].sort((a, b) => b.score - a.score);
  }

  const groups: GroupedResults['groups'] = [];
  const flat: SearchResult[] = [];
  for (const k of KIND_ORDER) {
    const total = all[k].length;
    if (total === 0) continue;
    const items = all[k].slice(0, MAX_PER_KIND);
    groups.push({ kind: k, label: KIND_LABELS[k], items, totalMatches: total });
    flat.push(...items);
  }
  return { groups, flat };
}

export const KIND_LABELS: Record<SearchKind, string> = {
  lead: 'Leads',
  task: 'Tasks',
  activity: 'Activities',
  employee: 'Team',
  visit: 'Visits',
  payment: 'Payments',
  source: 'Sources',
  lost_reason: 'Lost reasons',
  stage_history: 'Stage history',
};

export const KIND_PILL: Record<SearchKind, string> = {
  lead: 'bg-blue-50 text-blue-700 border-blue-200',
  task: 'bg-amber-50 text-amber-700 border-amber-200',
  activity: 'bg-violet-50 text-violet-700 border-violet-200',
  employee: 'bg-slate-100 text-slate-700 border-slate-200',
  visit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  payment: 'bg-rose-50 text-rose-700 border-rose-200',
  source: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  lost_reason: 'bg-orange-50 text-orange-700 border-orange-200',
  stage_history: 'bg-pink-50 text-pink-700 border-pink-200',
};

export const KIND_SHORT: Record<SearchKind, string> = {
  lead: 'LEAD',
  task: 'TASK',
  activity: 'ACT',
  employee: 'TEAM',
  visit: 'VISIT',
  payment: 'PAY',
  source: 'SRC',
  lost_reason: 'LOST',
  stage_history: 'HIST',
};
