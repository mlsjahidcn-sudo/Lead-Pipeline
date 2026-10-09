import { Lead, LeadActivity, FollowUpTask, Employee, AutomatedTaskSuggestion, TaskPriority, ActivityType } from '../types';

/**
 * Determines the last contacted timestamp for a lead based on:
 * 1. Most recent logged engagement activity (call, whatsapp, sms, email, meeting, etc.)
 * 2. Or lead.first_contact_at
 * 3. Or lead.created_at (uncontacted since intake)
 */
export function getLeadLastContacted(
  lead: Lead,
  activities: LeadActivity[]
): {
  lastContactedAt: string;
  contactSource: 'activity' | 'first_contact' | 'created';
  lastActivitySummary?: string;
  lastActivityType?: ActivityType;
} {
  const leadActivities = activities
    .filter((act) => act.lead_id === lead.id && act.activity_type !== 'system')
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  if (leadActivities.length > 0) {
    const latest = leadActivities[0];
    return {
      lastContactedAt: latest.occurred_at,
      contactSource: 'activity',
      lastActivitySummary: latest.summary,
      lastActivityType: latest.activity_type,
    };
  }

  if (lead.first_contact_at) {
    return {
      lastContactedAt: lead.first_contact_at,
      contactSource: 'first_contact',
      lastActivitySummary: 'Initial contact recorded',
      lastActivityType: 'call',
    };
  }

  return {
    lastContactedAt: lead.created_at,
    contactSource: 'created',
    lastActivitySummary: 'Lead created in system (never contacted)',
  };
}

/**
 * Calculates days dormant since last contact.
 */
export function calculateDaysDormant(lastContactedAt: string, referenceTime: Date = new Date()): number {
  const lastTime = new Date(lastContactedAt).getTime();
  const diffMs = referenceTime.getTime() - lastTime;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats dormant days text nicely.
 */
export function formatDormancyLabel(days: number): string {
  const rounded = Math.floor(days);
  if (rounded <= 0) return 'Today';
  if (rounded === 1) return '1 day ago';
  return `${rounded} days ago`;
}

/**
 * Generates an automated task suggestion for a dormant lead based on pipeline stage,
 * target degree, score, and days elapsed since last contact.
 */
export function generateSuggestionForLead(
  lead: Lead,
  daysDormant: number,
  lastContactedAt: string,
  contactSource: 'activity' | 'first_contact' | 'created',
  counsellorName: string,
  hasOpenTask: boolean
): AutomatedTaskSuggestion {
  const roundedDays = Math.max(3, Math.floor(daysDormant));
  const degree = lead.target_degree || 'Chinese University Degree';
  const programme = lead.target_programme ? ` (${lead.target_programme})` : '';

  let taskType: 'call' | 'whatsapp' | 'email' | 'meeting' | 'office_visit' = 'call';
  let title = '';
  let rationale = '';
  let cadenceStep = 3;

  switch (lead.stage) {
    case 'new':
      taskType = 'call';
      title = `Urgent Recovery Call: Day ${roundedDays} Inbound Re-engagement with ${lead.full_name}`;
      rationale = `Inbound lead has not been contacted for ${roundedDays} days since intake. Immediate outbound call needed to prevent lead loss.`;
      cadenceStep = 3;
      break;

    case 'contacted':
      taskType = 'whatsapp';
      title = `Day ${roundedDays} Follow-up WhatsApp: Share ${degree} Scholarship Guide & University List`;
      rationale = `No interaction logged for ${roundedDays} days after initial contact. Send curated Chinese university options and brochure to re-engage on WhatsApp.`;
      cadenceStep = 3;
      break;

    case 'qualified':
      taskType = 'call';
      title = `Follow-up Consultation Call: Review ${degree}${programme} Eligibility & Schedule Office Visit`;
      rationale = `Qualified candidate dormant for ${roundedDays} days. Call student to discuss application readiness and invite to Dhaka office consultation.`;
      cadenceStep = 3;
      break;

    case 'consultation_booked':
      taskType = 'whatsapp';
      title = `Consultation Reconfirmation: Confirm time & Send Google Meet/Office Map to ${lead.full_name}`;
      rationale = `Consultation scheduled but no communication in ${roundedDays} days. Send reminder to ensure attendance.`;
      cadenceStep = 3;
      break;

    case 'consultation_done':
      taskType = 'call';
      title = `Post-Consultation Follow-up Call: Address Parent Questions & Review Application Package`;
      rationale = `Consultation was completed, but lead has had no touchpoint for ${roundedDays} days. Call to overcome objections and advance to Office Visit or Payment.`;
      cadenceStep = 7;
      break;

    case 'office_visit_booked':
      taskType = 'call';
      title = `Confirm Dhaka Office Visit: Check Father/Mother attendance & directions to Navana Tower`;
      rationale = `Office visit pending with no contact for ${roundedDays} days. Ensure student and guardians are confirmed for in-person meeting.`;
      cadenceStep = 3;
      break;

    case 'office_visit_done':
      taskType = 'call';
      title = `Closing Decision Follow-up: Finalize University Application & Reserve March 2027 Seat`;
      rationale = `Office visit finished ${roundedDays} days ago without enrollment. High-urgency closing call required to secure agreement.`;
      cadenceStep = 7;
      break;

    case 'paid':
      taskType = 'whatsapp';
      title = `Admission Processing Check-in: Collect Passport Notarization & Academic Dossier`;
      rationale = `Paid student has not received an update in ${roundedDays} days. Share admission progress report and request remaining documents.`;
      cadenceStep = 7;
      break;

    case 'nurture':
      taskType = 'whatsapp';
      title = `Cadence Broadcast: Share Friday China Study Webinar link & Spring Intake Updates`;
      rationale = `Nurture student inactive for ${roundedDays} days. Send webinar invite and low-pressure scholarship announcement.`;
      cadenceStep = 14;
      break;

    default:
      taskType = 'call';
      title = `Automated Re-engagement: Follow up with ${lead.full_name} regarding ${degree}`;
      rationale = `Lead inactive for ${roundedDays} days without logged activity.`;
      cadenceStep = 3;
  }

  // Priority calculation
  let priority: TaskPriority = 'medium';
  if (
    lead.temperature === 'hot' ||
    lead.score >= 80 ||
    lead.stage === 'office_visit_done' ||
    daysDormant >= 5
  ) {
    priority = 'high';
  } else if (lead.stage === 'nurture' || lead.temperature === 'cold') {
    priority = 'low';
  }

  // Suggested due date (suggest today at 11:00 or 15:00 local time, or +3 hours)
  const now = new Date();
  const due = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const suggestedDueAt = due.toISOString();

  return {
    leadId: lead.id,
    leadName: lead.full_name,
    leadPhone: lead.phone_e164 || lead.phone_raw,
    leadStage: lead.stage,
    counsellorId: lead.owner_id,
    counsellorName,
    lastContactedAt,
    daysDormant,
    contactSource,
    hasOpenTask,
    suggestedTaskType: taskType,
    suggestedTitle: title,
    suggestedPriority: priority,
    suggestedDueAt,
    rationale,
    cadenceStep,
  };
}

/**
 * Scans all leads and extracts automated follow-up suggestions for any lead
 * that has not been engaged with for 3 or more days (daysDormant >= thresholdDays).
 */
export function findDormantLeadsNeedingFollowUp(
  leads: Lead[],
  activities: LeadActivity[],
  tasks: FollowUpTask[],
  employees: Employee[],
  thresholdDays: number = 3
): AutomatedTaskSuggestion[] {
  const employeeMap = new Map<string, string>();
  employees.forEach((emp) => employeeMap.set(emp.id, emp.full_name));

  const suggestions: AutomatedTaskSuggestion[] = [];

  for (const lead of leads) {
    // Exclude terminal stages and duplicates
    if (['lost', 'enrolled'].includes(lead.stage) || lead.duplicate_of) {
      continue;
    }

    const { lastContactedAt, contactSource } = getLeadLastContacted(lead, activities);
    const daysDormant = calculateDaysDormant(lastContactedAt);

    if (daysDormant >= thresholdDays) {
      const hasOpenTask = tasks.some(
        (t) => t.lead_id === lead.id && t.status === 'open'
      );
      const counsellorName = employeeMap.get(lead.owner_id) || 'Unassigned';

      const suggestion = generateSuggestionForLead(
        lead,
        daysDormant,
        lastContactedAt,
        contactSource,
        counsellorName,
        hasOpenTask
      );

      suggestions.push(suggestion);
    }
  }

  // Sort by days dormant descending (most neglected first), with high priority on top
  return suggestions.sort((a, b) => {
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const pDiff = (pOrder[a.suggestedPriority] ?? 1) - (pOrder[b.suggestedPriority] ?? 1);
    if (pDiff !== 0) return pDiff;
    return b.daysDormant - a.daysDormant;
  });
}
