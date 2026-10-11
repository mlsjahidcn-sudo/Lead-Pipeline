import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Employee,
  LeadSource,
  LostReason,
  Lead,
  LeadActivity,
  FollowUpTask,
  OfficeVisit,
  Payment,
  StageHistory,
  LeadStage,
  LeadTemperature,
  ActivityType,
  ActivityOutcome,
  VisitStatus,
  TaskPriority,
  QuickReplyTemplate,
} from '../types';
import {
  calculateLeadScoreWeight,
  checkDuplicateLead,
  normalizeBdPhone,
} from '../utils/crm-logic';

/** Server requires strict UUIDs for every client-generated row id. */
const genId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : // Fallback for very old runtimes; RFC4122 v4
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
import { LeadScoreWeightResult, CompanyProfile } from '../types';
import { api, type BootstrapPayload, type SyncResponse, type WireQuickReply } from '../api';
import { authClient } from '../auth';

// The current code base keeps the local `Lead.activity_*`-shaped objects in
// sync with the wire types. The bootstrap payload returns UUIDs everywhere
// already, so a direct cast works.
type BootstrapEmployee = BootstrapPayload['employees'][number];
type BootstrapLead = BootstrapPayload['leads'][number];

// Sync buffer: track IDs that changed since the last successful sync so we
// only re-send the diff. The server is authoritative, so optimistic state
// is replaced on response.
type SyncBuffer = {
  leads: Set<string>;
  lead_activities: Set<string>;
  follow_up_tasks: Set<string>;
  office_visits: Set<string>;
  payments: Set<string>;
  employees: Set<string>;
  quick_replies: Set<string>;
};

const emptyBuffer = (): SyncBuffer => ({
  leads: new Set(),
  lead_activities: new Set(),
  follow_up_tasks: new Set(),
  office_visits: new Set(),
  payments: new Set(),
  employees: new Set(),
  quick_replies: new Set(),
});

interface CrmContextType {
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  syncError: string | null;
  clearSyncError: () => void;

  currentEmployee: Employee;
  setCurrentEmployee: (employee: Employee) => void;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  sources: LeadSource[];
  lostReasons: LostReason[];
  leads: Lead[];
  activities: LeadActivity[];
  tasks: FollowUpTask[];
  visits: OfficeVisit[];
  payments: Payment[];
  stageHistory: StageHistory[];

  // SaaS Organization & Company Profile (kept as in-memory only; not in DB)
  company: CompanyProfile;
  companyPresets: CompanyProfile[];
  updateCompany: (profile: Partial<CompanyProfile>) => void;
  switchCompanyPreset: (presetId: string) => void;
  createCompanyProfile: (newCompany: Omit<CompanyProfile, 'id'>) => void;
  formatCurrency: (amount: number) => string;

  // Action methods (signatures unchanged from before)
  createLead: (leadData: Partial<Lead>) => { success: boolean; leadId?: string; isDuplicate?: boolean; message?: string; matchedLead?: Lead };
  updateLead: (id: string, updates: Partial<Lead>, stageChangeNote?: string) => boolean;
  logInteraction: (data: {
    leadId: string;
    activityType: ActivityType;
    direction: 'outbound' | 'inbound';
    outcome: ActivityOutcome;
    summary: string;
    nextActionAt: string;
    nextActionNote?: string;
    taskIdToComplete?: string;
  }) => void;
  completeTask: (taskId: string, outcomeNote?: string) => void;
  reopenTask: (taskId: string) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  addQuickNote: (leadId: string, noteText: string) => void;
  scheduleFollowUpTask: (data: {
    leadId: string;
    assignedTo?: string;
    taskType: string;
    title: string;
    dueAt: string;
    priority?: TaskPriority;
    cadenceStep?: number;
  }) => FollowUpTask;
  batchScheduleFollowUpTasks: (
    tasksToCreate: Array<{
      leadId: string;
      assignedTo?: string;
      taskType: string;
      title: string;
      dueAt: string;
      priority?: TaskPriority;
      cadenceStep?: number;
    }>
  ) => number;
  bookOfficeVisit: (data: {
    leadId: string;
    scheduledAt: string;
    durationMin?: number;
    mode: 'office' | 'video';
    attendees: string;
    counsellorId: string;
    notes?: string;
  }) => void;
  updateVisitStatus: (visitId: string, status: VisitStatus, outcomeNote?: string) => void;
  recordPayment: (data: {
    leadId: string;
    package: 'guidance' | 'complete_admission';
    paymentType: 'package_fee' | 'deposit' | 'instalment';
    amount: number;
    currency?: string;
    method: string;
    receiptRef: string;
  }) => void;
  verifyPayment: (paymentId: string) => boolean;
  reassignLead: (leadId: string, newOwnerId: string) => void;
  toggleCounsellorAcceptingLeads: (employeeId: string) => void;
  mergeLeads: (survivingLeadId: string, duplicateLeadId: string) => void;
  /** Saved (org-wide, DB-persisted) WhatsApp quick replies. */
  quickReplies: QuickReplyTemplate[];
  /** Upsert an edited quick reply (admin/manager only — server-enforced). */
  saveQuickReply: (template: QuickReplyTemplate) => void;
  bulkImportLeads: (rows: Partial<Lead>[]) => Promise<{ inserted: number; failed: Array<{ row: number; error: string }> }>;
  resetToDefaultData: () => void;
  getLeadScoreWeight: (lead: Lead) => LeadScoreWeightResult;
  calculateLeadWeight: (lead: Lead) => number;
  /** Per-lead activity slice from the memoized index — O(1) per call. */
  getLeadActivities: (leadId: string) => LeadActivity[];
  /** Per-lead task slice from the memoized index — O(1) per call. */
  getLeadTasks: (leadId: string) => FollowUpTask[];
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

/**
 * Gate shown by CrmProvider while the session is still being resolved. Renders
 * either a loading spinner, the sign-in screen, or the "no employee bound"
 * warning — without exposing the rest of the children to a null
 * currentEmployee. The children (CrmApp and its descendants) only mount once
 * a real Employee is available.
 */
const BootstrapGate: React.FC<{
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}> = ({ loading, isAuthenticated, error, signOut }) => {
  const [SignInScreen, setSignInScreen] = useState<React.ComponentType<{ initialMode?: 'sign-in' | 'sign-up'; onAuthed: () => void }> | null>(null);
  useEffect(() => {
    let mounted = true;
    import('../components/SignInScreen').then((m) => {
      if (mounted) setSignInScreen(() => m.SignInScreen);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="text-slate-600 text-sm">Loading workspace…</div>
      </div>
    );
  }
  if (!isAuthenticated) {
    // A network/server error while probing the session (API down or
    // bootstrap failed) must not dead-end into the sign-in form — the
    // credentials are fine, the server is unreachable.
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="max-w-md bg-white border border-rose-200 rounded-xl p-6 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-rose-800">
              <AlertTriangleIcon /> Cannot reach the CRM server
            </div>
            <p className="text-sm text-slate-600 break-words">{error}</p>
            <p className="text-xs text-slate-500">
              Make sure the API server is running (port 3002 — start it with{' '}
              <code className="font-mono bg-slate-100 px-1 rounded">bun run dev</code> or{' '}
              <code className="font-mono bg-slate-100 px-1 rounded">bun run dev:api</code>), then
              retry. If you were already signed in, your session is kept — no data is lost.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    if (!SignInScreen) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
          <div className="text-slate-600 text-sm">Preparing sign-in…</div>
        </div>
      );
    }
    return <SignInScreen onAuthed={() => window.location.reload()} />;
  }
  // authenticated but no employee bound to this user
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="max-w-md bg-white border border-amber-200 rounded-lg p-6 text-amber-900 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangleIcon /> Your account is not linked to a CRM workspace yet
        </div>
        <p className="text-sm">{error || 'Ask an admin to bind your Neon Auth account to an employees row.'}</p>
        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-2 text-sm font-medium text-amber-900 hover:text-amber-700"
        >
          <LogOutIcon /> Sign out
        </button>
      </div>
    </div>
  );
};

const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LogOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Minimum-viable company profile (kept in memory; not persisted to the DB)
const DEFAULT_COMPANY: CompanyProfile = {
  id: 'comp-default',
  name: 'MHR Education',
  short_name: 'MHR Education',
  slug: 'mhr',
  tagline: 'Study abroad counselling & admissions support',
  industry: 'Education consulting',
  accent_color: 'blue',
  currency_code: 'BDT',
  currency_symbol: '৳',
  phone: '',
  email: '',
  website: '',
  office_address: 'Level 4, Navana Tower, Gulshan-1, Dhaka-1212, Bangladesh',
  google_maps_link: 'https://maps.google.com/?q=Navana+Tower+Gulshan+Dhaka',
  webinar_link: 'https://mhreducation.com.bd/live-webinar',
  guide_link: 'https://mhreducation.com.bd/scholarship-guide',
  receipt_prefix: 'MHR-',
  portal_subdomain: 'mhr',
  plan_tier: 'professional',
  seat_count: 5,
  executive_sponsor: '',
};

const INITIAL_PRESETS: CompanyProfile[] = [DEFAULT_COMPANY];

const idToEmployee = (w: BootstrapEmployee): Employee => ({
  id: w.id,
  full_name: w.full_name,
  email: w.email,
  phone_e164: w.phone_e164 ?? '',
  role: w.role,
  is_active: w.is_active,
  accepts_new_leads: w.accepts_new_leads,
  last_assigned_at: w.last_assigned_at,
  created_at: w.created_at,
  title: w.title ?? '',
});

const wireToLead = (w: BootstrapLead): Lead => ({
  id: w.id,
  full_name: w.full_name,
  phone_raw: w.phone_raw ?? '',
  phone_e164: w.phone_e164 ?? '',
  whatsapp_e164: w.whatsapp_e164 ?? '',
  email: w.email ?? '',
  city: w.city ?? '',
  country: w.country,
  source_id: w.source_id ?? '',
  source_ref: w.source_ref ?? '',
  owner_id: w.owner_id ?? '',
  stage: w.stage as LeadStage,
  temperature: w.temperature as LeadTemperature,
  score: w.score,
  score_weight: w.score_weight ?? 5,
  education_level: w.education_level ?? '',
  last_result: w.last_result ?? '',
  target_degree: w.target_degree ?? '',
  target_programme: w.target_programme ?? '',
  target_intake: w.target_intake ?? '',
  english_level: w.english_level ?? '',
  funding_confirmed: !!w.funding_confirmed,
  parent_involved: !!w.parent_involved,
  has_passport: !!w.has_passport,
  first_contact_at: w.first_contact_at,
  next_action_at: w.next_action_at,
  next_action_note: w.next_action_note ?? '',
  lost_reason_id: w.lost_reason_id ?? undefined,
  lost_note: w.lost_note ?? undefined,
  nurture_until: w.nurture_until ?? undefined,
  duplicate_of: w.duplicate_of ?? undefined,
  tags: Array.isArray(w.tags) ? w.tags : [],
  created_at: w.created_at,
  updated_at: w.updated_at,
});

const wireToActivity = (w: BootstrapPayload['activities'][number]): LeadActivity => ({
  id: w.id,
  lead_id: w.lead_id,
  employee_id: w.employee_id ?? '',
  activity_type: w.activity_type as ActivityType,
  direction: (w.direction ?? undefined) as 'outbound' | 'inbound' | undefined,
  outcome: (w.outcome ?? undefined) as ActivityOutcome,
  summary: w.summary,
  next_action_at: w.next_action_at ?? undefined,
  next_action_note: w.next_action_note ?? undefined,
  occurred_at: w.occurred_at,
  created_at: w.created_at,
});

const wireToTask = (w: BootstrapPayload['tasks'][number]): FollowUpTask => ({
  id: w.id,
  lead_id: w.lead_id,
  assigned_to: w.assigned_to,
  task_type: w.task_type,
  cadence_step: w.cadence_step ?? undefined,
  due_at: w.due_at,
  status: w.status as FollowUpTask['status'],
  priority: (w.priority ?? 'medium') as TaskPriority,
  completed_at: w.completed_at ?? undefined,
  activity_id: w.activity_id ?? undefined,
  title: w.title,
  created_at: w.created_at,
});

const wireToVisit = (w: BootstrapPayload['visits'][number]): OfficeVisit => ({
  id: w.id,
  lead_id: w.lead_id,
  counsellor_id: w.counsellor_id ?? '',
  scheduled_at: w.scheduled_at,
  duration_min: w.duration_min,
  mode: w.mode as 'office' | 'video',
  attendees: w.attendees ?? '',
  status: w.status as VisitStatus,
  confirmed_at: undefined,
  reminder_sent_at: undefined,
  google_event_id: undefined,
  outcome_note: w.outcome_note ?? undefined,
  created_at: w.created_at,
});

const wireToPayment = (w: BootstrapPayload['payments'][number]): Payment => ({
  id: w.id,
  lead_id: w.lead_id,
  package: w.package as Payment['package'],
  payment_type: w.payment_type as Payment['payment_type'],
  amount: w.amount ?? 0,
  currency: w.currency,
  paid_at: w.paid_at,
  method: w.method ?? '',
  receipt_ref: w.receipt_ref ?? '',
  recorded_by: w.recorded_by ?? '',
  verified_by: w.verified_by ?? undefined,
  verified_at: w.verified_at ?? undefined,
});

const wireToStageHistory = (w: BootstrapPayload['stageHistory'][number]): StageHistory => ({
  id: w.id,
  lead_id: w.lead_id,
  from_stage: (w.from_stage as LeadStage | null) ?? null,
  to_stage: w.to_stage as LeadStage,
  changed_by: w.changed_by ?? '',
  changed_at: w.changed_at,
  note: w.note ?? undefined,
});

const wireToQuickReply = (w: WireQuickReply): QuickReplyTemplate => ({
  id: w.id,
  name: w.name,
  step: w.step,
  language: w.language === 'bn' ? 'bn' : 'en',
  purpose: w.purpose,
  body: w.body,
  sortOrder: w.sort_order,
});

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, _setCurrentEmployee] = useState<Employee | null>(null);

  // Stable placeholder Employee used only when bootstrap hasn't resolved yet.
  // The public context type keeps `currentEmployee: Employee` (non-null) to
  // avoid cascading null-checks across 19 consumer components, but we never
  // mount those consumers while currentEmployee === null — the BootstrapGate
  // is rendered instead (see the conditional return at the bottom of the
  // function). The placeholder is therefore only ever observed by code
  // inside the gate.
  const placeholderEmployee: Employee = useMemo(
    () => ({
      id: '__loading__',
      full_name: 'Loading…',
      email: '',
      phone_e164: '',
      role: 'counsellor',
      is_active: true,
      accepts_new_leads: true,
      last_assigned_at: null,
      created_at: new Date(0).toISOString(),
      title: '',
    }),
    []
  );
  const effectiveEmployee: Employee = currentEmployee ?? placeholderEmployee;
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [lostReasons, setLostReasons] = useState<LostReason[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [visits, setVisits] = useState<OfficeVisit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stageHistory, setStageHistory] = useState<StageHistory[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([]);
  const [company] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [companyPresets] = useState<CompanyProfile[]>(INITIAL_PRESETS);

  // -----------------------------------------------------------------------
  // Auth + bootstrap lifecycle
  // -----------------------------------------------------------------------

  const loadBootstrap = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.bootstrap();
      setEmployees(data.employees.map(idToEmployee));
      setSources(data.sources as LeadSource[]);
      setLostReasons(data.lostReasons as LostReason[]);
      const allLeads = data.leads.map(wireToLead);
      // Recompute score_weight locally; the server returns it but a missing
      // value (e.g. legacy rows) is filled in here.
      setLeads(allLeads.map((l) => ({ ...l, score_weight: l.score_weight ?? calculateLeadScoreWeight(l, [], data.sources as LeadSource[]).weight })));
      setActivities(data.activities.map(wireToActivity));
      setTasks(data.tasks.map(wireToTask));
      setVisits(data.visits.map(wireToVisit));
      setPayments(data.payments.map(wireToPayment));
      setStageHistory(data.stageHistory.map(wireToStageHistory));
      setQuickReplies((data.quickReplies ?? []).map(wireToQuickReply));

      // Resolve currentEmployee from the server-stated viewer identity.
      // Counsellor-scoped employees rows omit user_id, so matching by session
      // user id would fall through to employees[0] — the wrong person.
      const viewerInfo = data.viewer;
      const viewerEmp = viewerInfo ? data.employees.find((e) => e.id === viewerInfo.employeeId) : undefined;
      const matched = viewerEmp ?? data.employees.find((e) => e.user_id === userId);
      const first = data.employees[0];
      _setCurrentEmployee(matched ? idToEmployee(matched) : first ? idToEmployee(first) : null);
      setIsAuthenticated(true);
    } catch (err) {
      setError((err as Error).message);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial auth probe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        if (!me.orgId) {
          setIsAuthenticated(true);
          setLoading(false);
          setError('Your account is not linked to a CRM workspace yet.');
          return;
        }
        setSessionUserId(me.userId);
        await loadBootstrap(me.userId);
      } catch (err) {
        if (cancelled) return;
        const status = (err as Error).message;
        if (status.startsWith('401')) {
          setIsAuthenticated(false);
          setLoading(false);
        } else {
          setError(status);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBootstrap]);

  // listen to better-auth client for sign-out events (sign-in is handled by
  // BootstrapGate calling window.location.reload() to keep the gating simple
  // and avoid bootstrap races with the provider's state).
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    // authClient exposes a nanostore under $store; subscribe to that so we
    // can clear local state when the user signs out without reloading.
    try {
      const store = (authClient as unknown as { $store: { listen: (cb: (s: { user?: { id?: string } | null }) => void) => () => void } }).$store;
      unsubscribe = store.listen((s) => {
        if (!mounted) return;
        if (!s?.user?.id && isAuthenticated) {
          setIsAuthenticated(false);
          setSessionUserId(null);
          _setCurrentEmployee(null);
        }
      });
    } catch {
      // best-effort: if the SDK shape changes the sign-out handler simply
      // doesn't fire, the next reload will reflect the new state anyway
    }
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [isAuthenticated]);

  // -----------------------------------------------------------------------
  // Sync buffer (mutations are queued and flushed 1s after the last change)
  // -----------------------------------------------------------------------

  const buffer = useRef<SyncBuffer>(emptyBuffer());
  // Side-channel: callers that must flush *now* (e.g. reassignLead) write the
  // exact row to send here, then call flushSync. flushSync prefers these
  // stamped rows over the React-state closure, so the network payload always
  // reflects the user's intent — even when setLeads hasn't re-rendered yet.
  type UpKeys = 'leads' | 'lead_activities' | 'follow_up_tasks' | 'office_visits' | 'payments' | 'employees' | 'quick_replies';
  const pendingUpserts = useRef<{ [K in UpKeys]: Map<string, any> }>({
    leads: new Map(),
    lead_activities: new Map(),
    follow_up_tasks: new Map(),
    office_visits: new Map(),
    payments: new Map(),
    employees: new Map(),
    quick_replies: new Map(),
  });
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const lastSyncAt = useRef<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const markDirty = useCallback(
    (key: keyof SyncBuffer, id: string) => {
      buffer.current[key].add(id);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        void flushSync();
      }, 800);
    },
    []
  );

  const flushSync = useCallback(async () => {
    if (inFlight.current) {
      // chain after in-flight
      await inFlight.current;
    }
    const buf = buffer.current;
    const leadsDirty = [...buf.leads];
    const activitiesDirty = [...buf.lead_activities];
    const tasksDirty = [...buf.follow_up_tasks];
    const visitsDirty = [...buf.office_visits];
    const paymentsDirty = [...buf.payments];
    const employeesDirty = [...buf.employees];
    const quickRepliesDirty = [...buf.quick_replies];
    if (
      !leadsDirty.length && !activitiesDirty.length && !tasksDirty.length &&
      !visitsDirty.length && !paymentsDirty.length && !employeesDirty.length &&
      !quickRepliesDirty.length
    ) return;

    // reset buffer before sending so new mutations during the sync land in a
    // fresh buffer
    buffer.current = emptyBuffer();

    // Helper: pick the row to send. Prefer the side-channel stamped row
    // (reassignLead writes here so the new owner_id is shipped even though
    // setLeads hasn't committed yet). Fall back to the React-state closure.
    const pick = <K extends UpKeys>(
      key: K,
      dirty: string[],
      rows: Array<{ id: string } & any>
    ): any[] | undefined => {
      if (!dirty.length) return undefined;
      const stamped = pendingUpserts.current[key];
      // If every dirty id has a stamped row, use the side-channel alone
      // (most accurate for the calling action). Otherwise merge: stamped
      // first, then any closure rows not yet represented.
      if (dirty.every((id) => stamped.has(id))) {
        return dirty.map((id) => stamped.get(id));
      }
      const merged = new Map<string, any>();
      for (const id of dirty) {
        if (stamped.has(id)) merged.set(id, stamped.get(id));
        else {
          const r = rows.find((x) => x.id === id);
          if (r) merged.set(id, r);
        }
      }
      return [...merged.values()];
    };
    const leadsRows = pick('leads', leadsDirty, leads);
    const actRows = pick('lead_activities', activitiesDirty, activities);
    const taskRows = pick('follow_up_tasks', tasksDirty, tasks);
    const visitRows = pick('office_visits', visitsDirty, visits);
    const payRows = pick('payments', paymentsDirty, payments);
    const empRows = pick('employees', employeesDirty, employees);
    const quickReplyRows = pick('quick_replies', quickRepliesDirty, quickReplies);
    // Consume the stamped rows that are being sent (so they don't leak into
    // the next flush of unrelated mutations).
    (['leads','lead_activities','follow_up_tasks','office_visits','payments','employees','quick_replies'] as const).forEach((k) => {
      const sent = (k === 'leads' ? leadsRows : k === 'lead_activities' ? actRows : k === 'follow_up_tasks' ? taskRows : k === 'office_visits' ? visitRows : k === 'payments' ? payRows : k === 'employees' ? empRows : quickReplyRows) ?? [];
      for (const r of sent) pendingUpserts.current[k].delete((r as { id: string }).id);
    });

    inFlight.current = (async () => {
      try {
        const payload = {
          upserts: {
            leads: leadsRows,
            lead_activities: actRows,
            follow_up_tasks: taskRows,
            office_visits: visitRows,
            payments: payRows,
            employees: empRows,
            quick_replies: quickReplyRows,
          },
        };
        const res: SyncResponse = await api.sync(payload);
        lastSyncAt.current = res.serverTime;
        // Merge authoritative refreshed rows back into local state
        if (res.refreshedLeads?.length) {
          setLeads((prev) => {
            const map = new Map(prev.map((l) => [l.id, l]));
            for (const w of res.refreshedLeads) map.set(w.id, wireToLead(w));
            return [...map.values()];
          });
        }
        if (res.refreshedStageHistory?.length) {
          setStageHistory((prev) => {
            const map = new Map(prev.map((h) => [h.id, h]));
            for (const w of res.refreshedStageHistory) map.set(String(w.id), wireToStageHistory(w));
            return [...map.values()];
          });
        }
        setSyncError(null);
      } catch (err) {
        const msg = (err as Error).message ?? '';
        setSyncError(msg);
        // A 400 means the server permanently rejected these rows (validation
        // or scope guard). Re-queueing them forever would poison every later
        // sync, so drop the batch instead. Network/5xx errors stay retryable.
        if (msg.startsWith('400')) {
          console.warn('[sync] batch rejected by server, dropping:', msg);
          return;
        }
        // re-queue so the next change retries
        buffer.current = {
          leads: new Set([...buffer.current.leads, ...leadsDirty]),
          lead_activities: new Set([...buffer.current.lead_activities, ...activitiesDirty]),
          follow_up_tasks: new Set([...buffer.current.follow_up_tasks, ...tasksDirty]),
          office_visits: new Set([...buffer.current.office_visits, ...visitsDirty]),
          payments: new Set([...buffer.current.payments, ...paymentsDirty]),
          employees: new Set([...buffer.current.employees, ...employeesDirty]),
          quick_replies: new Set([...buffer.current.quick_replies, ...quickRepliesDirty]),
        };
      } finally {
        inFlight.current = null;
      }
    })();
    await inFlight.current;
  }, [leads, activities, tasks, visits, payments, employees, quickReplies]);

  // flush on tab close so we don't drop the last write
  useEffect(() => {
    const handler = () => {
      if (buffer.current.leads.size || buffer.current.lead_activities.size || buffer.current.follow_up_tasks.size || buffer.current.office_visits.size || buffer.current.payments.size || buffer.current.employees.size || buffer.current.quick_replies.size) {
        // best-effort; the network call may not finish
        void flushSync();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flushSync]);

  // -----------------------------------------------------------------------
  // currentEmployee (defensive fallback before bootstrap completes)
  // -----------------------------------------------------------------------

  const setCurrentEmployee = useCallback((emp: Employee) => _setCurrentEmployee(emp), []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setIsAuthenticated(false);
    setSessionUserId(null);
    _setCurrentEmployee(null);
  }, []);

  // surface the sync error as a separate field
  const displayError = error || syncError;

  // -----------------------------------------------------------------------
  // Company profile (in-memory only)
  // -----------------------------------------------------------------------

  const updateCompany = useCallback(() => {
    // local-only company settings; no-op for the DB-backed build
  }, []);
  const switchCompanyPreset = useCallback(() => {}, []);
  const createCompanyProfile = useCallback(() => {}, []);
  const formatCurrency = useCallback((amount: number) => `${amount.toLocaleString()} ${company.currency_code}`, [company]);

  // -----------------------------------------------------------------------
  // Action methods
  // -----------------------------------------------------------------------

  const getNextCounsellorId = useCallback((): string => {
    const eligible = employees.filter((e) => e.is_active && e.accepts_new_leads && e.role === 'counsellor');
    if (!eligible.length) {
      return employees[0]?.id ?? '';
    }
    eligible.sort((a, b) => {
      if (!a.last_assigned_at) return -1;
      if (!b.last_assigned_at) return 1;
      return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
    });
    const selected = eligible[0];
    const nowIso = new Date().toISOString();
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === selected.id ? { ...emp, last_assigned_at: nowIso } : emp))
    );
    markDirty('employees', selected.id);
    return selected.id;
  }, [employees, markDirty]);

  const createLead = useCallback(
    (leadData: Partial<Lead>) => {
      const rawPhone = leadData.phone_raw || '';
      const norm = normalizeBdPhone(rawPhone);
      const phoneE164 = norm.e164 || (rawPhone.startsWith('+') ? rawPhone : null);
      const whatsappE164 = leadData.whatsapp_e164
        ? normalizeBdPhone(leadData.whatsapp_e164).e164 || leadData.whatsapp_e164
        : phoneE164;

      const dupCheck = checkDuplicateLead(
        { phone: phoneE164 || undefined, whatsapp: whatsappE164 || undefined, email: leadData.email },
        leads
      );
      const now = new Date();
      const nowIso = now.toISOString();

      if (dupCheck.isDuplicate && dupCheck.matchedLead) {
        const existing = dupCheck.matchedLead;
        if (!['lost', 'nurture'].includes(existing.stage)) {
          const reEnqId = genId();
          setActivities((prev) => [
            {
              id: reEnqId,
              lead_id: existing.id,
              employee_id: effectiveEmployee.id,
              activity_type: 'system',
              outcome: 'replied',
              summary: `Re-enquiry inbound from ${leadData.full_name || 'student'}. Source: ${leadData.source_id || 'Direct'}`,
              occurred_at: nowIso,
              created_at: nowIso,
            },
            ...prev,
          ]);
          markDirty('lead_activities', reEnqId);
          const newTemp: LeadTemperature = existing.temperature === 'cold' ? 'warm' : existing.temperature;
          setLeads((prev) =>
            prev.map((l) => (l.id === existing.id ? { ...l, temperature: newTemp, updated_at: nowIso } : l))
          );
          markDirty('leads', existing.id);
          return {
            success: true,
            leadId: existing.id,
            isDuplicate: true,
            matchedLead: existing,
            message: `Re-enquiry matched existing lead "${existing.full_name}". Timeline updated!`,
          };
        }
        // reopen lost/nurture lead
        const reopenId = genId();
        setActivities((prev) => [
          {
            id: reopenId,
            lead_id: existing.id,
            employee_id: effectiveEmployee.id,
            activity_type: 'system',
            outcome: 'replied',
            summary: `Previously ${existing.stage.toUpperCase()} lead re-enquired! Reopened to Contacted stage.`,
            occurred_at: nowIso,
            created_at: nowIso,
          },
          ...prev,
        ]);
        markDirty('lead_activities', reopenId);
        const nextActionIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        setLeads((prev) =>
          prev.map((l) =>
            l.id === existing.id
              ? {
                  ...l,
                  stage: 'contacted' as LeadStage,
                  temperature: 'hot' as LeadTemperature,
                  next_action_at: nextActionIso,
                  next_action_note: 'Reopened lead: Urgent follow-up needed',
                  updated_at: nowIso,
                }
              : l
          )
        );
        markDirty('leads', existing.id);
        setStageHistory((prev) => [
          {
            id: genId(),
            lead_id: existing.id,
            from_stage: existing.stage,
            to_stage: 'contacted',
            changed_by: effectiveEmployee.id,
            changed_at: nowIso,
            note: 'Reopened due to re-enquiry',
          },
          ...prev,
        ]);
        return {
          success: true,
          leadId: existing.id,
          isDuplicate: true,
          matchedLead: existing,
          message: `Reopened previous ${existing.stage} lead "${existing.full_name}" to Contacted.`,
        };
      }

      // Counsellors always own the leads they capture (data isolation means
      // a round-robin-assigned lead would immediately vanish from their
      // view). Managers/admins keep round-robin / explicit assignment.
      const ownerId = effectiveEmployee.role === 'counsellor'
        ? effectiveEmployee.id
        : leadData.owner_id || getNextCounsellorId();
      const newId = genId();
      const defaultSlaNextAction = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      const newLead: Lead = {
        id: newId,
        full_name: leadData.full_name || 'Anonymous Student',
        phone_raw: rawPhone,
        phone_e164: phoneE164 || '',
        whatsapp_e164: whatsappE164 || phoneE164 || '',
        email: leadData.email ? leadData.email.trim().toLowerCase() : '',
        city: leadData.city || 'Dhaka',
        country: leadData.country || 'BD',
        source_id: leadData.source_id || sources[0]?.id || '',
        source_ref: leadData.source_ref || `manual_entry_${genId()}`,
        owner_id: ownerId,
        stage: 'new' as LeadStage,
        temperature: 'warm' as LeadTemperature,
        score: 0,
        education_level: leadData.education_level || 'HSC',
        last_result: leadData.last_result || 'GPA 4.50',
        target_degree: leadData.target_degree || 'Bachelor',
        target_programme: leadData.target_programme || 'Computer Science / Engineering',
        target_intake: leadData.target_intake || 'March 2027',
        english_level: leadData.english_level || 'Medium of Instruction',
        funding_confirmed: leadData.funding_confirmed ?? false,
        parent_involved: leadData.parent_involved ?? false,
        has_passport: leadData.has_passport ?? false,
        tags: Array.isArray(leadData.tags) ? leadData.tags : [],
        first_contact_at: null,
        next_action_at: leadData.next_action_at || defaultSlaNextAction,
        next_action_note: leadData.next_action_note || 'Initial call & WhatsApp (2h SLA)',
        created_at: nowIso,
        updated_at: nowIso,
      };
      const weight = calculateLeadScoreWeight(newLead, [], sources).weight;
      newLead.score_weight = weight;
      setLeads((prev) => [newLead, ...prev]);
      markDirty('leads', newId);

      // initial cadence tasks
      const cadence: FollowUpTask[] = [
        {
          id: genId(),
          lead_id: newId,
          assigned_to: ownerId,
          task_type: 'call',
          cadence_step: 0,
          due_at: defaultSlaNextAction,
          status: 'open',
          priority: 'high',
          title: 'Day 0: First call & WhatsApp attempt (SLA: 2 hours)',
          created_at: nowIso,
        },
        {
          id: genId(),
          lead_id: newId,
          assigned_to: ownerId,
          task_type: 'whatsapp',
          cadence_step: 1,
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'open',
          priority: 'medium',
          title: 'Day 1: Free Consultation & Webinar invitation',
          created_at: nowIso,
        },
        {
          id: genId(),
          lead_id: newId,
          assigned_to: ownerId,
          task_type: 'call',
          cadence_step: 3,
          due_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          status: 'open',
          priority: 'medium',
          title: 'Day 3: University matching & Scholarship deadlines check',
          created_at: nowIso,
        },
      ];
      setTasks((prev) => [...cadence, ...prev]);
      cadence.forEach((t) => markDirty('follow_up_tasks', t.id));

      setStageHistory((prev) => [
        {
          id: genId(),
          lead_id: newId,
          from_stage: null,
          to_stage: 'new',
          changed_by: effectiveEmployee.id,
          changed_at: nowIso,
          note: 'Lead captured & assigned via round-robin',
        },
        ...prev,
      ]);

      return { success: true, leadId: newId, isDuplicate: false };
    },
    [leads, currentEmployee, sources, getNextCounsellorId, markDirty]
  );

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead>, stageChangeNote?: string): boolean => {
      const existing = leads.find((l) => l.id === id);
      if (!existing) return false;
      const nowIso = new Date().toISOString();
      const newStage = updates.stage || existing.stage;
      const stageChanged = updates.stage && updates.stage !== existing.stage;
      if (stageChanged) {
        setStageHistory((prev) => [
          {
            id: genId(),
            lead_id: id,
            from_stage: existing.stage,
            to_stage: newStage,
            changed_by: effectiveEmployee.id,
            changed_at: nowIso,
            note: stageChangeNote || `Stage moved to ${newStage}`,
          },
          ...prev,
        ]);
      }
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const merged = { ...l, ...updates, stage: newStage, updated_at: nowIso };
          const dynamicWeight = calculateLeadScoreWeight(merged, activities, sources).weight;
          return { ...merged, score_weight: dynamicWeight };
        })
      );
      markDirty('leads', id);
      return true;
    },
    [leads, activities, sources, currentEmployee, markDirty]
  );

  const logInteraction = useCallback(
    (data: {
      leadId: string;
      activityType: ActivityType;
      direction: 'outbound' | 'inbound';
      outcome: ActivityOutcome;
      summary: string;
      nextActionAt: string;
      nextActionNote?: string;
      taskIdToComplete?: string;
    }) => {
      const nowIso = new Date().toISOString();
      const actId = genId();
      const newActivity: LeadActivity = {
        id: actId,
        lead_id: data.leadId,
        employee_id: effectiveEmployee.id,
        activity_type: data.activityType,
        direction: data.direction,
        outcome: data.outcome,
        summary: data.summary,
        next_action_at: data.nextActionAt,
        next_action_note: data.nextActionNote,
        occurred_at: nowIso,
        created_at: nowIso,
      };
      setActivities((prev) => [newActivity, ...prev]);
      markDirty('lead_activities', actId);

      const lead = leads.find((l) => l.id === data.leadId);
      if (lead) {
        const isFirstContact = !lead.first_contact_at && data.direction === 'outbound';
        const newStage = lead.stage === 'new' && isFirstContact ? ('contacted' as LeadStage) : lead.stage;
        setLeads((prev) =>
          prev.map((l) => {
            if (l.id !== data.leadId) return l;
            const merged = {
              ...l,
              stage: newStage,
              first_contact_at: isFirstContact ? nowIso : l.first_contact_at,
              next_action_at: data.nextActionAt,
              next_action_note: data.nextActionNote || l.next_action_note,
              updated_at: nowIso,
            };
            const dynamicWeight = calculateLeadScoreWeight(merged, [newActivity, ...activities], sources).weight;
            return { ...merged, score_weight: dynamicWeight };
          })
        );
        markDirty('leads', data.leadId);
        if (newStage !== lead.stage) {
          setStageHistory((prev) => [
            {
              id: genId(),
              lead_id: data.leadId,
              from_stage: lead.stage,
              to_stage: newStage,
              changed_by: effectiveEmployee.id,
              changed_at: nowIso,
              note: 'First contact attempt logged',
            },
            ...prev,
          ]);
        }
      }
      if (data.taskIdToComplete) {
        setTasks((prev) => prev.map((t) => (t.id === data.taskIdToComplete ? { ...t, status: 'done', completed_at: nowIso, activity_id: actId } : t)));
        markDirty('follow_up_tasks', data.taskIdToComplete);
      }
    },
    [leads, activities, sources, currentEmployee, markDirty]
  );

  const completeTask = useCallback(
    (taskId: string, outcomeNote?: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const nowIso = new Date().toISOString();
      const actId = genId();
      setActivities((prev) => [
        {
          id: actId,
          lead_id: target.lead_id,
          employee_id: effectiveEmployee.id,
          activity_type: (target.task_type as ActivityType) || 'call',
          direction: 'outbound',
          outcome: 'connected',
          summary: outcomeNote ? `Completed follow-up task "${target.title}": ${outcomeNote}` : `Completed follow-up task: "${target.title}"`,
          next_action_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          next_action_note: 'Routine cadence follow-up',
          occurred_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('lead_activities', actId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'done', completed_at: nowIso, activity_id: actId } : t)));
      markDirty('follow_up_tasks', taskId);
      const nextIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      setLeads((prev) => prev.map((l) => (l.id === target.lead_id ? { ...l, next_action_at: nextIso, next_action_note: 'Routine cadence follow-up', updated_at: nowIso } : l)));
      markDirty('leads', target.lead_id);
    },
    [tasks, currentEmployee, markDirty]
  );

  const reopenTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'open', completed_at: undefined } : t)));
      markDirty('follow_up_tasks', taskId);
    },
    [markDirty]
  );

  const updateTaskPriority = useCallback(
    (taskId: string, priority: TaskPriority) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, priority } : t)));
      markDirty('follow_up_tasks', taskId);
    },
    [markDirty]
  );

  const addQuickNote = useCallback(
    (leadId: string, noteText: string) => {
      if (!noteText.trim()) return;
      const nowIso = new Date().toISOString();
      const actId = genId();
      setActivities((prev) => [
        {
          id: actId,
          lead_id: leadId,
          employee_id: effectiveEmployee.id,
          activity_type: 'note',
          direction: undefined,
          outcome: undefined,
          summary: noteText.trim(),
          occurred_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('lead_activities', actId);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, updated_at: nowIso } : l)));
      markDirty('leads', leadId);
    },
    [currentEmployee, markDirty]
  );

  const scheduleFollowUpTask = useCallback(
    (data: { leadId: string; assignedTo?: string; taskType: string; title: string; dueAt: string; priority?: TaskPriority; cadenceStep?: number }): FollowUpTask => {
      const targetLead = leads.find((l) => l.id === data.leadId);
      const assignedTo = data.assignedTo || targetLead?.owner_id || effectiveEmployee.id;
      const nowIso = new Date().toISOString();
      const taskId = genId();
      const newTask: FollowUpTask = {
        id: taskId,
        lead_id: data.leadId,
        assigned_to: assignedTo,
        task_type: data.taskType,
        title: data.title,
        due_at: data.dueAt,
        status: 'open',
        priority: data.priority || 'medium',
        cadence_step: data.cadenceStep ?? 3,
        created_at: nowIso,
      };
      setTasks((prev) => [newTask, ...prev]);
      markDirty('follow_up_tasks', taskId);
      setLeads((prev) => prev.map((l) => (l.id === data.leadId ? { ...l, next_action_at: data.dueAt, next_action_note: data.title, updated_at: nowIso } : l)));
      markDirty('leads', data.leadId);
      const actId = genId();
      setActivities((prev) => [
        {
          id: actId,
          lead_id: data.leadId,
          employee_id: effectiveEmployee.id,
          activity_type: 'system',
          summary: `Automated Cadence: Scheduled follow-up "${data.title}" due ${new Date(data.dueAt).toLocaleString()}`,
          next_action_at: data.dueAt,
          next_action_note: data.title,
          occurred_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('lead_activities', actId);
      return newTask;
    },
    [leads, currentEmployee, markDirty]
  );

  const batchScheduleFollowUpTasks = useCallback(
    (tasksToCreate: Array<{ leadId: string; assignedTo?: string; taskType: string; title: string; dueAt: string; priority?: TaskPriority; cadenceStep?: number }>): number => {
      if (!tasksToCreate.length) return 0;
      const nowIso = new Date().toISOString();
      const createdTasks: FollowUpTask[] = [];
      const createdActivities: LeadActivity[] = [];
      const leadUpdatesMap = new Map<string, { dueAt: string; note: string }>();
      tasksToCreate.forEach((t, idx) => {
        const targetLead = leads.find((l) => l.id === t.leadId);
        const assignedTo = t.assignedTo || targetLead?.owner_id || effectiveEmployee.id;
        const taskId = genId();
        createdTasks.push({
          id: taskId,
          lead_id: t.leadId,
          assigned_to: assignedTo,
          task_type: t.taskType,
          title: t.title,
          due_at: t.dueAt,
          status: 'open',
          priority: t.priority || 'medium',
          cadence_step: t.cadenceStep ?? 3,
          created_at: nowIso,
        });
        createdActivities.push({
          id: genId(),
          lead_id: t.leadId,
          employee_id: effectiveEmployee.id,
          activity_type: 'system',
          summary: `Automated Cadence: Auto-scheduled follow-up "${t.title}" due ${new Date(t.dueAt).toLocaleString()}`,
          next_action_at: t.dueAt,
          next_action_note: t.title,
          occurred_at: nowIso,
          created_at: nowIso,
        });
        leadUpdatesMap.set(t.leadId, { dueAt: t.dueAt, note: t.title });
      });
      setTasks((prev) => [...createdTasks, ...prev]);
      createdTasks.forEach((t) => markDirty('follow_up_tasks', t.id));
      setActivities((prev) => [...createdActivities, ...prev]);
      createdActivities.forEach((a) => markDirty('lead_activities', a.id));
      setLeads((prev) =>
        prev.map((l) => {
          const update = leadUpdatesMap.get(l.id);
          if (update) {
            return { ...l, next_action_at: update.dueAt, next_action_note: update.note, updated_at: nowIso };
          }
          return l;
        })
      );
      [...leadUpdatesMap.keys()].forEach((id) => markDirty('leads', id));
      return createdTasks.length;
    },
    [leads, currentEmployee, markDirty]
  );

  const bookOfficeVisit = useCallback(
    (data: { leadId: string; scheduledAt: string; durationMin?: number; mode: 'office' | 'video'; attendees: string; counsellorId: string; notes?: string }) => {
      const nowIso = new Date().toISOString();
      const visitId = genId();
      setVisits((prev) => [
        {
          id: visitId,
          lead_id: data.leadId,
          counsellor_id: data.counsellorId,
          scheduled_at: data.scheduledAt,
          duration_min: data.durationMin || 45,
          mode: data.mode,
          attendees: data.attendees,
          status: 'booked',
          outcome_note: data.notes,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('office_visits', visitId);
      updateLead(
        data.leadId,
        {
          stage: 'office_visit_booked',
          temperature: 'hot',
          next_action_at: data.scheduledAt,
          next_action_note: `Office visit with ${data.attendees}`,
        },
        `Office visit scheduled for ${new Date(data.scheduledAt).toLocaleString()}`
      );
      const taskId = genId();
      setTasks((prev) => [
        {
          id: taskId,
          lead_id: data.leadId,
          assigned_to: data.counsellorId,
          task_type: 'office_visit',
          due_at: data.scheduledAt,
          status: 'open',
          priority: 'high',
          title: `Conduct ${data.mode} visit with ${data.attendees}`,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('follow_up_tasks', taskId);
      const actId = genId();
      setActivities((prev) => [
        {
          id: actId,
          lead_id: data.leadId,
          employee_id: effectiveEmployee.id,
          activity_type: 'office_visit',
          direction: 'inbound',
          outcome: 'booked',
          summary: `Booked office visit for ${new Date(data.scheduledAt).toLocaleDateString('en-GB')}. Attendees: ${data.attendees}`,
          next_action_at: data.scheduledAt,
          next_action_note: 'Prepare university list for meeting',
          occurred_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('lead_activities', actId);
    },
    [currentEmployee, markDirty, updateLead]
  );

  const updateVisitStatus = useCallback(
    (visitId: string, status: VisitStatus, outcomeNote?: string) => {
      const nowIso = new Date().toISOString();
      const target = visits.find((v) => v.id === visitId);
      if (!target) return;
      setVisits((prev) => prev.map((v) => (v.id === visitId ? { ...v, status, outcome_note: outcomeNote || v.outcome_note } : v)));
      markDirty('office_visits', visitId);
      if (status === 'attended') {
        const decisionDueIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        updateLead(
          target.lead_id,
          { stage: 'office_visit_done', temperature: 'hot', next_action_at: decisionDueIso, next_action_note: '24-hour post-visit decision follow-up' },
          'Office visit attended successfully'
        );
        const taskId = genId();
        setTasks((prev) => [
          {
            id: taskId,
            lead_id: target.lead_id,
            assigned_to: target.counsellor_id,
            task_type: 'call',
            due_at: decisionDueIso,
            status: 'open',
            priority: 'high',
            title: '24-hour decision follow-up with student/parent',
            created_at: nowIso,
          },
          ...prev,
        ]);
        markDirty('follow_up_tasks', taskId);
      } else if (status === 'no_show') {
        const recoveryIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const taskId = genId();
        setTasks((prev) => [
          {
            id: taskId,
            lead_id: target.lead_id,
            assigned_to: target.counsellor_id,
            task_type: 'whatsapp',
            due_at: recoveryIso,
            status: 'open',
            priority: 'high',
            title: 'No-show recovery: Send missed visit message on WhatsApp',
            created_at: nowIso,
          },
          ...prev,
        ]);
        markDirty('follow_up_tasks', taskId);
      }
    },
    [visits, markDirty, updateLead]
  );

  const recordPayment = useCallback(
    (data: { leadId: string; package: 'guidance' | 'complete_admission'; paymentType: 'package_fee' | 'deposit' | 'instalment'; amount: number; currency?: string; method: string; receiptRef: string }) => {
      const nowIso = new Date().toISOString();
      const paymentId = genId();
      setPayments((prev) => [
        {
          id: paymentId,
          lead_id: data.leadId,
          package: data.package,
          payment_type: data.paymentType,
          amount: data.amount,
          currency: data.currency || 'BDT',
          paid_at: nowIso,
          method: data.method,
          receipt_ref: data.receiptRef,
          recorded_by: effectiveEmployee.id,
          verified_by: effectiveEmployee.role === 'admin' || effectiveEmployee.role === 'manager' ? effectiveEmployee.id : undefined,
          verified_at: effectiveEmployee.role === 'admin' || effectiveEmployee.role === 'manager' ? nowIso : undefined,
        },
        ...prev,
      ]);
      markDirty('payments', paymentId);
      updateLead(
        data.leadId,
        { stage: 'paid', temperature: 'hot', next_action_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), next_action_note: 'Submit application dossier to university portal' },
        `Payment received: ${data.amount} BDT for ${data.package} package (${data.receiptRef})`
      );
    },
    [currentEmployee, markDirty, updateLead]
  );

  const verifyPayment = useCallback(
    (paymentId: string): boolean => {
      if (effectiveEmployee.role !== 'admin' && effectiveEmployee.role !== 'manager') return false;
      const nowIso = new Date().toISOString();
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? { ...p, verified_by: effectiveEmployee.id, verified_at: nowIso } : p)));
      markDirty('payments', paymentId);
      return true;
    },
    [currentEmployee, markDirty]
  );

  // Quick replies: org-wide templates. Saved rows live in the DB
  // (quick_reply_templates); UI merges them over the code defaults by id.
  // Uses the same stamped-row side-channel as reassignLead so the exact
  // edited body ships even before setQuickReplies commits, then flushes
  // immediately (the modal closes right after saving).
  const saveQuickReply = useCallback(
    (template: QuickReplyTemplate) => {
      const wireRow = {
        id: template.id,
        name: template.name,
        step: template.step,
        language: template.language,
        purpose: template.purpose,
        body: template.body,
        sort_order: template.sortOrder,
      };
      pendingUpserts.current.quick_replies.set(template.id, wireRow);
      setQuickReplies((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        map.set(template.id, template);
        return [...map.values()];
      });
      markDirty('quick_replies', template.id);
      void flushSync();
    },
    [markDirty, flushSync]
  );

  const reassignLead = useCallback(
    (leadId: string, newOwnerId: string) => {
      const nowIso = new Date().toISOString();
      // Build the upsert row up-front from the current closure value, then
      // push the *stamped* row into a side channel that flushSync consumes.
      // This sidesteps the classic stale-closure problem: setLeads is queued
      // and flushSync fired immediately would otherwise read pre-commit state
      // and ship the OLD owner_id to the server.
      const liveLead = leads.find((l) => l.id === leadId);
      if (!liveLead) return;
      const updatedLead: Lead = { ...liveLead, owner_id: newOwnerId, updated_at: nowIso };
      pendingUpserts.current.leads.set(leadId, updatedLead);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updatedLead : l)));
      markDirty('leads', leadId);

      // Re-queue all open tasks of this lead (assign_to should follow owner)
      const openTaskIds = tasks.filter((t) => t.lead_id === leadId && t.status === 'open').map((t) => t.id);
      setTasks((prev) => prev.map((t) => (t.lead_id === leadId && t.status === 'open' ? { ...t, assigned_to: newOwnerId } : t)));
      openTaskIds.forEach((t) => markDirty('follow_up_tasks', t));

      const newOwner = employees.find((e) => e.id === newOwnerId);
      const actId = genId();
      const actRow: LeadActivity = {
        id: actId,
        lead_id: leadId,
        employee_id: effectiveEmployee.id,
        activity_type: 'system',
        summary: `Lead reassigned to ${newOwner?.full_name || 'new counsellor'} by ${effectiveEmployee.full_name}`,
        occurred_at: nowIso,
        created_at: nowIso,
      };
      pendingUpserts.current.lead_activities.set(actId, actRow);
      setActivities((prev) => [actRow, ...prev]);
      markDirty('lead_activities', actId);

      // Flush immediately — closing the modal cancels the 800ms debounce and
      // the reassignment is too important to sit in the buffer.
      void flushSync();
    },
    [leads, tasks, employees, currentEmployee, markDirty, flushSync]
  );

  const toggleCounsellorAcceptingLeads = useCallback(
    (employeeId: string) => {
      setEmployees((prev) => prev.map((e) => (e.id === employeeId ? { ...e, accepts_new_leads: !e.accepts_new_leads } : e)));
      markDirty('employees', employeeId);
    },
    [markDirty]
  );

  const mergeLeads = useCallback(
    (survivingLeadId: string, duplicateLeadId: string) => {
      const nowIso = new Date().toISOString();
      // Re-parent child rows and mark every mutated row dirty — the old
      // version only updated local state, so the re-parenting never reached
      // the server. Id lists are derived from the closure arrays (not inside
      // the setState updaters, which run at render time and twice under
      // StrictMode).
      const reparentedActivities = activities.filter((a) => a.lead_id === duplicateLeadId).map((a) => a.id);
      const reparentedTasks = tasks.filter((t) => t.lead_id === duplicateLeadId).map((t) => t.id);
      const reparentedVisits = visits.filter((v) => v.lead_id === duplicateLeadId).map((v) => v.id);
      const reparentedPayments = payments.filter((p) => p.lead_id === duplicateLeadId).map((p) => p.id);

      setActivities((prev) => prev.map((a) => (a.lead_id === duplicateLeadId ? { ...a, lead_id: survivingLeadId } : a)));
      setTasks((prev) => prev.map((t) => (t.lead_id === duplicateLeadId ? { ...t, lead_id: survivingLeadId } : t)));
      setVisits((prev) => prev.map((v) => (v.lead_id === duplicateLeadId ? { ...v, lead_id: survivingLeadId } : v)));
      setPayments((prev) => prev.map((p) => (p.lead_id === duplicateLeadId ? { ...p, lead_id: survivingLeadId } : p)));
      reparentedActivities.forEach((id) => markDirty('lead_activities', id));
      reparentedTasks.forEach((id) => markDirty('follow_up_tasks', id));
      reparentedVisits.forEach((id) => markDirty('office_visits', id));
      reparentedPayments.forEach((id) => markDirty('payments', id));

      const mergedLostReasonId =
        lostReasons.find((r) => r.code === 'other')?.id ??
        lostReasons[lostReasons.length - 1]?.id;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === duplicateLeadId
            ? {
                ...l,
                duplicate_of: survivingLeadId,
                stage: 'lost' as LeadStage,
                lost_reason_id: mergedLostReasonId,
                lost_note: `Merged into ${survivingLeadId}`,
                next_action_at: null,
                updated_at: nowIso,
              }
            : l
        )
      );
      markDirty('leads', duplicateLeadId);
      const actId = genId();
      setActivities((prev) => [
        {
          id: actId,
          lead_id: survivingLeadId,
          employee_id: effectiveEmployee.id,
          activity_type: 'system',
          summary: `Merged duplicate lead record (${duplicateLeadId}) into this lead.`,
          occurred_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
      markDirty('lead_activities', actId);
    },
    [activities, tasks, visits, payments, lostReasons, currentEmployee, markDirty]
  );

  const bulkImportLeads = useCallback(
    async (rows: Partial<Lead>[]): Promise<{ inserted: number; failed: Array<{ row: number; error: string }> }> => {
      const failed: Array<{ row: number; error: string }> = [];
      const now = new Date().toISOString();
      const ready: Lead[] = [];

      rows.forEach((row, idx) => {
        const fullName = (row.full_name || '').trim();
        const phoneRaw = (row.phone_raw || '').trim();
        if (!fullName) {
          failed.push({ row: idx + 1, error: 'full_name is required' });
          return;
        }
        if (!phoneRaw) {
          failed.push({ row: idx + 1, error: 'phone_raw is required' });
          return;
        }
        // duplicates against in-memory leads
        const dup = checkDuplicateLead(
          { phone: phoneRaw, whatsapp: row.whatsapp_e164, email: row.email },
          leads,
        );
        if (dup.isDuplicate && dup.matchedLead) {
          failed.push({ row: idx + 1, error: `duplicate of "${dup.matchedLead.full_name}"` });
          return;
        }
        ready.push({
          id: genId(),
          full_name: fullName,
          phone_raw: phoneRaw,
          phone_e164: '',
          whatsapp_e164: (row.whatsapp_e164 || '').trim(),
          email: (row.email || '').trim().toLowerCase(),
          city: (row.city || 'Dhaka').trim(),
          country: row.country || 'BD',
          source_id: row.source_id || sources[0]?.id || '',
          source_ref: row.source_ref || `csv_import_${Date.now()}`,
          owner_id: row.owner_id || getNextCounsellorId(),
          stage: 'new',
          temperature: 'warm',
          score: 0,
          education_level: row.education_level || 'HSC',
          last_result: row.last_result || '',
          target_degree: row.target_degree || '',
          target_programme: row.target_programme || '',
          target_intake: row.target_intake || 'March 2027',
          english_level: row.english_level || 'Medium of Instruction',
          funding_confirmed: !!row.funding_confirmed,
          parent_involved: !!row.parent_involved,
          has_passport: !!row.has_passport,
          first_contact_at: null,
          next_action_at: null,
          next_action_note: 'Imported from CSV/XLSX — schedule first contact',
          tags: Array.isArray(row.tags) ? row.tags : [],
          created_at: now,
          updated_at: now,
        });
      });

      if (!ready.length) {
        return { inserted: 0, failed };
      }

      try {
        const res = await api.sync({ upserts: { leads: ready } });
        if (res.refreshedLeads?.length) {
          setLeads((prev) => {
            const map = new Map(prev.map((l) => [l.id, l]));
            for (const w of res.refreshedLeads) {
              map.set(w.id, {
                id: w.id,
                full_name: w.full_name,
                phone_raw: w.phone_raw ?? '',
                phone_e164: w.phone_e164 ?? '',
                whatsapp_e164: w.whatsapp_e164 ?? '',
                email: w.email ?? '',
                city: w.city ?? '',
                country: w.country,
                source_id: w.source_id ?? '',
                source_ref: w.source_ref ?? '',
                owner_id: w.owner_id ?? '',
                stage: w.stage as LeadStage,
                temperature: w.temperature as LeadTemperature,
                score: w.score,
                score_weight: w.score_weight ?? 5,
                education_level: w.education_level ?? '',
                last_result: w.last_result ?? '',
                target_degree: w.target_degree ?? '',
                target_programme: w.target_programme ?? '',
                target_intake: w.target_intake ?? '',
                english_level: w.english_level ?? '',
                funding_confirmed: !!w.funding_confirmed,
                parent_involved: !!w.parent_involved,
                has_passport: !!w.has_passport,
                first_contact_at: w.first_contact_at,
                next_action_at: w.next_action_at,
                next_action_note: w.next_action_note ?? '',
                lost_reason_id: w.lost_reason_id ?? undefined,
                lost_note: w.lost_note ?? undefined,
                nurture_until: w.nurture_until ?? undefined,
                duplicate_of: w.duplicate_of ?? undefined,
                tags: Array.isArray(w.tags) ? w.tags : [],
                created_at: w.created_at,
                updated_at: w.updated_at,
              });
            }
            return [...map.values()];
          });
        }
        // mark each imported lead as dirty so the offline-sync buffer is consistent
        for (const l of ready) {
          // nothing to push — the server already has them; markDirty would
          // re-upsert on the next flush which is wasted work.
        }
        return { inserted: res.refreshedLeads?.length ?? ready.length, failed };
      } catch (err) {
        for (const _ of ready) {
          failed.push({ row: -1, error: (err as Error).message });
        }
        return { inserted: 0, failed };
      }
    },
    [leads, sources, getNextCounsellorId]
  );

  const resetToDefaultData = useCallback(() => {
    // no-op: data lives in the database now
  }, []);

  // One-pass index of activities per lead. Views call getLeadScoreWeight /
  // getLeadActivities per row per render; without this index each call
  // scanned the entire activities array (O(leads × activities) per render —
  // the main source of tab-switch lag with real data volumes).
  const activitiesByLeadId = useMemo(() => {
    const map = new Map<string, LeadActivity[]>();
    for (const a of activities) {
      const list = map.get(a.lead_id);
      if (list) list.push(a);
      else map.set(a.lead_id, [a]);
    }
    return map;
  }, [activities]);

  const getLeadActivities = useCallback(
    (leadId: string): LeadActivity[] => activitiesByLeadId.get(leadId) ?? [],
    [activitiesByLeadId]
  );

  // Same one-pass index for tasks (ManagerView, LeadDetailModal,
  // TaskPriorityDashboard and useOverdueTasks all re-filter the global
  // tasks array per render otherwise).
  const tasksByLeadId = useMemo(() => {
    const map = new Map<string, FollowUpTask[]>();
    for (const t of tasks) {
      const list = map.get(t.lead_id);
      if (list) list.push(t);
      else map.set(t.lead_id, [t]);
    }
    return map;
  }, [tasks]);

  const getLeadTasks = useCallback(
    (leadId: string): FollowUpTask[] => tasksByLeadId.get(leadId) ?? [],
    [tasksByLeadId]
  );

  const getLeadScoreWeight = useCallback(
    (lead: Lead): LeadScoreWeightResult => calculateLeadScoreWeight(lead, activitiesByLeadId.get(lead.id) ?? [], sources),
    [activitiesByLeadId, sources]
  );
  const calculateLeadWeight = useCallback(
    (lead: Lead): number => calculateLeadScoreWeight(lead, activitiesByLeadId.get(lead.id) ?? [], sources).weight,
    [activitiesByLeadId, sources]
  );

  // surface the sync error as a separate field (already declared above the gate)
  const clearSyncError = useCallback(() => setSyncError(null), []);

  const value: CrmContextType = useMemo(() => ({
    loading,
    error: displayError,
    isAuthenticated,
    signOut,
    syncError,
    clearSyncError,
    currentEmployee: effectiveEmployee,
    setCurrentEmployee,
    employees,
    setEmployees,
    sources,
    lostReasons,
    leads,
    activities,
    tasks,
    visits,
    payments,
    stageHistory,
    company,
    companyPresets,
    updateCompany,
    switchCompanyPreset,
    createCompanyProfile,
    formatCurrency,
    createLead,
    updateLead,
    logInteraction,
    completeTask,
    reopenTask,
    updateTaskPriority,
    addQuickNote,
    scheduleFollowUpTask,
    batchScheduleFollowUpTasks,
    bookOfficeVisit,
    updateVisitStatus,
    recordPayment,
    verifyPayment,
    reassignLead,
    toggleCounsellorAcceptingLeads,
    mergeLeads,
    quickReplies,
    saveQuickReply,
    bulkImportLeads,
    resetToDefaultData,
    getLeadScoreWeight,
    calculateLeadWeight,
    getLeadActivities,
    getLeadTasks,
  }), [
    loading, displayError, isAuthenticated, signOut, syncError, clearSyncError,
    currentEmployee, setCurrentEmployee, employees, sources, lostReasons,
    leads, activities, tasks, visits, payments, stageHistory,
    company, companyPresets, updateCompany, switchCompanyPreset, createCompanyProfile, formatCurrency,
    createLead, updateLead, logInteraction, completeTask, reopenTask, updateTaskPriority, addQuickNote,
    scheduleFollowUpTask, batchScheduleFollowUpTasks, bookOfficeVisit, updateVisitStatus,
    recordPayment, verifyPayment, reassignLead, toggleCounsellorAcceptingLeads, mergeLeads,
    quickReplies, saveQuickReply,
    bulkImportLeads, resetToDefaultData, getLeadScoreWeight, calculateLeadWeight, getLeadActivities, getLeadTasks,
  ]);

  // Render the gate instead of the children while the session is still
  // resolving OR the user has no employee bound. We do this at the END
  // of the function so all hooks above are called unconditionally across
  // renders — putting this branch earlier violates the Rules of Hooks.
  if (!currentEmployee) {
    return (
      <CrmContext.Provider value={value}>
        <BootstrapGate loading={loading} isAuthenticated={isAuthenticated} error={displayError} signOut={signOut} />
      </CrmContext.Provider>
    );
  }
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};
