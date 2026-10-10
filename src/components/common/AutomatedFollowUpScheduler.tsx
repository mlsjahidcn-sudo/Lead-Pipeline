import React, { useState, useMemo, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, AutomatedTaskSuggestion, TaskPriority } from '../../types';
import { findDormantLeadsNeedingFollowUp } from '../../utils/automated-scheduling';
import { formatBdDateTime } from '../../utils/crm-logic';
import {
  Sparkles,
  Clock,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  AlertTriangle,
  Flame,
  AlertCircle,
  Flag,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  User,
  Filter,
  ArrowRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface AutomatedFollowUpSchedulerProps {
  onSelectLead?: (lead: Lead) => void;
  isOpenModal?: boolean;
  onCloseModal?: () => void;
  isEmbeddedCard?: boolean;
}

export const AutomatedFollowUpScheduler: React.FC<AutomatedFollowUpSchedulerProps> = ({
  onSelectLead,
  isOpenModal = false,
  onCloseModal,
  isEmbeddedCard = false,
}) => {
  const {
    leads,
    activities,
    tasks,
    employees,
    currentEmployee,
    scheduleFollowUpTask,
    batchScheduleFollowUpTasks,
  } = useCrm();

  const [thresholdDays, setThresholdDays] = useState<number>(3);
  const [filterCounsellor, setFilterCounsellor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideLeadsWithOpenTasks, setHideLeadsWithOpenTasks] = useState<boolean>(false);
  const [scheduledLeadIds, setScheduledLeadIds] = useState<Set<string>>(new Set());
  const [justScheduledCount, setJustScheduledCount] = useState<number | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Performance: turn O(N) leads.find() calls inside the render into O(1) lookups
  const leadById = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  // Reset internal state on close (matches ImportLeadsModal's pattern) so
  // reopening shows a clean slate: no leftover custom form values, no
  // leftover "scheduled" hides, no expanded edits.
  useEffect(() => {
    if (!isOpenModal && !isExpanded) {
      setEditingLeadId(null);
      setCustomTitle('');
      setCustomType('call');
      setCustomPriority('medium');
      setCustomDueTime('');
      setHideLeadsWithOpenTasks(false);
    }
  }, [isOpenModal]);

  // Escape-to-close (only when modal mode, not embedded card)
  useEffect(() => {
    if (!isOpenModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseModal) onCloseModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpenModal, onCloseModal]);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!isOpenModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpenModal]);

  // Form states for inline customization
  const [customTitle, setCustomTitle] = useState('');
  const [customType, setCustomType] = useState<string>('call');
  const [customPriority, setCustomPriority] = useState<TaskPriority>('medium');
  const [customDueTime, setCustomDueTime] = useState<string>('');

  // Find all dormant leads needing follow-up based on threshold
  const allSuggestions = useMemo(() => {
    return findDormantLeadsNeedingFollowUp(leads, activities, tasks, employees, thresholdDays);
  }, [leads, activities, tasks, employees, thresholdDays]);

  // Filter based on user selection
  const filteredSuggestions = useMemo(() => {
    return allSuggestions.filter((sug) => {
      // Exclude already scheduled during this session
      if (scheduledLeadIds.has(sug.leadId)) return false;

      // Filter: hide leads that already have an open task when the user opts in
      if (hideLeadsWithOpenTasks && sug.hasOpenTask) return false;

      // Filter by counsellor
      if (filterCounsellor !== 'all' && sug.counsellorId !== filterCounsellor) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = sug.leadName.toLowerCase().includes(q);
        const matchesPhone = sug.leadPhone.toLowerCase().includes(q);
        const matchesTitle = sug.suggestedTitle.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesTitle) return false;
      }

      return true;
    });
  }, [allSuggestions, filterCounsellor, searchQuery, hideLeadsWithOpenTasks, scheduledLeadIds]);

  // Counts
  const leadsWithoutOpenTasks = filteredSuggestions.filter((s) => !s.hasOpenTask);
  const highPriorityCount = filteredSuggestions.filter((s) => s.suggestedPriority === 'high').length;

  // Excluded-by-session counter: how many leads are hidden because the user
  // already scheduled them this session. Surfaced in the filter strip so the
  // user can see the funnel.
  const excludedCount = useMemo(() => {
    let n = 0;
    for (const sug of allSuggestions) {
      if (scheduledLeadIds.has(sug.leadId)) n++;
    }
    return n;
  }, [allSuggestions, scheduledLeadIds]);

  // Handle single task schedule
  const handleScheduleSingle = (sug: AutomatedTaskSuggestion) => {
    const title = editingLeadId === sug.leadId && customTitle ? customTitle : sug.suggestedTitle;
    const taskType = editingLeadId === sug.leadId ? customType : sug.suggestedTaskType;
    const priority = editingLeadId === sug.leadId ? customPriority : sug.suggestedPriority;
    const dueAt = editingLeadId === sug.leadId && customDueTime ? customDueTime : sug.suggestedDueAt;

    scheduleFollowUpTask({
      leadId: sug.leadId,
      assignedTo: sug.counsellorId,
      taskType,
      title,
      dueAt,
      priority,
      cadenceStep: sug.cadenceStep,
    });

    setScheduledLeadIds((prev) => new Set([...prev, sug.leadId]));
    setEditingLeadId(null);
    setJustScheduledCount(1);
    setTimeout(() => setJustScheduledCount(null), 4000);
  };

  // Handle batch schedule all
  const handleScheduleAll = () => {
    if (filteredSuggestions.length === 0) return;

    const payload = filteredSuggestions.map((sug) => ({
      leadId: sug.leadId,
      assignedTo: sug.counsellorId,
      taskType: sug.suggestedTaskType,
      title: sug.suggestedTitle,
      dueAt: sug.suggestedDueAt,
      priority: sug.suggestedPriority,
      cadenceStep: sug.cadenceStep,
    }));

    const count = batchScheduleFollowUpTasks(payload);
    const newIds = new Set(scheduledLeadIds);
    filteredSuggestions.forEach((s) => newIds.add(s.leadId));
    setScheduledLeadIds(newIds);
    setJustScheduledCount(count);
    setTimeout(() => setJustScheduledCount(null), 5000);
  };

  const startEditing = (sug: AutomatedTaskSuggestion) => {
    setEditingLeadId(sug.leadId);
    setCustomTitle(sug.suggestedTitle);
    setCustomType(sug.suggestedTaskType);
    setCustomPriority(sug.suggestedPriority);
    setCustomDueTime(sug.suggestedDueAt);
  };

  // Channel icon helper
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="w-3.5 h-3.5 text-blue-600" />;
      case 'whatsapp':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-indigo-600" />;
      case 'office_visit':
      case 'meeting':
        return <Calendar className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  // Priority badge helper
  const renderPriorityBadge = (priority: TaskPriority) => {
    if (priority === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <Flame className="w-3 h-3 text-rose-600" />
          High
        </span>
      );
    }
    if (priority === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <Flag className="w-3 h-3 text-slate-400" />
        Low
      </span>
    );
  };

  // Content body
  const content = (
    <div className="space-y-4">
      {/* Success alert toast */}
      {justScheduledCount !== null && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Successfully scheduled <strong>{justScheduledCount}</strong> follow-up task
              {justScheduledCount > 1 ? 's' : ''}! Added to Today's Tasks queue.
            </span>
          </div>
          <button
            onClick={() => setJustScheduledCount(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control & Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Cadence Rule:
          </span>

          {/* Threshold Pills */}
          <div className="inline-flex rounded-md shadow-2xs">
            <button
              onClick={() => setThresholdDays(3)}
              className={`px-2.5 py-1 text-xs font-medium rounded-l-md border ${
                thresholdDays === 3
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              3+ Days Dormant
            </button>
            <button
              onClick={() => setThresholdDays(5)}
              className={`px-2.5 py-1 text-xs font-medium border-t border-b ${
                thresholdDays === 5
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              5+ Days
            </button>
            <button
              onClick={() => setThresholdDays(7)}
              className={`px-2.5 py-1 text-xs font-medium rounded-r-md border ${
                thresholdDays === 7
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              7+ Days (Critical)
            </button>
          </div>

          {/* Counsellor Filter */}
          <select
            value={filterCounsellor}
            onChange={(e) => setFilterCounsellor(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Counsellors ({allSuggestions.length})</option>
            {employees.map((emp) => {
              const count = allSuggestions.filter((s) => s.counsellorId === emp.id).length;
              return (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({count})
                </option>
              );
            })}
          </select>

          {/* Hide leads with open tasks */}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideLeadsWithOpenTasks}
              onChange={(e) => setHideLeadsWithOpenTasks(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Hide leads with open tasks</span>
          </label>
        </div>

        {/* Batch action button + excluded count */}
        <div className="flex items-center gap-2">
          {excludedCount > 0 && (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500"
              title={`${excludedCount} lead(s) are hidden because you scheduled them in this session`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {excludedCount} already scheduled
            </span>
          )}
          {filteredSuggestions.length > 0 && (
            <button
              onClick={handleScheduleAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md shadow-xs transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-Schedule All ({filteredSuggestions.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Suggestion Cards List */}
      {filteredSuggestions.length === 0 ? (
        <div className="py-8 px-4 text-center bg-white rounded-lg border border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800">Pipeline is Active & Healthy</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No active leads found that have been without engagement for {thresholdDays} or more days.
            All leads are either engaged, scheduled, or recently touched!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuggestions.map((sug) => {
            const isEditing = editingLeadId === sug.leadId;
            const targetLead = leadById.get(sug.leadId);
            const daysRounded = Math.floor(sug.daysDormant);

            return (
              <div
                key={sug.leadId}
                className={`bg-white rounded-xl border p-4 shadow-2xs transition-all ${
                  sug.suggestedPriority === 'high'
                    ? 'border-rose-200 hover:border-rose-300 ring-1 ring-rose-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Lead & Dormancy Context */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {/* Dormancy Warning Pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        No contact in {daysRounded} days
                      </span>

                      {/* Stage Pill */}
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase tracking-wider">
                        Stage: {sug.leadStage.replace(/_/g, ' ')}
                      </span>

                      {/* Open task status indicator */}
                      {!sug.hasOpenTask ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          ⚠️ No tasks scheduled
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          Task already exists
                        </span>
                      )}

                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {sug.counsellorName}
                      </span>
                    </div>

                    {/* Lead Title & Degree */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => targetLead && onSelectLead && onSelectLead(targetLead)}
                        className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors text-left"
                      >
                        {sug.leadName}
                      </button>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-600">{sug.leadPhone}</span>
                      {targetLead && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {targetLead.target_degree} ({targetLead.city})
                          </span>
                        </>
                      )}
                    </div>

                    {/* Last Contacted Timestamp */}
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Last contacted on <strong>{formatBdDateTime(sug.lastContactedAt)}</strong>
                      </span>
                    </div>

                    {/* Suggestion Box */}
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            Suggested Follow-up Task:
                          </span>
                          {renderPriorityBadge(sug.suggestedPriority)}
                        </div>

                        {!isEditing && (
                          <button
                            onClick={() => startEditing(sug)}
                            className="text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            Customize
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 mt-2 pt-2 border-t border-slate-200">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Task Title
                            </label>
                            <input
                              type="text"
                              value={customTitle}
                              onChange={(e) => setCustomTitle(e.target.value)}
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-md"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Channel
                              </label>
                              <select
                                value={customType}
                                onChange={(e) => setCustomType(e.target.value)}
                                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                              >
                                <option value="call">Call</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="email">Email</option>
                                <option value="meeting">Meeting</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Priority
                              </label>
                              <select
                                value={customPriority}
                                onChange={(e) => setCustomPriority(e.target.value as TaskPriority)}
                                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Due Time
                              </label>
                              <input
                                type="datetime-local"
                                value={customDueTime.slice(0, 16)}
                                onChange={(e) =>
                                  setCustomDueTime(new Date(e.target.value).toISOString())
                                }
                                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingLeadId(null)}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleScheduleSingle(sug)}
                              className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              Save & Schedule
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mt-1">
                            <div className="p-1 bg-white rounded border border-slate-200">
                              {getChannelIcon(sug.suggestedTaskType)}
                            </div>
                            <span>{sug.suggestedTitle}</span>
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                            💡 <strong>Rationale:</strong> {sug.rationale}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  {!isEditing && (
                    <div className="shrink-0 flex sm:flex-col items-center justify-end gap-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                      <button
                        onClick={() => handleScheduleSingle(sug)}
                        disabled={sug.hasOpenTask}
                        title={sug.hasOpenTask ? 'This lead already has an open task — open the lead to manage it' : undefined}
                        className="w-full sm:w-36 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{sug.hasOpenTask ? 'Task already open' : 'Schedule Task'}</span>
                      </button>

                      {targetLead && onSelectLead && (
                        <button
                          onClick={() => onSelectLead(targetLead)}
                          className="w-full sm:w-36 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                        >
                          View Lead
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // If rendering inside an embedded card banner (e.g. at the top of TodayView)
  if (isEmbeddedCard) {
    return (
      <div className="bg-linear-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 rounded-xl p-4 sm:p-5 shadow-xs mb-6">
        {/* Banner Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Automated Follow-up Scheduler
                </h3>
                {allSuggestions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                    {allSuggestions.length} Dormant Leads (3d+)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically detects leads without contact for 3+ days and suggests timely re-engagement tasks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
              title={isExpanded ? 'Collapse automated suggestions' : 'Expand automated suggestions'}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Expandable Body */}
        {isExpanded && content}
      </div>
    );
  }

  // If rendering as a standalone Modal
  if (isOpenModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
        <div className="bg-slate-50 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Automated Follow-up Task Scheduler</h3>
                <p className="text-xs text-slate-400">
                  Cadence recovery based on 'Last Contacted' timestamp for leads inactive for 3+ days
                </p>
              </div>
            </div>

            <button
              onClick={onCloseModal}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1">{content}</div>

          {/* Modal Footer */}
          <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500">
              {filteredSuggestions.length} lead{filteredSuggestions.length === 1 ? '' : 's'} available
              for automated scheduling
            </span>

            <button
              onClick={onCloseModal}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
