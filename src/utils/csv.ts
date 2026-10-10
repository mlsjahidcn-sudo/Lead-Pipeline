import { Lead, Employee, LeadScoreWeightResult } from '../types';

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
