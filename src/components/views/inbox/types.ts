import { Lead, LeadScoreWeightResult, SlaInfo, FollowUpTask } from '../../../types';

/** Precomputed per-lead display data — built once per render pass in
 * InboxView (single memo) instead of recomputed inside every row. */
export interface LeadRowData {
  lead: Lead;
  ownerName: string;
  ownerRole: string;
  sourceName: string;
  sla: SlaInfo;
  isOverdue: boolean;
  isDormant: boolean;
  daysDormant: number;
  weight: LeadScoreWeightResult;
  /** Earliest-due open follow-up task, for quick-complete. */
  nextOpenTask: FollowUpTask | null;
}

export type SortKey =
  | 'name'
  | 'intake'
  | 'owner'
  | 'stage'
  | 'weight'
  | 'sla'
  | 'nextAction'
  | 'created';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** Pipeline-order rank so sorting by Stage follows the funnel, not the alphabet. */
export const STAGE_SORT_ORDER: Record<string, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  consultation_booked: 3,
  consultation_done: 4,
  office_visit_booked: 5,
  office_visit_done: 6,
  paid: 7,
  enrolled: 8,
  nurture: 9,
  lost: 10,
};

export type InboxTab = 'all' | 'new' | 'hot' | 'overdue' | 'open' | 'paid';

export type Density = 'comfortable' | 'compact';

export interface InboxFilters {
  searchQuery: string;
  activeTab: InboxTab;
  filterOwner: string;
  filterSource: string;
  filterTemp: string;
  filterStage: string;
  filterWeight: string;
}

export const DEFAULT_FILTERS: InboxFilters = {
  searchQuery: '',
  activeTab: 'all',
  filterOwner: 'all',
  filterSource: 'all',
  filterTemp: 'all',
  filterStage: 'all',
  filterWeight: 'all',
};

export const STAGE_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'consultation_booked', label: 'Consultation Booked' },
  { value: 'consultation_done', label: 'Consultation Done' },
  { value: 'office_visit_booked', label: 'Visit Booked' },
  { value: 'office_visit_done', label: 'Visit Done' },
  { value: 'paid', label: 'Paid' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'lost', label: 'Lost' },
];

export const PAGE_SIZE = 30;
