import { Lead, Payment, OfficeVisit, FollowUpTask, Employee, LeadSource } from '../types';

/**
 * Shared single-pass analytics. Previously the same aggregates (funnel,
 * per-source, per-counsellor, revenue, SLA) were computed inline — often
 * O(n²) — and duplicated across ReportsView, ManagerView and
 * JahidOversightView. Views should wrap these in useMemo and never
 * re-implement the aggregations.
 *
 * Stage-set definitions mirror the existing funnel semantics:
 *  - "consultation" = consultation_booked/done or later visit/paid stages
 *  - "visit"        = office_visit_booked/done, paid or enrolled
 *  - "converted"    = paid or enrolled
 */

const STAGE_SETS = {
  consultation: ['consultation_booked', 'consultation_done', 'office_visit_booked', 'office_visit_done', 'paid', 'enrolled'],
  visit: ['office_visit_booked', 'office_visit_done', 'paid', 'enrolled'],
  converted: ['paid', 'enrolled'],
} as const;

const isOpenStage = (stage: string) => !['lost', 'enrolled', 'paid'].includes(stage);

export interface PipelineFunnel {
  total: number;
  contacted: number;
  consultations: number;
  visits: number;
  converted: number;
  activeLeads: number;
  hotActiveLeads: number;
  newLeads: number;
}

export const computeFunnel = (allLeads: Lead[]): PipelineFunnel => {
  const funnel: PipelineFunnel = {
    total: 0, contacted: 0, consultations: 0, visits: 0, converted: 0,
    activeLeads: 0, hotActiveLeads: 0, newLeads: 0,
  };
  for (const l of allLeads) {
    if (l.duplicate_of) continue;
    funnel.total++;
    if (l.first_contact_at !== null) funnel.contacted++;
    if ((STAGE_SETS.consultation as readonly string[]).includes(l.stage)) funnel.consultations++;
    if ((STAGE_SETS.visit as readonly string[]).includes(l.stage)) funnel.visits++;
    if ((STAGE_SETS.converted as readonly string[]).includes(l.stage)) funnel.converted++;
    if (!['lost', 'enrolled'].includes(l.stage)) {
      funnel.activeLeads++;
      if (l.temperature === 'hot') funnel.hotActiveLeads++;
    }
    if (l.stage === 'new') funnel.newLeads++;
  }
  return funnel;
};

export interface SourceStat {
  sourceId: string;
  name: string;
  channel: string;
  leads: number;
  contacted: number;
  visits: number;
  paid: number;
  revenue: number;
  conversionRate: number; // paid / leads, percent
}

export const computeSourceStats = (
  allLeads: Lead[],
  sources: LeadSource[],
  payments: Payment[]
): SourceStat[] => {
  const stats = new Map<string, SourceStat>();
  const ensure = (id: string, name: string, channel: string): SourceStat => {
    let s = stats.get(id);
    if (!s) {
      s = { sourceId: id, name, channel, leads: 0, contacted: 0, visits: 0, paid: 0, revenue: 0, conversionRate: 0 };
      stats.set(id, s);
    }
    return s;
  };
  // Leads without a resolvable source collapse into a pseudo "Direct" bucket.
  for (const s of sources) ensure(s.id, s.name, s.channel);

  const sourceIdByLeadId = new Map<string, string>();
  for (const l of allLeads) {
    if (l.duplicate_of) continue;
    const st = l.source_id ? ensure(l.source_id, sources.find((s) => s.id === l.source_id)?.name || 'Direct', sources.find((s) => s.id === l.source_id)?.channel || '') : ensure('', 'Direct', '');
    sourceIdByLeadId.set(l.id, st.sourceId);
    st.leads++;
    if (l.first_contact_at !== null) st.contacted++;
    if ((STAGE_SETS.visit as readonly string[]).includes(l.stage)) st.visits++;
    if ((STAGE_SETS.converted as readonly string[]).includes(l.stage)) st.paid++;
  }
  for (const p of payments) {
    const sid = sourceIdByLeadId.get(p.lead_id);
    if (sid !== undefined) stats.get(sid)!.revenue += p.amount;
  }
  const list = [...stats.values()];
  for (const s of list) s.conversionRate = s.leads > 0 ? (s.paid / s.leads) * 100 : 0;
  return list.sort((a, b) => b.leads - a.leads);
};

export interface CounsellorStat {
  employeeId: string;
  name: string;
  role: string;
  leads: number;
  openLeads: number;
  contactedLeads: number;
  contactRate: number; // percent
  visitStageLeads: number; // leads in office_visit_booked/done, paid or enrolled
  visitsAttended: number;
  paid: number;
  revenue: number;
  tasksTotal: number;
  tasksDone: number;
  taskCompletionRate: number; // percent
  slaEligible: number; // leads created >2h ago
  slaCompliant: number; // first contact within 120 minutes
  slaComplianceRate: number; // percent
}

export const computeCounsellorStats = (
  allLeads: Lead[],
  employees: Employee[],
  payments: Payment[],
  visits: OfficeVisit[],
  tasks: FollowUpTask[]
): CounsellorStat[] => {
  const byId = new Map<string, CounsellorStat>();
  const ensure = (id: string, name: string, role: string): CounsellorStat => {
    let s = byId.get(id);
    if (!s) {
      s = {
        employeeId: id, name, role,
        leads: 0, openLeads: 0, contactedLeads: 0, contactRate: 0,
        visitStageLeads: 0, visitsAttended: 0, paid: 0, revenue: 0,
        tasksTotal: 0, tasksDone: 0, taskCompletionRate: 0,
        slaEligible: 0, slaCompliant: 0, slaComplianceRate: 0,
      };
      byId.set(id, s);
    }
    return s;
  };

  const ownerByLeadId = new Map<string, string>();
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const l of allLeads) {
    if (l.duplicate_of) continue;
    const st = l.owner_id
      ? ensure(l.owner_id, employees.find((e) => e.id === l.owner_id)?.full_name || 'Unassigned', employees.find((e) => e.id === l.owner_id)?.role || '')
      : ensure('', 'Unassigned', '');
    ownerByLeadId.set(l.id, st.employeeId);
    st.leads++;
    if (isOpenStage(l.stage)) st.openLeads++;
    if (l.first_contact_at !== null) st.contactedLeads++;
    if ((STAGE_SETS.visit as readonly string[]).includes(l.stage)) st.visitStageLeads++;
    if ((STAGE_SETS.converted as readonly string[]).includes(l.stage)) st.paid++;
    // SLA: only leads created more than 2h ago count; contact within 120 min passes
    const created = new Date(l.created_at).getTime();
    if (created < twoHoursAgo) {
      st.slaEligible++;
      if (l.first_contact_at && new Date(l.first_contact_at).getTime() - created <= 120 * 60 * 1000) {
        st.slaCompliant++;
      }
    }
  }
  for (const p of payments) {
    const oid = ownerByLeadId.get(p.lead_id);
    if (oid !== undefined) byId.get(oid)!.revenue += p.amount;
  }
  for (const v of visits) {
    if (v.status !== 'attended' || !v.counsellor_id) continue;
    ensure(v.counsellor_id, employees.find((e) => e.id === v.counsellor_id)?.full_name || 'Unknown', employees.find((e) => e.id === v.counsellor_id)?.role || '').visitsAttended++;
  }
  for (const t of tasks) {
    if (!t.assigned_to) continue;
    const st = ensure(t.assigned_to, employees.find((e) => e.id === t.assigned_to)?.full_name || 'Unknown', employees.find((e) => e.id === t.assigned_to)?.role || '');
    st.tasksTotal++;
    if (t.status === 'done') st.tasksDone++;
  }

  const list = [...byId.values()];
  for (const s of list) {
    s.contactRate = s.leads > 0 ? (s.contactedLeads / s.leads) * 100 : 0;
    s.taskCompletionRate = s.tasksTotal > 0 ? (s.tasksDone / s.tasksTotal) * 100 : 0;
    s.slaComplianceRate = s.slaEligible > 0 ? (s.slaCompliant / s.slaEligible) * 100 : 0;
  }
  return list;
};

export interface RevenueSummary {
  totalCollected: number;
  verifiedTotal: number;
  verifiedCount: number;
  unverifiedCount: number;
}

export const computeRevenueSummary = (payments: Payment[]): RevenueSummary => {
  const summary: RevenueSummary = { totalCollected: 0, verifiedTotal: 0, verifiedCount: 0, unverifiedCount: 0 };
  for (const p of payments) {
    summary.totalCollected += p.amount;
    if (p.verified_at) {
      summary.verifiedTotal += p.amount;
      summary.verifiedCount++;
    } else {
      summary.unverifiedCount++;
    }
  }
  return summary;
};

export interface SlaTrendPoint {
  date: string; // YYYY-MM-DD
  label: string; // "12 Oct"
  created: number;
  eligible: number; // created on that day (all eligible — same-day leads count once 2h passed)
  contactedInSla: number;
  compliancePct: number | null; // null when no eligible leads that day (chart gap, not 0)
}

/** Daily first-contact-within-2h compliance over the last `days` days. */
export const computeSlaTrend = (allLeads: Lead[], days = 30): SlaTrendPoint[] => {
  const byDay = new Map<string, { created: number; contactedInSla: number }>();
  const points: SlaTrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay.set(key, { created: 0, contactedInSla: 0 });
    points.push({
      date: key,
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      created: 0,
      eligible: 0,
      contactedInSla: 0,
      compliancePct: null,
    });
  }
  const pointByDate = new Map(points.map((p) => [p.date, p]));
  for (const l of allLeads) {
    if (l.duplicate_of) continue;
    const created = new Date(l.created_at);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
    const point = pointByDate.get(key);
    if (!point) continue;
    point.created++;
    if (l.first_contact_at && new Date(l.first_contact_at).getTime() - created.getTime() <= 120 * 60 * 1000) {
      point.contactedInSla++;
      point.eligible++;
    } else if (!l.first_contact_at && Date.now() - created.getTime() > 120 * 60 * 1000) {
      // Created >2h ago and still uncontacted — eligible, non-compliant
      point.eligible++;
    } else if (l.first_contact_at) {
      // Contacted, but late
      point.eligible++;
    }
  }
  for (const p of points) {
    p.compliancePct = p.eligible > 0 ? Math.round((p.contactedInSla / p.eligible) * 100) : null;
  }
  return points;
};
