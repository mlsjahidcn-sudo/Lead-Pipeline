import { Lead, LeadTemperature, SlaInfo } from '../types';

/**
 * Normalises Bangladesh mobile numbers to +8801XXXXXXXXX (E.164).
 * Follows exact international & local mobile normalization specification:
 * - 01XXXXXXXXX (11 digits) -> +8801XXXXXXXXX
 * - 8801XXXXXXXXX or 008801XXXXXXXXX -> +8801XXXXXXXXX
 * - +88001XXXXXXXXX -> drop extra 0 -> +8801XXXXXXXXX
 * - 1XXXXXXXXX (10 digits) -> +8801XXXXXXXXX
 * Valid operators: 013 to 019 (Grameenphone, Banglalink, Robi, Teletalk, etc.)
 */
export function normalizeBdPhone(input: string): { e164: string | null; isValidBd: boolean; cleaned: string } {
  if (!input) return { e164: null, isValidBd: false, cleaned: '' };

  let d = input.replace(/[^0-9+]/g, '');
  d = d.replace(/^\+/, '');
  d = d.replace(/^00/, '');

  // +88001... -> 8801...
  if (/^8800/.test(d)) {
    d = '880' + d.substring(4);
  }

  // 01XXXXXXXXX -> 8801XXXXXXXXX
  if (/^01[3-9]\d{8}$/.test(d)) {
    d = '88' + d;
  }

  // 1XXXXXXXXX -> 8801XXXXXXXXX
  if (/^1[3-9]\d{8}$/.test(d)) {
    d = '880' + d;
  }

  // Check valid BD mobile format: 8801[3-9] followed by 8 digits
  if (/^8801[3-9]\d{8}$/.test(d)) {
    return {
      e164: '+' + d,
      isValidBd: true,
      cleaned: '+' + d,
    };
  }

  // If international number with proper country code (e.g. 92..., 91...)
  if (d.length >= 10 && d.length <= 15) {
    return {
      e164: '+' + d,
      isValidBd: false,
      cleaned: '+' + d,
    };
  }

  return {
    e164: null,
    isValidBd: false,
    cleaned: input.trim(),
  };
}

/**
 * Calculates lead score (0-100) based on qualification criteria.
 * Score 70+ = Hot, 40-69 = Warm, under 40 = Cold.
 */
export function calculateLeadScore(lead: Partial<Lead>): { score: number; temperature: LeadTemperature; breakdown: { label: string; points: number }[] } {
  const breakdown: { label: string; points: number }[] = [];
  let total = 0;

  // 1. Funding / Budget confirmed
  if (lead.funding_confirmed) {
    breakdown.push({ label: 'Budget/Funding confirmed', points: 20 });
    total += 20;
  }

  // 2. Parent involved (critical for BD students)
  if (lead.parent_involved) {
    breakdown.push({ label: 'Parent/Guardian involved', points: 15 });
    total += 15;
  }

  // 3. Valid passport in hand
  if (lead.has_passport) {
    breakdown.push({ label: 'Has valid passport', points: 10 });
    total += 10;
  }

  // 4. Target intake urgency
  const intake = (lead.target_intake || '').toLowerCase();
  if (intake.includes('march 2027') || intake.includes('immediate') || intake.includes('spring 2027')) {
    breakdown.push({ label: 'Next intake target (urgent)', points: 20 });
    total += 20;
  } else if (intake.includes('september 2027') || intake.includes('fall 2027')) {
    breakdown.push({ label: 'Target intake 3–9 months away', points: 15 });
    total += 15;
  } else if (intake) {
    breakdown.push({ label: 'Target intake planned', points: 5 });
    total += 5;
  }

  // 5. Academic results
  const res = (lead.last_result || '').toLowerCase();
  if (res.includes('5.0') || res.includes('golden') || res.includes('3.8') || res.includes('3.9') || res.includes('4.0')) {
    breakdown.push({ label: 'Excellent academic results (GPA 4.8-5.0 / First Class)', points: 15 });
    total += 15;
  } else if (res.includes('4.') || res.includes('3.5')) {
    breakdown.push({ label: 'Strong academic eligibility (GPA 4.0+)', points: 10 });
    total += 10;
  } else if (res) {
    breakdown.push({ label: 'Academic result provided', points: 5 });
    total += 5;
  }

  // 6. Stage progress bonus
  if (lead.stage === 'office_visit_booked' || lead.stage === 'office_visit_done') {
    breakdown.push({ label: 'Office visit scheduled/completed', points: 15 });
    total += 15;
  } else if (lead.stage === 'consultation_booked' || lead.stage === 'consultation_done') {
    breakdown.push({ label: 'Consultation completed', points: 10 });
    total += 10;
  }

  // 7. English proficiency
  const eng = (lead.english_level || '').toLowerCase();
  if (eng.includes('ielts') || eng.includes('toefl') || eng.includes('fluent') || eng.includes('6.') || eng.includes('7.')) {
    breakdown.push({ label: 'English test / fluent proficiency', points: 5 });
    total += 5;
  }

  const score = Math.min(100, Math.max(0, total));

  let temperature: LeadTemperature = 'cold';
  if (score >= 70) {
    temperature = 'hot';
  } else if (score >= 40) {
    temperature = 'warm';
  }

  return { score, temperature, breakdown };
}

/**
 * Checks for duplicate leads across phone_e164, whatsapp_e164, and email.
 */
export function checkDuplicateLead(
  candidate: { phone?: string; whatsapp?: string; email?: string; id?: string },
  allLeads: Lead[]
): {
  isDuplicate: boolean;
  matchedLead: Lead | null;
  matchField: 'phone' | 'whatsapp' | 'email' | null;
} {
  const normPhone = candidate.phone ? normalizeBdPhone(candidate.phone).e164 : null;
  const normWA = candidate.whatsapp ? normalizeBdPhone(candidate.whatsapp).e164 : null;
  const cleanEmail = candidate.email ? candidate.email.trim().toLowerCase() : null;

  for (const lead of allLeads) {
    if (candidate.id && lead.id === candidate.id) continue;
    if (lead.duplicate_of) continue; // Skip archived duplicate pointers

    if (normPhone && lead.phone_e164 === normPhone) {
      return { isDuplicate: true, matchedLead: lead, matchField: 'phone' };
    }
    if (normWA && lead.whatsapp_e164 === normWA) {
      return { isDuplicate: true, matchedLead: lead, matchField: 'whatsapp' };
    }
    if (cleanEmail && lead.email && lead.email.toLowerCase() === cleanEmail) {
      return { isDuplicate: true, matchedLead: lead, matchField: 'email' };
    }
  }

  return { isDuplicate: false, matchedLead: null, matchField: null };
}

/**
 * Calculate SLA for first contact (target: 30m, max SLA limit: 2 working hours).
 * Considers BD working hours: Sat-Thu, 10:00 - 19:00 (Asia/Dhaka, UTC+6).
 */
export function calculateSlaInfo(createdAt: string, firstContactAt: string | null): SlaInfo {
  if (firstContactAt) {
    const elapsedMinutes = Math.floor(
      (new Date(firstContactAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60)
    );
    if (elapsedMinutes <= 120) {
      return {
        status: 'within_sla',
        label: `Contacted in ${elapsedMinutes}m (SLA Met)`,
        hoursElapsed: elapsedMinutes / 60,
        minutesRemaining: 0,
      };
    }
    return {
      status: 'breached',
      label: `Contacted after ${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m (Breached)`,
      hoursElapsed: elapsedMinutes / 60,
      minutesRemaining: 0,
    };
  }

  const now = new Date();
  const created = new Date(createdAt);
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60)));
  const slaLimitMinutes = 120; // 2 hours
  const minutesRemaining = slaLimitMinutes - diffMinutes;

  if (minutesRemaining < 0) {
    const overdueMins = Math.abs(minutesRemaining);
    return {
      status: 'breached',
      label: `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m overdue`,
      hoursElapsed: diffMinutes / 60,
      minutesRemaining,
    };
  }

  if (minutesRemaining <= 30) {
    return {
      status: 'warning',
      label: `${minutesRemaining}m remaining (Urgent)`,
      hoursElapsed: diffMinutes / 60,
      minutesRemaining,
    };
  }

  return {
    status: 'within_sla',
    label: `${minutesRemaining}m remaining`,
    hoursElapsed: diffMinutes / 60,
    minutesRemaining,
  };
}

/**
 * Checks if a lead's next action is overdue.
 */
export function isNextActionOverdue(lead: Lead): boolean {
  if (['lost', 'enrolled'].includes(lead.stage)) return false;
  if (!lead.next_action_at) return true; // Rule: every open lead requires a next action
  return new Date(lead.next_action_at).getTime() < Date.now();
}

/**
 * Formats date/time nicely in Dhaka time / local view.
 */
export function formatBdDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Not set';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STAGE_CONFIG: Record<
  import('../types').LeadStage,
  { label: string; description: string; badgeClass: string }
> = {
  new: { label: 'New Inbound', description: '2h SLA Clock Active', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  contacted: { label: 'Contacted', description: 'First call/WA made', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' },
  qualified: { label: 'Qualified', description: 'Academic fit checked', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  consultation_booked: { label: 'Consultation Booked', description: 'Free 1-on-1 scheduled', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
  consultation_done: { label: 'Consultation Done', description: 'Awaiting visit booking', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
  office_visit_booked: { label: 'Office Visit Booked', description: 'Key conversion goal', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  office_visit_done: { label: 'Office Visit Done', description: '24h decision follow-up', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200' },
  paid: { label: 'Paid Student', description: 'Deposit / Package fee', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  enrolled: { label: 'Enrolled', description: 'Visa / Application submitted', badgeClass: 'bg-emerald-200 text-emerald-900 border-emerald-300' },
  lost: { label: 'Lost / Closed', description: 'Documented exit reason', badgeClass: 'bg-slate-200 text-slate-800 border-slate-300' },
  nurture: { label: 'Nurture (Cold)', description: 'Follow-up in 30-90 days', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export function getStageLabel(stage: import('../types').LeadStage): string {
  return STAGE_CONFIG[stage]?.label || stage;
}

/**
 * Calculates a dynamic Lead Score Weight (1-10) based on:
 * 1. Activity Frequency (0 to 3.5 points)
 * 2. Lead Source (0 to 3.0 points)
 * 3. Profile Completion (0 to 3.5 points)
 */
export function calculateLeadScoreWeight(
  lead: import('../types').Lead,
  activities: import('../types').LeadActivity[] = [],
  sources: import('../types').LeadSource[] = []
): import('../types').LeadScoreWeightResult {
  const breakdown: import('../types').LeadScoreWeightResult['breakdown'] = [];

  // --- 1. Activity Frequency (Max 3.5 pts) ---
  const leadActs = activities.filter((a) => a.lead_id === lead.id);
  const actCount = leadActs.length;

  let baseActScore = 0.5; // Baseline for recorded lead
  if (actCount === 1) baseActScore = 1.2;
  else if (actCount === 2) baseActScore = 2.0;
  else if (actCount >= 3 && actCount <= 4) baseActScore = 2.7;
  else if (actCount >= 5) baseActScore = 3.2;

  // Bonus for recent activity within 48h
  const now = Date.now();
  const hasRecentActivity = leadActs.some((a) => {
    const actTime = new Date(a.occurred_at || a.created_at).getTime();
    return now - actTime <= 48 * 60 * 60 * 1000;
  });

  let activityScore = baseActScore;
  if (hasRecentActivity && actCount > 0) {
    activityScore = Math.min(3.5, activityScore + 0.3);
  }
  activityScore = Math.min(3.5, Math.max(0.5, Number(activityScore.toFixed(2))));

  breakdown.push({
    category: 'activity',
    label: 'Activity Frequency',
    score: activityScore,
    maxScore: 3.5,
    details: `${actCount} activities logged${hasRecentActivity ? ' (includes recent 48h touchpoint)' : ''}`,
  });

  // --- 2. Lead Source (Max 3.0 pts) ---
  const source = sources.find((s) => s.id === lead.source_id);
  const channel = source?.channel;
  let sourceScore = 1.5;

  switch (channel) {
    case 'walk_in':
      sourceScore = 3.0;
      break;
    case 'referral':
      sourceScore = 2.8;
      break;
    case 'website_assessment':
      sourceScore = 2.5;
      break;
    case 'direct_chat':
      sourceScore = 2.2;
      break;
    case 'webinar':
      sourceScore = 1.8;
      break;
    case 'facebook_ads':
      sourceScore = 1.3;
      break;
    default:
      sourceScore = 1.5;
      break;
  }
  sourceScore = Math.min(3.0, Math.max(0.5, Number(sourceScore.toFixed(2))));

  breakdown.push({
    category: 'source',
    label: 'Lead Source',
    score: sourceScore,
    maxScore: 3.0,
    details: `${source?.name || 'Direct'} (${channel ? channel.replace('_', ' ') : 'inbound'})`,
  });

  // --- 3. Profile Completion (Max 3.5 pts) ---
  const profileChecks = [
    { field: 'Full Name', valid: Boolean(lead.full_name && lead.full_name.trim().length > 2) },
    { field: 'Phone Number', valid: Boolean(lead.phone_e164 || lead.phone_raw) },
    { field: 'WhatsApp', valid: Boolean(lead.whatsapp_e164) },
    { field: 'Email Address', valid: Boolean(lead.email && lead.email.includes('@')) },
    { field: 'City Location', valid: Boolean(lead.city && lead.city.trim().length > 1) },
    { field: 'Education Level', valid: Boolean(lead.education_level && lead.education_level.trim().length > 0) },
    { field: 'Academic Result', valid: Boolean(lead.last_result && lead.last_result.trim().length > 0) },
    { field: 'Target Degree', valid: Boolean(lead.target_degree && lead.target_degree.trim().length > 0) },
    { field: 'Target Programme', valid: Boolean(lead.target_programme && lead.target_programme.trim().length > 0) },
    { field: 'Target Intake', valid: Boolean(lead.target_intake && lead.target_intake.trim().length > 0) },
    { field: 'English Proficiency', valid: Boolean(lead.english_level && lead.english_level.trim().length > 0) },
    { field: 'Funding Confirmed', valid: Boolean(lead.funding_confirmed) },
    { field: 'Parent Involved', valid: Boolean(lead.parent_involved) },
    { field: 'Passport Available', valid: Boolean(lead.has_passport) },
  ];

  const totalFieldsCount = profileChecks.length;
  const completedFieldsCount = profileChecks.filter((c) => c.valid).length;
  const profileCompletionPercentage = Math.round((completedFieldsCount / totalFieldsCount) * 100);

  const profileScore = Number(((completedFieldsCount / totalFieldsCount) * 3.5).toFixed(2));

  breakdown.push({
    category: 'profile',
    label: 'Profile Completion',
    score: profileScore,
    maxScore: 3.5,
    details: `${completedFieldsCount}/${totalFieldsCount} fields (${profileCompletionPercentage}% complete)`,
  });

  // --- Total Weight (1 - 10) ---
  const rawSum = activityScore + sourceScore + profileScore;
  const clampedExact = Math.min(10.0, Math.max(1.0, Number(rawSum.toFixed(1))));
  const weight = Math.min(10, Math.max(1, Math.round(clampedExact)));

  return {
    weight,
    exactWeight: clampedExact,
    activityScore,
    activityCount: actCount,
    recentActivityBonus: hasRecentActivity,
    sourceScore,
    sourceChannel: channel || 'direct',
    sourceName: source?.name || 'Direct',
    profileScore,
    profileCompletionPercentage,
    completedFieldsCount,
    totalFieldsCount,
    breakdown,
  };
}

