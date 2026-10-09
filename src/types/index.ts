export type AppRole = 'admin' | 'manager' | 'counsellor';

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'consultation_booked'
  | 'consultation_done'
  | 'office_visit_booked'
  | 'office_visit_done'
  | 'paid'
  | 'enrolled'
  | 'lost'
  | 'nurture';

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export type ActivityType =
  | 'call'
  | 'whatsapp'
  | 'sms'
  | 'email'
  | 'meeting'
  | 'consultation'
  | 'office_visit'
  | 'note'
  | 'system';

export type ActivityOutcome =
  | 'connected'
  | 'no_answer'
  | 'busy'
  | 'switched_off'
  | 'wrong_number'
  | 'replied'
  | 'no_reply'
  | 'booked'
  | 'not_interested'
  | 'other';

export type TaskStatus = 'open' | 'done' | 'skipped' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high';

export type VisitStatus =
  | 'booked'
  | 'confirmed'
  | 'attended'
  | 'no_show'
  | 'rescheduled'
  | 'cancelled';

export interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone_e164: string;
  role: AppRole;
  is_active: boolean;
  accepts_new_leads: boolean;
  last_assigned_at: string | null;
  created_at: string;
  title: string;
}

export interface LeadSource {
  id: string;
  channel: 'website_assessment' | 'webinar' | 'facebook_ads' | 'walk_in' | 'referral' | 'direct_chat';
  name: string;
  campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  default_owner_id?: string;
  is_active: boolean;
}

export interface LostReason {
  id: number;
  code: 'no_response' | 'budget' | 'chose_competitor' | 'not_eligible' | 'timing' | 'other';
  label: string;
  requires_note: boolean;
  sort_order: number;
}

export interface Lead {
  id: string;
  full_name: string;
  phone_raw: string;
  phone_e164: string;
  whatsapp_e164: string;
  email: string;
  city: string;
  country: string;
  source_id: string;
  source_ref?: string;
  owner_id: string;
  stage: LeadStage;
  temperature: LeadTemperature;
  score: number; // 0-100
  score_weight?: number; // 1-10 dynamic weight based on activity, source, and profile completion
  education_level: string; // e.g. HSC, A-Level, Bachelor
  last_result: string; // e.g. GPA 5.00, 3.8/4.0
  target_degree: string; // e.g. MBBS, Bachelor of CSE, Master
  target_programme: string; // e.g. Clinical Medicine, Software Eng
  target_intake: string; // e.g. March 2027, September 2027
  english_level: string; // IELTS 6.5, Medium of Instruction, Basic
  funding_confirmed: boolean;
  parent_involved: boolean;
  has_passport: boolean;
  first_contact_at: string | null;
  next_action_at: string | null;
  next_action_note?: string;
  lost_reason_id?: number;
  lost_note?: string;
  nurture_until?: string;
  duplicate_of?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  employee_id: string;
  activity_type: ActivityType;
  direction?: 'outbound' | 'inbound';
  outcome?: ActivityOutcome;
  summary: string;
  next_action_at?: string;
  next_action_note?: string;
  occurred_at: string;
  created_at: string;
}

export interface FollowUpTask {
  id: string;
  lead_id: string;
  assigned_to: string;
  task_type: string;
  cadence_step?: number; // 0, 1, 3, 7, 14, 30
  due_at: string;
  status: TaskStatus;
  priority?: TaskPriority;
  completed_at?: string;
  activity_id?: string;
  title: string;
  created_at: string;
}

export interface OfficeVisit {
  id: string;
  lead_id: string;
  counsellor_id: string;
  scheduled_at: string;
  duration_min: number;
  mode: 'office' | 'video';
  attendees: string;
  status: VisitStatus;
  confirmed_at?: string;
  reminder_sent_at?: string;
  google_event_id?: string;
  outcome_note?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  lead_id: string;
  package: 'guidance' | 'complete_admission';
  payment_type: 'package_fee' | 'deposit' | 'instalment';
  amount: number;
  currency: string;
  paid_at: string;
  method: string;
  receipt_ref: string;
  recorded_by: string;
  verified_by?: string;
  verified_at?: string;
}

export interface StageHistory {
  id: string;
  lead_id: string;
  from_stage: LeadStage | null;
  to_stage: LeadStage;
  changed_by: string;
  changed_at: string;
  note?: string;
}

export interface SlaInfo {
  status: 'within_sla' | 'warning' | 'breached';
  label: string;
  hoursElapsed: number;
  minutesRemaining: number;
}

export interface AutomatedTaskSuggestion {
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadStage: LeadStage;
  counsellorId: string;
  counsellorName: string;
  lastContactedAt: string;
  daysDormant: number;
  contactSource: 'activity' | 'first_contact' | 'created';
  hasOpenTask: boolean;
  suggestedTaskType: 'call' | 'whatsapp' | 'email' | 'meeting' | 'office_visit';
  suggestedTitle: string;
  suggestedPriority: TaskPriority;
  suggestedDueAt: string;
  rationale: string;
  cadenceStep: number;
}

export interface LeadScoreWeightResult {
  weight: number; // Integer weight 1-10
  exactWeight: number; // Exact weighted decimal (1.0 - 10.0)
  activityScore: number; // Points from activity frequency (0 - 3.5)
  activityCount: number;
  recentActivityBonus: boolean;
  sourceScore: number; // Points from lead source (0 - 3.0)
  sourceChannel: string;
  sourceName: string;
  profileScore: number; // Points from profile completion (0 - 3.5)
  profileCompletionPercentage: number; // 0 - 100%
  completedFieldsCount: number;
  totalFieldsCount: number;
  breakdown: {
    category: 'activity' | 'source' | 'profile';
    label: string;
    score: number;
    maxScore: number;
    details: string;
  }[];
}

export interface CompanyProfile {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  tagline: string;
  industry: string;
  logo_icon?: string;
  accent_color: string; // 'blue' | 'indigo' | 'emerald' | 'violet' | 'rose' | 'amber'
  currency_code: string; // e.g. 'BDT', 'USD', 'EUR', 'GBP'
  currency_symbol: string; // e.g. '৳', '$', '€', '£'
  phone: string;
  email: string;
  website: string;
  office_address: string;
  google_maps_link: string;
  webinar_link: string;
  guide_link: string;
  receipt_prefix: string;
  portal_subdomain: string;
  plan_tier: 'starter' | 'professional' | 'enterprise';
  seat_count: number;
  executive_sponsor: string;
}
