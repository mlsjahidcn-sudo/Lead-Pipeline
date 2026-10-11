import { Lead, Employee, LeadScoreWeightResult, LeadSource } from '../types';
import { getStageLabel, isNextActionOverdue } from './crm-logic';
import { CounsellorStat, SourceStat } from './analytics';

const downloadCsvBlob = (content: string, filename: string) => {
  // UTF-8 BOM keeps Bangla + Excel happy
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Counsellor performance scorecard export (Reports tab). */
export function exportCounsellorScorecardCsv(stats: CounsellorStat[], companySlug: string): void {
  const headers = [
    'Counsellor', 'Role', 'Leads', 'Open Leads', 'Contacted', 'Contact Rate %',
    'Visit-Stage Leads', 'Visits Attended', 'Paid', 'Revenue',
    'Tasks', 'Tasks Done', 'Task Completion %', 'SLA Eligible', 'SLA Compliant', 'SLA Compliance %',
  ];
  const rows = stats.map((s) =>
    [
      `"${s.name}"`, `"${s.role}"`, s.leads, s.openLeads, s.contactedLeads, s.contactRate.toFixed(1),
      s.visitStageLeads, s.visitsAttended, s.paid, s.revenue,
      s.tasksTotal, s.tasksDone, s.taskCompletionRate.toFixed(1), s.slaEligible, s.slaCompliant, s.slaComplianceRate.toFixed(1),
    ].join(',')
  );
  downloadCsvBlob(
    [headers.join(','), ...rows].join('\r\n'),
    `${companySlug || 'crm'}_counsellor_scorecard_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

/** Source ROI scorecard export (Reports tab). */
export function exportSourceScorecardCsv(stats: SourceStat[], companySlug: string): void {
  const headers = [
    'Source', 'Channel', 'Leads', 'Contacted', 'Visit-Stage', 'Paid / Enrolled',
    'Conversion %', 'Revenue',
  ];
  const rows = stats.map((s) =>
    [
      `"${s.name}"`, `"${s.channel}"`, s.leads, s.contacted, s.visits, s.paid,
      s.conversionRate.toFixed(1), s.revenue,
    ].join(',')
  );
  downloadCsvBlob(
    [headers.join(','), ...rows].join('\r\n'),
    `${companySlug || 'crm'}_source_scorecard_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

/**
 * Export leads to CSV and trigger a browser download. Extracted from
 * InboxView so both "export all (filtered)" and "export selected" share it.
 */
export function exportLeadsCsv(
  leads: Lead[],
  ctx: {
    employees: Employee[];
    getWeight: (lead: Lead) => LeadScoreWeightResult;
    companySlug: string;
    suffix?: string;
  }
): void {
  const headers = [
    'Name',
    'Phone',
    'Email',
    'City',
    'Stage',
    'Score Weight (1-10)',
    'Temperature',
    'Qualification Score (0-100)',
    'Profile Completion %',
    'Activity Count',
    'Target Degree',
    'Target Intake',
    'Owner',
    'Next Action Due',
    'Created At',
  ];
  const employeeById = new Map(ctx.employees.map((e) => [e.id, e]));
  const rows = leads.map((l) => {
    const owner = employeeById.get(l.owner_id);
    const wResult = ctx.getWeight(l);
    return [
      `"${l.full_name}"`,
      `"${l.phone_e164 || l.phone_raw}"`,
      `"${l.email || ''}"`,
      `"${l.city}"`,
      `"${l.stage}"`,
      wResult.weight,
      `"${l.temperature}"`,
      l.score,
      `${wResult.profileCompletionPercentage}%`,
      wResult.activityCount,
      `"${l.target_degree}"`,
      `"${l.target_intake}"`,
      `"${owner?.full_name || 'Unassigned'}"`,
      `"${l.next_action_at || ''}"`,
      `"${l.created_at}"`,
    ].join(',');
  });
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const compSlug = (ctx.companySlug || 'crm').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const suffix = ctx.suffix ? `_${ctx.suffix}` : '';
  a.download = `${compSlug}_leads${suffix}_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const FULL_CSV_HEADERS = [
  'Lead ID',
  'Student Name',
  'Phone (E.164)',
  'Phone (Raw)',
  'WhatsApp (E.164)',
  'Email',
  'City',
  'Country',
  'Pipeline Stage Code',
  'Pipeline Status Label',
  'Temperature',
  'Score (0-100)',
  'Target Degree',
  'Target Programme',
  'Target Intake',
  'Education Level',
  'Last Academic Result GPA',
  'English Proficiency',
  'Funding Confirmed',
  'Parent/Guardian Involved',
  'Has Valid Passport',
  'Lead Source Name',
  'Source Channel',
  'Assigned Counsellor',
  'Counsellor Email',
  'First Contact Date',
  'Next Action Due Date',
  'Next Action Note',
  'Next Action Overdue',
  'Lost Exit Reason',
  'Lost Note',
  'Created Date',
  'Last Updated Date',
];

const escapeCsv = (val: unknown): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Full 33-field RFC-4180 export (UTF-8 BOM + CRLF — Excel/Sheets-friendly,
 * Bangla-safe). Extracted from ReportsView so any view (scorecards, merge
 * review, inbox) can produce the same file shape.
 */
export function exportLeadsFullCsv(
  leadsToExport: Lead[],
  ctx: {
    employees: Employee[];
    sources: LeadSource[];
    companySlug: string;
    scopeLabel: string;
  }
): void {
  const employeeById = new Map(ctx.employees.map((e) => [e.id, e]));
  const sourceById = new Map(ctx.sources.map((s) => [s.id, s]));

  const rows = leadsToExport.map((l) => {
    const owner = employeeById.get(l.owner_id);
    const source = sourceById.get(l.source_id);
    const isOverdue = isNextActionOverdue(l);

    return [
      escapeCsv(l.id),
      escapeCsv(l.full_name),
      escapeCsv(l.phone_e164),
      escapeCsv(l.phone_raw),
      escapeCsv(l.whatsapp_e164),
      escapeCsv(l.email || ''),
      escapeCsv(l.city),
      escapeCsv(l.country || 'Bangladesh'),
      escapeCsv(l.stage),
      escapeCsv(getStageLabel(l.stage)),
      escapeCsv(l.temperature),
      escapeCsv(l.score),
      escapeCsv(l.target_degree),
      escapeCsv(l.target_programme),
      escapeCsv(l.target_intake),
      escapeCsv(l.education_level),
      escapeCsv(l.last_result),
      escapeCsv(l.english_level),
      escapeCsv(l.funding_confirmed ? 'Yes' : 'No'),
      escapeCsv(l.parent_involved ? 'Yes' : 'No'),
      escapeCsv(l.has_passport ? 'Yes' : 'No'),
      escapeCsv(source?.name || 'Direct'),
      escapeCsv(source?.channel || ''),
      escapeCsv(owner?.full_name || 'Unassigned'),
      escapeCsv(owner?.email || ''),
      escapeCsv(l.first_contact_at || ''),
      escapeCsv(l.next_action_at || ''),
      escapeCsv(l.next_action_note || ''),
      escapeCsv(isOverdue ? 'Yes' : 'No'),
      escapeCsv(l.lost_reason_id || ''),
      escapeCsv(l.lost_note || ''),
      escapeCsv(l.created_at),
      escapeCsv(l.updated_at),
    ].join(',');
  });

  const csvContent = [FULL_CSV_HEADERS.join(','), ...rows].join('\r\n');
  // Prepend UTF-8 BOM for Excel + Bangla character compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const scopeSlug = ctx.scopeLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const compSlug = (ctx.companySlug || 'crm').toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.href = url;
  link.download = `${compSlug}_leads_${scopeSlug}_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
