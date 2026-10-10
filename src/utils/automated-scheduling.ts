import { Lead, LeadActivity, FollowUpTask, Employee, AutomatedTaskSuggestion, TaskPriority, ActivityType } from '../types';

/**
 * Compute a sensible due time for a follow-up task.
 *
 * Rules (all times in Asia/Dhaka business hours 10:00–19:00, Sun–Thu):
 *  - If it's currently before 17:00 on a working day, the due time is now + 3 hours
 *    (clamped to 19:00) — gives the counsellor a meaningful chunk of the day to act.
 *  - If it's after 17:00 on a working day, push to next working day at 10:00.
 *  - If Friday (BD's weekend-equivalent) or Sat/Sun → next working day at 10:00.
 *  - The result is an ISO 8601 UTC string ready to drop into a `due_at` column.
 *
 * Note: `Date` works in the browser's local timezone. We use the BD offset
 * (UTC+6) to interpret wall-clock hours; this matches the team's working day
 * even if a user is travelling.
 */
export function suggestDueAt(now: Date = new Date()): string {
  // Convert "now" to Asia/Dhaka wall-clock components
  const dhakaMs = now.getTime() + 6 * 60 * 60 * 1000; // UTC+6
  const dhaka = new Date(dhakaMs);
  const dayOfWeek = dhaka.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
  const hour = dhaka.getUTCHours();

  // Helper: convert a Dhaka wall-clock (y/m/d hh:mm) to a UTC Date
  const dhakaToUtc = (y: number, m: number, d: number, hh: number, mm: number): Date => {
    const utcMs = Date.UTC(y, m, d, hh, mm) - 6 * 60 * 60 * 1000;
    return new Date(utcMs);
  };

  const isWorking = (d: number): boolean => d >= 0 && d <= 4; // Sun(0)–Thu(4)
  const advanceDays = (currentDay: number, currentHour: number): number => {
    if (isWorking(currentDay)) {
      if (currentHour < 17) return 0;
      return 1;
    }
    if (currentDay === 5) return 2; // Fri → Sun
    if (currentDay === 6) return 1; // Sat → Sun
    return 1;
  };

  const dayShift = advanceDays(dayOfWeek, hour);
  // Skip weekend days defensively
  let finalShift = dayShift;
  const targetDhaka = new Date(dhaka.getTime() + dayShift * 24 * 60 * 60 * 1000);
  const targetDayOfWeek = targetDhaka.getUTCDay();
  if (!isWorking(targetDayOfWeek)) {
    finalShift = dayShift + (8 - targetDayOfWeek); // jump forward to next Sunday
  }

  let dueDhaka: Date;
  if (dayShift === 0 && hour < 17) {
    // Same working day, +3 hours, clamped to 19:00 BD
    const target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const dueDhakaMs = target.getTime() + 6 * 60 * 60 * 1000;
    const dueDhakaDate = new Date(dueDhakaMs);
    if (dueDhakaDate.getUTCHours() >= 19) {
      // Clamp to today's 19:00 BD
      const today19Dhaka = new Date(dhaka);
      today19Dhaka.setUTCHours(19, 0, 0, 0);
      dueDhaka = new Date(today19Dhaka.getTime() - 6 * 60 * 60 * 1000);
    } else {
      dueDhaka = target;
    }
  } else {
    // Next working day at 10:00 BD
    const target = new Date(dhaka.getTime() + finalShift * 24 * 60 * 60 * 1000);
    const y = target.getUTCFullYear();
    const m = target.getUTCMonth();
    const d = target.getUTCDate();
    dueDhaka = dhakaToUtc(y, m, d, 10, 0);
  }

  return dueDhaka.toISOString();
}

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
  // Single pass instead of filter+sort: callers may pass the full activities
  // array, so avoiding the O(n log n) sort with Date allocations keeps this
  // cheap enough to call per lead per render.
  let latest: LeadActivity | null = null;
  let latestTime = -Infinity;
  for (const act of activities) {
    if (act.lead_id !== lead.id || act.activity_type === 'system') continue;
    const t = new Date(act.occurred_at).getTime();
    if (t > latestTime) {
      latestTime = t;
      latest = act;
    }
  }

  if (latest) {
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
  // Use the real dormancy (floored); "Day 3" floor was misleading at 5/7d
  // thresholds. Caller already gated daysDormant >= thresholdDays so we know
  // it's at least that many days.
  const roundedDays = Math.max(1, Math.floor(daysDormant));
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

  // Suggested due time: business-hours aware, BD-timezone, weekend-skipping.
  const suggestedDueAt = suggestDueAt();

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

  // Group activities by lead once so the per-lead loop below stays O(1) per
  // lookup instead of scanning the whole activities array for every lead.
  const actsByLead = new Map<string, LeadActivity[]>();
  for (const act of activities) {
    const list = actsByLead.get(act.lead_id);
    if (list) list.push(act);
    else actsByLead.set(act.lead_id, [act]);
  }
  const leadIdsWithOpenTask = new Set<string>();
  for (const t of tasks) {
    if (t.status === 'open') leadIdsWithOpenTask.add(t.lead_id);
  }

  const suggestions: AutomatedTaskSuggestion[] = [];

  for (const lead of leads) {
    // Exclude terminal/excluded stages and duplicates.
    // 'nurture' is excluded too — per STAGE_CONFIG it's for 30-90 day follow-ups
    // and showing it in a 3-day-dormant scheduler list is wrong.
    if (['lost', 'enrolled', 'nurture'].includes(lead.stage) || lead.duplicate_of) {
      continue;
    }

    const { lastContactedAt, contactSource } = getLeadLastContacted(lead, actsByLead.get(lead.id) ?? []);
    const daysDormant = calculateDaysDormant(lastContactedAt);

    if (daysDormant >= thresholdDays) {
      const hasOpenTask = leadIdsWithOpenTask.has(lead.id);
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
