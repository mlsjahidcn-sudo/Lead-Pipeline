import React, { useState } from 'react';
import { Lead, ActivityType, ActivityOutcome, LeadStage } from '../../types';
import { useCrm } from '../../context/CrmContext';
import {
  calculateSlaInfo,
  formatBdDateTime,
  isNextActionOverdue,
  getStageLabel,
} from '../../utils/crm-logic';
import {
  getLeadLastContacted,
  calculateDaysDormant,
  generateSuggestionForLead,
} from '../../utils/automated-scheduling';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  DollarSign,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  UserCheck,
  FileText,
  Filter,
  CheckSquare,
  ArrowRight,
  TrendingUp,
  Tag,
  User,
  Activity,
  PlusCircle,
  CornerDownRight,
  Gauge,
} from 'lucide-react';

interface LeadDetailModalProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onOpenBookVisit: (lead: Lead) => void;
  onOpenRecordPayment: (lead: Lead) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  leadId,
  isOpen,
  onClose,
  onOpenWhatsAppScript,
  onOpenBookVisit,
  onOpenRecordPayment,
}) => {
  const {
    leads,
    stageHistory,
    tasks,
    visits,
    payments,
    employees,
    lostReasons,
    sources,
    updateLead,
    logInteraction,
    addQuickNote,
    reassignLead,
    completeTask,
    scheduleFollowUpTask,
    currentEmployee,
    getLeadScoreWeight,
    getLeadActivities,
  } = useCrm();

  // Find target lead
  const lead = leads.find((l) => l.id === leadId);
  const leadWeightResult = lead ? getLeadScoreWeight(lead) : null;

  // Check dormancy (no engagement for >= 3 days)
  const dormancyInfo = lead
    ? getLeadLastContacted(lead, getLeadActivities(lead.id))
    : { lastContactedAt: '', contactSource: 'created' as const };
  const daysDormant = lead ? calculateDaysDormant(dormancyInfo.lastContactedAt) : 0;
  const isDormant = daysDormant >= 3 && lead && !['lost', 'enrolled'].includes(lead.stage);
  const autoSuggestion =
    isDormant && lead
      ? generateSuggestionForLead(
          lead,
          daysDormant,
          dormancyInfo.lastContactedAt,
          dormancyInfo.contactSource,
          employees.find((e) => e.id === lead.owner_id)?.full_name || 'Counsellor',
          tasks.some((t) => t.lead_id === lead.id && t.status === 'open')
        )
      : null;
  const [scheduledInModal, setScheduledInModal] = useState(false);

  // Quick Action form tabs ('interaction' | 'note' | 'status')
  const [activeFormTab, setActiveFormTab] = useState<'interaction' | 'note' | 'status'>('interaction');

  // Interaction log form state
  const [actType, setActType] = useState<ActivityType>('call');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [outcome, setOutcome] = useState<ActivityOutcome>('connected');
  const [summary, setSummary] = useState('');
  const [nextActionDate, setNextActionDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [nextActionNote, setNextActionNote] = useState('');
  const [associatedTaskId, setAssociatedTaskId] = useState<string>('');

  // Quick note state
  const [quickNoteText, setQuickNoteText] = useState('');

  // Direct status change with note
  const [targetNewStage, setTargetNewStage] = useState<LeadStage>('contacted');
  const [stageChangeNote, setStageChangeNote] = useState('');

  // Activity Feed Filter & Search state
  const [feedFilter, setFeedFilter] = useState<'all' | 'status' | 'notes' | 'interactions' | 'visits' | 'payments'>('all');
  const [feedSearch, setFeedSearch] = useState('');
  const [feedSortOrder, setFeedSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Lost modal state
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [lostReasonId, setLostReasonId] = useState(1);
  const [lostNote, setLostNote] = useState('');

  if (!isOpen || !lead) return null;

  const owner = employees.find((e) => e.id === lead.owner_id);
  const source = sources.find((s) => s.id === lead.source_id);
  const sla = calculateSlaInfo(lead.created_at, lead.first_contact_at);
  const isOverdue = isNextActionOverdue(lead);

  // Lead child records
  const leadActivities = getLeadActivities(lead.id);
  const leadHistory = stageHistory.filter((h) => h.lead_id === lead.id);
  const leadTasks = tasks.filter((t) => t.lead_id === lead.id);
  const leadVisits = visits.filter((v) => v.lead_id === lead.id);
  const leadPayments = payments.filter((p) => p.lead_id === lead.id);

  // Uncompleted tasks for linking in interaction log
  const openTasks = leadTasks.filter((t) => t.status === 'open');

  // Unified Timeline Item Type
  type TimelineItem =
    | {
        type: 'activity';
        subType: 'interaction' | 'note';
        data: typeof leadActivities[0];
        timestamp: string;
      }
    | {
        type: 'history';
        data: typeof leadHistory[0];
        timestamp: string;
      }
    | {
        type: 'visit';
        data: typeof leadVisits[0];
        timestamp: string;
      }
    | {
        type: 'payment';
        data: typeof leadPayments[0];
        timestamp: string;
      }
    | {
        type: 'task';
        data: typeof leadTasks[0];
        timestamp: string;
      };

  // Build unified chronological activity feed
  const allTimelineItems: TimelineItem[] = [
    ...leadActivities.map((a) => ({
      type: 'activity' as const,
      subType: (a.activity_type === 'note' ? 'note' : 'interaction') as 'interaction' | 'note',
      data: a,
      timestamp: a.occurred_at || a.created_at,
    })),
    ...leadHistory.map((h) => ({
      type: 'history' as const,
      data: h,
      timestamp: h.changed_at,
    })),
    ...leadVisits.map((v) => ({
      type: 'visit' as const,
      data: v,
      timestamp: v.scheduled_at,
    })),
    ...leadPayments.map((p) => ({
      type: 'payment' as const,
      data: p,
      timestamp: p.paid_at,
    })),
    ...leadTasks
      .filter((t) => t.status === 'done' && t.completed_at)
      .map((t) => ({
        type: 'task' as const,
        data: t,
        timestamp: t.completed_at!,
      })),
  ].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return feedSortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  // Filter timeline items according to feedFilter
  const filteredTimelineItems = allTimelineItems.filter((item) => {
    // Category filter
    if (feedFilter === 'status' && item.type !== 'history') return false;
    if (feedFilter === 'notes') {
      if (item.type !== 'activity' || item.subType !== 'note') return false;
    }
    if (feedFilter === 'interactions') {
      if (item.type !== 'activity' || item.subType !== 'interaction') return false;
    }
    if (feedFilter === 'visits' && item.type !== 'visit') return false;
    if (feedFilter === 'payments' && item.type !== 'payment') return false;

    // Search query filter
    if (feedSearch.trim()) {
      const q = feedSearch.toLowerCase().trim();
      if (item.type === 'activity') {
        const text = `${item.data.summary} ${item.data.activity_type} ${item.data.outcome || ''} ${item.data.next_action_note || ''}`.toLowerCase();
        return text.includes(q);
      }
      if (item.type === 'history') {
        const text = `${item.data.from_stage || ''} ${item.data.to_stage} ${item.data.note || ''}`.toLowerCase();
        return text.includes(q);
      }
      if (item.type === 'visit') {
        const text = `${item.data.mode} ${item.data.attendees} ${item.data.status} ${item.data.outcome_note || ''}`.toLowerCase();
        return text.includes(q);
      }
      if (item.type === 'payment') {
        const text = `${item.data.package} ${item.data.amount} ${item.data.receipt_ref} ${item.data.method}`.toLowerCase();
        return text.includes(q);
      }
      if (item.type === 'task') {
        const text = `${item.data.title} ${item.data.task_type}`.toLowerCase();
        return text.includes(q);
      }
    }

    return true;
  });

  // Count metrics for quick filter tabs
  const countHistory = leadHistory.length;
  const countNotes = leadActivities.filter((a) => a.activity_type === 'note').length;
  const countInteractions = leadActivities.filter((a) => a.activity_type !== 'note').length;
  const countVisits = leadVisits.length;
  const countPayments = leadPayments.length;

  const handleStageChange = (newStage: LeadStage, customNote?: string) => {
    if (newStage === 'lost') {
      setShowLostDialog(true);
      return;
    }
    if (newStage === 'office_visit_booked') {
      onOpenBookVisit(lead);
      return;
    }
    if (newStage === 'paid') {
      onOpenRecordPayment(lead);
      return;
    }
    updateLead(lead.id, { stage: newStage }, customNote);
  };

  const handleConfirmLost = (e: React.FormEvent) => {
    e.preventDefault();
    updateLead(
      lead.id,
      {
        stage: 'lost',
        lost_reason_id: lostReasonId,
        lost_note: lostNote,
        next_action_at: null,
      },
      `Marked Lost: ${lostReasons.find((r) => r.id === lostReasonId)?.label}${lostNote ? ` - "${lostNote}"` : ''}`
    );
    setShowLostDialog(false);
  };

  const handleLogInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    logInteraction({
      leadId: lead.id,
      activityType: actType,
      direction,
      outcome,
      summary: summary.trim(),
      nextActionAt: new Date(nextActionDate).toISOString(),
      nextActionNote: nextActionNote.trim() || undefined,
      taskIdToComplete: associatedTaskId || undefined,
    });

    setSummary('');
    setNextActionNote('');
    setAssociatedTaskId('');
  };

  const handleAddQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteText.trim()) return;

    addQuickNote(lead.id, quickNoteText.trim());
    setQuickNoteText('');
  };

  const handleDirectStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleStageChange(targetNewStage, stageChangeNote.trim() || undefined);
    setStageChangeNote('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{lead.full_name}</h2>
                {/* Temperature label */}
                <span
                  className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-sm ${
                    lead.temperature === 'hot'
                      ? 'bg-rose-100 text-rose-800'
                      : lead.temperature === 'warm'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {lead.temperature}
                </span>
                {leadWeightResult && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border tabular-nums ${
                      leadWeightResult.weight >= 8
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : leadWeightResult.weight >= 5
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title={`Score Weight: ${leadWeightResult.weight}/10\n• Activity Frequency: ${leadWeightResult.activityScore}/3.5\n• Lead Source: ${leadWeightResult.sourceScore}/3.0\n• Profile Completion: ${leadWeightResult.profileScore}/3.5`}
                  >
                    <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Weight {leadWeightResult.weight}/10</span>
                  </span>
                )}
                <span className="text-xs font-mono tabular-nums text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Score {lead.score}/100
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{lead.city}</span>
                <span>·</span>
                <span>Source: {source?.name || 'Direct'}</span>
                <span>·</span>
                <span className="font-mono text-[11px]">ID: {lead.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stage Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium">Stage:</span>
              <select
                value={lead.stage}
                onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="consultation_booked">Consultation Booked</option>
                <option value="consultation_done">Consultation Done</option>
                <option value="office_visit_booked">Office Visit Booked</option>
                <option value="office_visit_done">Office Visit Done</option>
                <option value="paid">Paid</option>
                <option value="enrolled">Enrolled</option>
                <option value="nurture">Nurture</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: Student Profile & Qualification (5 cols) */}
          <div className="lg:col-span-5 p-5 space-y-4 bg-white overflow-y-auto max-h-[calc(94vh-65px)]">
            {/* Quick Action Bar (Click-to-Call, WhatsApp, Email, Book Visit) */}
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`tel:${lead.phone_e164}`}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call ({lead.phone_e164 ? lead.phone_e164.slice(-4) : 'Tel'})</span>
              </a>

              <button
                type="button"
                onClick={() => onOpenWhatsAppScript(lead)}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenBookVisit(lead)}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Book Visit</span>
              </button>
            </div>

            {/* Automated Cadence Follow-up Suggestion (for leads dormant 3+ days) */}
            {isDormant && autoSuggestion && (
              <div className="p-3 bg-linear-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-lg space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    No Engagement in {Math.floor(daysDormant)} Days
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Last: {formatBdDateTime(dormancyInfo.lastContactedAt)}
                  </span>
                </div>

                <div className="p-2.5 bg-white/90 rounded border border-rose-200/80 text-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Suggested Follow-up Task:
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                      {autoSuggestion.suggestedPriority}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    {autoSuggestion.suggestedTitle}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    💡 {autoSuggestion.rationale}
                  </p>
                </div>

                {scheduledInModal ? (
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded font-semibold text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Follow-up task scheduled and added to timeline!</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleFollowUpTask({
                        leadId: lead.id,
                        assignedTo: lead.owner_id,
                        taskType: autoSuggestion.suggestedTaskType,
                        title: autoSuggestion.suggestedTitle,
                        dueAt: autoSuggestion.suggestedDueAt,
                        priority: autoSuggestion.suggestedPriority,
                        cadenceStep: autoSuggestion.cadenceStep,
                      });
                      setScheduledInModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-bold shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Auto-Schedule Suggested Task</span>
                  </button>
                )}
              </div>
            )}

            {/* SLA & Next Action Alert Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">First Contact SLA:</span>
                <span
                  className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                    sla.status === 'within_sla'
                      ? 'bg-emerald-100 text-emerald-800'
                      : sla.status === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {sla.label}
                </span>
              </div>

              <div className="flex items-start justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Next Action Due:</span>
                <div className="text-right">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      isOverdue ? 'text-rose-600 flex items-center gap-1 justify-end' : 'text-slate-800'
                    }`}
                  >
                    {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                    {formatBdDateTime(lead.next_action_at)}
                  </span>
                  {lead.next_action_note && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic">
                      "{lead.next_action_note}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Ownership & Reassignment */}
            <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 font-medium block">Assigned Counsellor:</span>
                <span className="font-semibold text-slate-900">{owner?.full_name || 'Unassigned'}</span>
              </div>

              {(currentEmployee.role === 'admin' || currentEmployee.role === 'manager') && (
                <select
                  value={lead.owner_id}
                  onChange={(e) => {
                    if (e.target.value === lead.owner_id) return;
                    reassignLead(lead.id, e.target.value);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded px-2 py-1 font-medium cursor-pointer"
                >
                  <option value={lead.owner_id}>
                    {owner?.full_name ?? 'Unassigned'} (current)
                  </option>
                  {employees
                    .filter((e) => e.role === 'counsellor' && e.id !== lead.owner_id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        Reassign to {e.full_name}
                      </option>
                    ))}
                </select>
              )}
            </div>

            {/* Lead Scoring Weight (1-10) Algorithm Breakdown */}
            {leadWeightResult && (
              <div className="p-3.5 bg-linear-to-br from-indigo-50/60 to-slate-50 border border-indigo-100 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Lead Scoring Algorithm
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-extrabold border tabular-nums ${
                      leadWeightResult.weight >= 8
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : leadWeightResult.weight >= 5
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    Weight: {leadWeightResult.weight} / 10
                  </span>
                </div>

                <p className="text-[11px] text-slate-600">
                  Dynamic weight calculated across activity frequency, lead acquisition source, and student profile completion.
                </p>

                <div className="space-y-2 text-xs">
                  {/* Factor 1: Activity Frequency */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 font-medium">Activity Frequency:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {leadWeightResult.activityScore} / 3.5 pts ({leadWeightResult.activityCount} acts)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all"
                        style={{ width: `${(leadWeightResult.activityScore / 3.5) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Factor 2: Lead Source */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 font-medium">Lead Source:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {leadWeightResult.sourceScore} / 3.0 pts ({leadWeightResult.sourceName})
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${(leadWeightResult.sourceScore / 3.0) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Factor 3: Profile Completion */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 font-medium">Profile Completion:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {leadWeightResult.profileScore} / 3.5 pts ({leadWeightResult.profileCompletionPercentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${(leadWeightResult.profileScore / 3.5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Target Studies in China */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Target Study Program
              </h3>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Degree:</span>
                  <span className="font-semibold text-slate-800">{lead.target_degree}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Programme:</span>
                  <span className="font-medium text-slate-800">{lead.target_programme}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Intake:</span>
                  <span className="font-semibold text-blue-700">{lead.target_intake}</span>
                </div>
              </div>
            </div>

            {/* Academic Qualification & Signals */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Qualification & Fit
              </h3>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Education:</span>
                  <span className="font-medium text-slate-800">{lead.education_level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Result / GPA:</span>
                  <span className="font-mono font-semibold text-slate-900">{lead.last_result}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">English:</span>
                  <span className="font-medium text-slate-800">{lead.english_level}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-[11px]">
                  <div className={`p-1.5 rounded text-center ${lead.funding_confirmed ? 'bg-emerald-50 text-emerald-800 font-medium' : 'bg-slate-100 text-slate-400'}`}>
                    Budget: {lead.funding_confirmed ? 'Ready' : 'Unclear'}
                  </div>
                  <div className={`p-1.5 rounded text-center ${lead.parent_involved ? 'bg-emerald-50 text-emerald-800 font-medium' : 'bg-slate-100 text-slate-400'}`}>
                    Parents: {lead.parent_involved ? 'Yes' : 'No'}
                  </div>
                  <div className={`p-1.5 rounded text-center ${lead.has_passport ? 'bg-emerald-50 text-emerald-800 font-medium' : 'bg-slate-100 text-slate-400'}`}>
                    Passport: {lead.has_passport ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>

            {/* Payments / Conversion Button */}
            {lead.stage !== 'paid' && lead.stage !== 'enrolled' ? (
              <button
                type="button"
                onClick={() => onOpenRecordPayment(lead)}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Record Deposit / Complete Package Payment</span>
              </button>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Student Paid & Confirmed</span>
                </div>
                {leadPayments.length > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-emerald-800">
                    Total Paid: {leadPayments.reduce((acc, p) => acc + p.amount, 0).toLocaleString()} BDT
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Real-Time Activity Feed & Quick Actions (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full bg-slate-50/50 max-h-[calc(94vh-65px)] overflow-hidden">
            {/* Action Composer Header Tabs (Interaction vs Note vs Status Change) */}
            <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Real-Time Activity Engine
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {allTimelineItems.length} total events logged
                </span>
              </div>

              {/* Composer Mode Tabs */}
              <div className="flex gap-1 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveFormTab('interaction')}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeFormTab === 'interaction'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Log Interaction & SLA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('note')}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeFormTab === 'note'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Add Internal Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('status')}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeFormTab === 'status'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Change Status with Reason</span>
                </button>
              </div>
            </div>

            {/* Composer Box */}
            <div className="p-3.5 bg-white border-b border-slate-200 shadow-2xs">
              {activeFormTab === 'interaction' && (
                <form onSubmit={handleLogInteraction} className="space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Type
                      </label>
                      <select
                        value={actType}
                        onChange={(e) => setActType(e.target.value as ActivityType)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                      >
                        <option value="call">Phone Call</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="meeting">Consultation</option>
                        <option value="office_visit">Office Visit</option>
                        <option value="sms">SMS</option>
                        <option value="email">Email</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Direction
                      </label>
                      <select
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound')}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                      >
                        <option value="outbound">Outbound</option>
                        <option value="inbound">Inbound</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Outcome *
                      </label>
                      <select
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value as ActivityOutcome)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-medium"
                      >
                        <option value="connected">Connected & Discussed</option>
                        <option value="no_answer">No Answer / Missed Call</option>
                        <option value="busy">Line Busy</option>
                        <option value="switched_off">Switched Off</option>
                        <option value="replied">Replied on WhatsApp</option>
                        <option value="no_reply">No Reply</option>
                        <option value="booked">Office Visit Booked</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <textarea
                      required
                      rows={2}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Summary of conversation, questions asked, next steps..."
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden bg-white"
                    />
                  </div>

                  {/* Optional: Complete an open task alongside this interaction */}
                  {openTasks.length > 0 && (
                    <div className="flex items-center gap-2 p-1.5 bg-amber-50/60 border border-amber-200 rounded text-xs text-amber-900">
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-[11px] font-medium">Link & complete task:</span>
                      <select
                        value={associatedTaskId}
                        onChange={(e) => setAssociatedTaskId(e.target.value)}
                        className="text-xs bg-white border border-amber-300 rounded px-1.5 py-0.5 flex-1"
                      >
                        <option value="">None (Log interaction only)</option>
                        {openTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mandatory Next Action inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-blue-50/50 p-2 rounded-md border border-blue-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-blue-900 mb-0.5">
                        Next Action Due Date *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={nextActionDate}
                        onChange={(e) => setNextActionDate(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-blue-200 rounded bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-blue-900 mb-0.5">
                        Next Action Note *
                      </label>
                      <input
                        type="text"
                        required
                        value={nextActionNote}
                        onChange={(e) => setNextActionNote(e.target.value)}
                        placeholder="e.g. Call back after father gets home"
                        className="w-full text-xs px-2 py-1 border border-blue-200 rounded bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Save Interaction</span>
                    </button>
                  </div>
                </form>
              )}

              {activeFormTab === 'note' && (
                <form onSubmit={handleAddQuickNote} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Internal Note for Team Members & Counsellor Audit</span>
                    <span className="text-[11px] font-mono">Visible to all counsellors</span>
                  </div>
                  <textarea
                    required
                    rows={2}
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder="Write private internal note (e.g., student wants full tuition scholarship, uncle is sponsoring...)"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Post Note to Feed</span>
                    </button>
                  </div>
                </form>
              )}

              {activeFormTab === 'status' && (
                <form onSubmit={handleDirectStageSubmit} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        New Pipeline Stage
                      </label>
                      <select
                        value={targetNewStage}
                        onChange={(e) => setTargetNewStage(e.target.value as LeadStage)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-semibold"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="consultation_booked">Consultation Booked</option>
                        <option value="consultation_done">Consultation Done</option>
                        <option value="office_visit_booked">Office Visit Booked</option>
                        <option value="office_visit_done">Office Visit Done</option>
                        <option value="paid">Paid</option>
                        <option value="enrolled">Enrolled</option>
                        <option value="nurture">Nurture</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Reason / Note for Stage Change
                      </label>
                      <input
                        type="text"
                        value={stageChangeNote}
                        onChange={(e) => setStageChangeNote(e.target.value)}
                        placeholder="e.g. Student submitted IELTS certificate"
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Update Stage & Record History</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Filter & Search Bar for Activity Feed */}
            <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFeedFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    feedFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All ({allTimelineItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('status')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    feedFilter === 'status'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Status Changes ({countHistory})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('notes')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    feedFilter === 'notes'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Notes ({countNotes})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('interactions')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    feedFilter === 'interactions'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Interactions ({countInteractions})
                </button>
                {countVisits > 0 && (
                  <button
                    type="button"
                    onClick={() => setFeedFilter('visits')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      feedFilter === 'visits'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    Visits ({countVisits})
                  </button>
                )}
                {countPayments > 0 && (
                  <button
                    type="button"
                    onClick={() => setFeedFilter('payments')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      feedFilter === 'payments'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    Payments ({countPayments})
                  </button>
                )}
              </div>

              {/* Search & Sort controls */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter feed..."
                  value={feedSearch}
                  onChange={(e) => setFeedSearch(e.target.value)}
                  className="text-xs px-2 py-0.5 border border-slate-300 rounded bg-white w-28 sm:w-36 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setFeedSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded"
                  title="Toggle Chronological Order"
                >
                  {feedSortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
                </button>
              </div>
            </div>

            {/* Chronological Activity Feed Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {filteredTimelineItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                  {feedSearch || feedFilter !== 'all'
                    ? 'No activity records match your filter criteria.'
                    : 'No interactions recorded yet. Log your first call or note above!'}
                </div>
              ) : (
                <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {filteredTimelineItems.map((item, idx) => {
                    // Item 1: Lead Activities (Calls, WhatsApp, Meetings, or Notes)
                    if (item.type === 'activity') {
                      const act = item.data;
                      const author = employees.find((e) => e.id === act.employee_id);
                      const isNote = act.activity_type === 'note';

                      return (
                        <div key={`act-${act.id}-${idx}`} className="relative group">
                          {/* Timeline dot icon */}
                          <div
                            className={`absolute -left-6 top-2 w-5 h-5 rounded-full flex items-center justify-center text-white ring-4 ring-slate-50 ${
                              isNote
                                ? 'bg-amber-500'
                                : act.activity_type === 'call'
                                ? 'bg-blue-600'
                                : act.activity_type === 'whatsapp'
                                ? 'bg-emerald-500'
                                : 'bg-indigo-600'
                            }`}
                          >
                            {isNote ? (
                              <FileText className="w-2.5 h-2.5" />
                            ) : act.activity_type === 'call' ? (
                              <Phone className="w-2.5 h-2.5" />
                            ) : (
                              <MessageSquare className="w-2.5 h-2.5" />
                            )}
                          </div>

                          <div
                            className={`p-3 rounded-lg text-xs space-y-1.5 shadow-2xs border ${
                              isNote
                                ? 'bg-amber-50/70 border-amber-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold capitalize ${isNote ? 'text-amber-900' : 'text-slate-900'}`}>
                                  {isNote ? 'Internal Note' : act.activity_type}
                                </span>
                                {act.outcome && (
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    ({act.outcome.replace('_', ' ')})
                                  </span>
                                )}
                                {act.direction && (
                                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                    {act.direction}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {formatBdDateTime(act.occurred_at || act.created_at)}
                              </span>
                            </div>

                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{act.summary}</p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>Logged by: {author?.full_name || 'System'}</span>
                              </span>
                              {act.next_action_at && (
                                <span className="font-mono text-slate-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Next: {formatBdDateTime(act.next_action_at)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Item 2: Stage / Pipeline Status Changes
                    if (item.type === 'history') {
                      const hist = item.data;
                      const author = employees.find((e) => e.id === hist.changed_by);
                      const fromLabel = hist.from_stage ? getStageLabel(hist.from_stage) : 'New Entry';
                      const toLabel = getStageLabel(hist.to_stage);

                      return (
                        <div key={`hist-${hist.id}-${idx}`} className="relative group">
                          {/* Timeline dot */}
                          <div className="absolute -left-6 top-2 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white ring-4 ring-slate-50">
                            <History className="w-2.5 h-2.5" />
                          </div>

                          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg text-xs space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
                                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Pipeline Status Change</span>
                              </div>
                              <span className="text-[11px] text-indigo-700 font-mono">
                                {formatBdDateTime(hist.changed_at)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-0.5 text-slate-800">
                              <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-slate-600 font-medium text-[11px]">
                                {fromLabel}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold text-[11px]">
                                {toLabel}
                              </span>
                            </div>

                            {hist.note && (
                              <p className="text-slate-700 text-[11px] italic pt-0.5">
                                "{hist.note}"
                              </p>
                            )}

                            <div className="pt-1 text-[10px] text-indigo-600">
                              Updated by: {author?.full_name || hist.changed_by || 'System automation'}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Item 3: Scheduled / Attended Office Visits
                    if (item.type === 'visit') {
                      const vis = item.data;
                      const counsellor = employees.find((e) => e.id === vis.counsellor_id);

                      return (
                        <div key={`vis-${vis.id}-${idx}`} className="relative group">
                          {/* Timeline dot */}
                          <div className="absolute -left-6 top-2 w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white ring-4 ring-slate-50">
                            <Calendar className="w-2.5 h-2.5" />
                          </div>

                          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-xs space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between font-semibold text-purple-950">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                <span>
                                  {vis.mode === 'office' ? 'Office Visit' : 'Video Consultation'}: {vis.status.toUpperCase()}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-purple-700">
                                {formatBdDateTime(vis.scheduled_at)}
                              </span>
                            </div>

                            <p className="text-purple-900 text-[11px]">
                              Attendees: {vis.attendees} · Counsellor: {counsellor?.full_name || 'Assigned Staff'} ({vis.duration_min} mins)
                            </p>

                            {vis.outcome_note && (
                              <p className="text-slate-700 text-[11px] bg-white p-1.5 rounded border border-purple-100">
                                Note: {vis.outcome_note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Item 4: Payments Recorded
                    if (item.type === 'payment') {
                      const pay = item.data;
                      const recorder = employees.find((e) => e.id === pay.recorded_by);

                      return (
                        <div key={`pay-${pay.id}-${idx}`} className="relative group">
                          {/* Timeline dot */}
                          <div className="absolute -left-6 top-2 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white ring-4 ring-slate-50">
                            <DollarSign className="w-2.5 h-2.5" />
                          </div>

                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between font-semibold text-emerald-950">
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Payment Confirmed: {pay.amount.toLocaleString()} BDT</span>
                              </div>
                              <span className="font-mono text-[11px] text-emerald-800">
                                {formatBdDateTime(pay.paid_at)}
                              </span>
                            </div>
                            <p className="text-emerald-800 text-[11px]">
                              Package: {pay.package.replace('_', ' ')} · Ref: {pay.receipt_ref} · Method: {pay.method}
                            </p>
                            <div className="text-[10px] text-emerald-700">
                              Recorded by: {recorder?.full_name || 'Accounts Staff'}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Item 5: Completed Task
                    if (item.type === 'task') {
                      const t = item.data;
                      return (
                        <div key={`task-${t.id}-${idx}`} className="relative group">
                          {/* Timeline dot */}
                          <div className="absolute -left-6 top-2 w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center text-white ring-4 ring-slate-50">
                            <CheckSquare className="w-2.5 h-2.5" />
                          </div>

                          <div className="p-2.5 bg-teal-50/70 border border-teal-200 rounded-lg text-xs flex items-center justify-between shadow-2xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                              <span className="text-teal-950 font-medium">
                                Task marked complete: <strong>{t.title}</strong>
                              </span>
                            </div>
                            <span className="text-[11px] text-teal-700 font-mono">
                              {formatBdDateTime(t.completed_at)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Mark Lost Reason Prompt */}
        {showLostDialog && (
          <div className="fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-xl space-y-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Mark Lead as Lost (Exit Criteria Required)
              </h3>
              <p className="text-xs text-slate-600">
                Please select the primary reason why this lead did not convert. Jahid reviews all lost leads in the daily audit.
              </p>

              <form onSubmit={handleConfirmLost} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lost Reason *
                  </label>
                  <select
                    value={lostReasonId}
                    onChange={(e) => setLostReasonId(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                  >
                    {lostReasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Counsellor Explanation Note
                  </label>
                  <textarea
                    rows={2}
                    value={lostNote}
                    onChange={(e) => setLostNote(e.target.value)}
                    placeholder="Specific student feedback..."
                    className="w-full text-xs p-2 border border-slate-200 rounded-md"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLostDialog(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
                  >
                    Confirm Lost
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
