// Wire types that match the server's bootstrap/sync contract.
export type WireLead = {
  id: string;
  full_name: string;
  phone_raw: string | null;
  phone_e164: string | null;
  whatsapp_e164: string | null;
  email: string | null;
  city: string | null;
  country: string;
  source_id: string | null;
  source_ref: string | null;
  owner_id: string | null;
  stage: string;
  temperature: string;
  score: number;
  score_weight: number | null;
  education_level: string | null;
  last_result: string | null;
  target_degree: string | null;
  target_programme: string | null;
  target_intake: string | null;
  english_level: string | null;
  funding_confirmed: boolean | null;
  parent_involved: boolean | null;
  has_passport: boolean | null;
  first_contact_at: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  lost_reason_id: number | null;
  lost_note: string | null;
  nurture_until: string | null;
  duplicate_of: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type WireActivity = {
  id: string;
  lead_id: string;
  employee_id: string | null;
  activity_type: string;
  direction: string | null;
  outcome: string | null;
  summary: string;
  next_action_at: string | null;
  next_action_note: string | null;
  occurred_at: string;
  created_at: string;
};

export type WireTask = {
  id: string;
  lead_id: string;
  assigned_to: string;
  task_type: string;
  cadence_step: number | null;
  due_at: string;
  status: string;
  priority: string | null;
  completed_at: string | null;
  activity_id: string | null;
  title: string;
  created_at: string;
};

export type WireVisit = {
  id: string;
  lead_id: string;
  counsellor_id: string | null;
  scheduled_at: string;
  duration_min: number;
  mode: string;
  attendees: string | null;
  status: string;
  outcome_note: string | null;
  created_at: string;
};

export type WirePayment = {
  id: string;
  lead_id: string;
  package: string;
  payment_type: string;
  amount: number | null;
  currency: string;
  paid_at: string;
  method: string | null;
  receipt_ref: string | null;
  recorded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
};

export type WireEmployee = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone_e164: string | null;
  role: 'admin' | 'manager' | 'counsellor';
  is_active: boolean;
  accepts_new_leads: boolean;
  last_assigned_at: string | null;
  created_at: string;
  title: string | null;
};

export type WireSource = {
  id: string;
  channel: string;
  name: string;
  campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  default_owner_id: string | null;
  is_active: boolean;
};

export type WireLostReason = {
  id: number;
  code: string;
  label: string;
  requires_note: boolean;
  sort_order: number;
};

export type WireStageHistory = {
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
};

export type BootstrapPayload = {
  orgId: string;
  // Server-stated identity of the requesting viewer — the authoritative way
  // to pick currentEmployee (counsellor-scoped employees omit user_id).
  viewer?: { employeeId: string; role: string };
  employees: WireEmployee[];
  sources: WireSource[];
  lostReasons: WireLostReason[];
  leads: WireLead[];
  activities: WireActivity[];
  tasks: WireTask[];
  visits: WireVisit[];
  payments: WirePayment[];
  stageHistory: WireStageHistory[];
  serverTime: string;
};

export type SyncResponse = {
  ok: true;
  refreshedLeads: WireLead[];
  refreshedStageHistory: WireStageHistory[];
  serverTime: string;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.detail || j?.error || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async health(): Promise<{ ok: boolean }> {
    return handle(await fetch('/api/health', { credentials: 'include' }));
  },
  async me(): Promise<{ userId: string; email: string | null; orgId: string | null }> {
    return handle(await fetch('/api/me', { credentials: 'include' }));
  },
  async bootstrap(): Promise<BootstrapPayload> {
    return handle(await fetch('/api/bootstrap', { credentials: 'include' }));
  },
  async sync(payload: unknown): Promise<SyncResponse> {
    return handle(
      await fetch('/api/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },
};
