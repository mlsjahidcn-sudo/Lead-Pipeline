import React, { useState, useEffect, useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, FollowUpTask, TaskPriority } from '../../types';
import { formatBdDateTime, calculateSlaInfo } from '../../utils/crm-logic';
import { AutomatedFollowUpScheduler } from '../common/AutomatedFollowUpScheduler';
import { TemperaturePill } from '../common/badges';
import { TaskRow } from '../common/TaskRow';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  MessageSquare,
  Sparkles,
  User,
  Check,
  RotateCcw,
  Copy,
  CheckCheck,
  Flame,
  Filter,
} from 'lucide-react';

interface TodayViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onOpenBookVisit: (lead: Lead) => void;
  initialFilterTab?: 'pending' | 'imminent' | 'overdue' | 'completed';
}

export const TodayView: React.FC<TodayViewProps> = ({
  onSelectLead,
  onOpenWhatsAppScript,
  initialFilterTab,
}) => {
  const {
    tasks,
    leads,
    visits,
    employees,
    currentEmployee,
    company,
    completeTask,
    reopenTask,
  } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const [selectedCounsellorId, setSelectedCounsellorId] = useState(currentEmployee.id);
  const [taskFilterTab, setTaskFilterTab] = useState<'pending' | 'imminent' | 'overdue' | 'completed'>(
    initialFilterTab || 'pending'
  );
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [lastCompletedTaskId, setLastCompletedTaskId] = useState<string | null>(null);
  const [copiedBrief, setCopiedBrief] = useState(false);

  // Sync initialFilterTab when updated from external navigation (e.g. Navbar badge links)
  useEffect(() => {
    if (initialFilterTab) {
      setTaskFilterTab(initialFilterTab);
    }
  }, [initialFilterTab]);

  // Keep counsellor synced if current user changes
  useEffect(() => {
    setSelectedCounsellorId(currentEmployee.id);
  }, [currentEmployee.id]);

  // Filter tasks for counsellor
  const isAll = selectedCounsellorId === 'all';
  const counsellorTasks = useMemo(
    () => tasks.filter((t) => (isAll ? true : t.assigned_to === selectedCounsellorId)),
    [tasks, isAll, selectedCounsellorId]
  );
  const counsellorLeads = useMemo(
    () => leads.filter((l) => (isAll ? true : l.owner_id === selectedCounsellorId)),
    [leads, isAll, selectedCounsellorId]
  );
  // Lead lookup for task/visit rows — Map instead of leads.find per row.
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 1. Overdue Tasks
  const overdueTasks = counsellorTasks.filter(
    (t) => t.status === 'open' && new Date(t.due_at).getTime() < now.getTime()
  ).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  // 2. Imminent & Today's Open Tasks
  const imminentAndTodayTasks = counsellorTasks.filter((t) => {
    if (t.status !== 'open') return false;
    const dueTime = new Date(t.due_at).getTime();
    const diffMinutes = Math.floor((dueTime - now.getTime()) / (1000 * 60));
    const isDueToday = t.due_at.startsWith(todayStr);
    return diffMinutes >= 0 && (diffMinutes <= 180 || isDueToday);
  }).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  // 3. All Open Pending Tasks (sorted with High Priority first, then due_at ascending)
  const allPendingTasks = counsellorTasks.filter((t) => t.status === 'open')
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const pDiff = (priorityOrder[a.priority || 'medium'] ?? 1) - (priorityOrder[b.priority || 'medium'] ?? 1);
      if (pDiff !== 0) return pDiff;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

  // 4. Completed Tasks
  const completedTasks = counsellorTasks.filter((t) => t.status === 'done')
    .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());

  // 5. High Priority Open Tasks count
  const highPriorityTasks = counsellorTasks.filter(
    (t) => t.status === 'open' && (t.priority || 'medium') === 'high'
  );

  // 6. Today's Office Visits
  const todayVisits = visits.filter((v) => {
    const isToday = v.scheduled_at.startsWith(todayStr);
    const matchesCounsellor = isAll ? true : v.counsellor_id === selectedCounsellorId;
    return isToday && matchesCounsellor;
  });

  // 7. New Inbound Leads waiting for First Contact (2-hour SLA clock)
  const uncontactedNewLeads = counsellorLeads.filter(
    (l) => l.stage === 'new' && !l.first_contact_at && !l.duplicate_of
  );

  // Complete a task with 1-click
  const handleMarkTaskComplete = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    completeTask(taskId);
    setLastCompletedTaskId(taskId);
    setTimeout(() => {
      setLastCompletedTaskId((prev) => (prev === taskId ? null : prev));
    }, 5000);
  };

  // Reopen/undo completed task
  const handleUndoComplete = (taskId: string) => {
    reopenTask(taskId);
    setLastCompletedTaskId(null);
  };

  // Self-scoped daily brief (plain text, copied to clipboard)
  const handleCopyDailyBrief = () => {
    const activeLeads = counsellorLeads.filter((l) => !['lost', 'enrolled', 'paid'].includes(l.stage) && !l.duplicate_of);
    const hotActive = activeLeads.filter((l) => l.temperature === 'hot');
    const scopeName =
      selectedCounsellorId === 'all'
        ? 'All office staff'
        : employees.find((e) => e.id === selectedCounsellorId)?.full_name || currentEmployee.full_name;
    const brief = `${company.name.toUpperCase()} - DAILY BRIEF
Counsellor: ${scopeName}
Date: ${new Date().toLocaleDateString('en-GB')}

TASKS
- Overdue: ${overdueTasks.length}
- Due soon / today: ${imminentAndTodayTasks.length}
- High priority open: ${highPriorityTasks.length}

LEADS
- New inbound awaiting first contact (2h SLA): ${uncontactedNewLeads.length}
- Active pipeline: ${activeLeads.length} (hot: ${hotActive.length})
- Visits today: ${todayVisits.length}`;
    navigator.clipboard.writeText(brief);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  // Select tasks list based on active tab and priority filter
  let baseTasks: FollowUpTask[] = [];
  if (taskFilterTab === 'overdue') {
    baseTasks = overdueTasks;
  } else if (taskFilterTab === 'imminent') {
    baseTasks = imminentAndTodayTasks;
  } else if (taskFilterTab === 'completed') {
    baseTasks = completedTasks;
  } else {
    baseTasks = allPendingTasks;
  }

  const displayTasks = baseTasks.filter((t) => {
    if (priorityFilter === 'all') return true;
    return (t.priority || 'medium') === priorityFilter;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Header & Counsellor Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Counsellor Daily Action Queue & Task Deadlines
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Priority indicators (High, Medium, Low) · Real-time deadline clocks · 1-tap completion
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyDailyBrief}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            title="Copy a plain-text daily brief for this queue (paste into WhatsApp/email)"
          >
            {copiedBrief ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedBrief ? 'Copied!' : 'Copy daily brief'}</span>
          </button>
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Queue for:</span>
          {isManagerOrAdmin ? (
            <select
              value={selectedCounsellorId}
              onChange={(e) => setSelectedCounsellorId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800"
            >
              <option value="all">All Office Staff</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-slate-800 px-1">{currentEmployee.full_name}</span>
          )}
        </div>
      </div>

      {/* Automated Follow-Up Task Scheduler based on Last Contacted timestamp */}
      <AutomatedFollowUpScheduler
        isEmbeddedCard={true}
        onSelectLead={onSelectLead}
      />

      {/* Summary KPI Strip with visual urgency & Priority Focus */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* High Priority Tasks KPI */}
        <div
          onClick={() => {
            setTaskFilterTab('pending');
            setPriorityFilter('high');
          }}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            priorityFilter === 'high'
              ? 'bg-rose-100/80 border-rose-400 shadow-xs ring-1 ring-rose-400'
              : 'bg-rose-50 border-rose-200 hover:bg-rose-100/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 uppercase">High Priority</span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-900 mt-0.5 tabular-nums">
            {highPriorityTasks.length}
          </div>
          <div className="text-[10px] text-rose-700 mt-0.5">Urgent leads to convert first</div>
        </div>

        {/* Overdue Deadlines KPI */}
        <div
          onClick={() => {
            setTaskFilterTab('overdue');
            setPriorityFilter('all');
          }}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            taskFilterTab === 'overdue' && priorityFilter === 'all'
              ? 'bg-rose-100/70 border-rose-400 shadow-xs ring-1 ring-rose-400'
              : 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 uppercase">Overdue Tasks</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-900 mt-0.5 tabular-nums">
            {overdueTasks.length}
          </div>
          <div className="text-[10px] text-rose-700 mt-0.5">Violates SLA if neglected</div>
        </div>

        {/* Due Today & Soon KPI */}
        <div
          onClick={() => {
            setTaskFilterTab('imminent');
            setPriorityFilter('all');
          }}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            taskFilterTab === 'imminent'
              ? 'bg-amber-100/70 border-amber-400 shadow-xs ring-1 ring-amber-400'
              : 'bg-amber-50 border-amber-200 hover:bg-amber-100/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase">Due Today / Soon</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-900 mt-0.5 tabular-nums">
            {imminentAndTodayTasks.length}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">Upcoming deadlines</div>
        </div>

        {/* Completed Tasks KPI */}
        <div
          onClick={() => {
            setTaskFilterTab('completed');
            setPriorityFilter('all');
          }}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            taskFilterTab === 'completed'
              ? 'bg-emerald-100/70 border-emerald-400 shadow-xs ring-1 ring-emerald-400'
              : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase">Completed</span>
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5 tabular-nums">
            {completedTasks.length}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Logged with outcome</div>
        </div>
      </div>

      {/* Undo Notification Banner if task just completed */}
      {lastCompletedTaskId && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Task marked as completed! Activity recorded and timeline updated.</span>
          </div>
          <button
            type="button"
            onClick={() => handleUndoComplete(lastCompletedTaskId)}
            className="flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 underline text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Section: Task Deadlines & Priority Action Center */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
        {/* Task Section Header & Filter Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Lead Follow-up Tasks & Priority Queue
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 tabular-nums">
              {displayTasks.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 text-xs">
              <Filter className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500 font-medium text-[11px]">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority ({counsellorTasks.filter(t => (t.priority || 'medium') === 'high' && (taskFilterTab === 'completed' ? t.status === 'done' : t.status === 'open')).length})</option>
                <option value="medium">Medium Priority ({counsellorTasks.filter(t => (t.priority || 'medium') === 'medium' && (taskFilterTab === 'completed' ? t.status === 'done' : t.status === 'open')).length})</option>
                <option value="low">Low Priority ({counsellorTasks.filter(t => t.priority === 'low' && (taskFilterTab === 'completed' ? t.status === 'done' : t.status === 'open')).length})</option>
              </select>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 text-xs">
              <button
                onClick={() => setTaskFilterTab('pending')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  taskFilterTab === 'pending'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                All Open ({allPendingTasks.length})
              </button>
              <button
                onClick={() => setTaskFilterTab('imminent')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  taskFilterTab === 'imminent'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Due Soon ({imminentAndTodayTasks.length})
              </button>
              <button
                onClick={() => setTaskFilterTab('overdue')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  taskFilterTab === 'overdue'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Overdue ({overdueTasks.length})
              </button>
              <button
                onClick={() => setTaskFilterTab('completed')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  taskFilterTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Done ({completedTasks.length})
              </button>
            </div>
          </div>
        </div>

        {/* Task Cards List with Color-Coded Priority & Deadlines */}
        <div className="divide-y divide-slate-100">
          {displayTasks.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">
                {taskFilterTab === 'completed'
                  ? 'No tasks completed yet today matching filter. Mark tasks complete below!'
                  : taskFilterTab === 'overdue'
                  ? 'Zero overdue tasks matching criteria!'
                  : 'No tasks scheduled in this filter category.'}
              </p>
            </div>
          ) : (
            displayTasks.map((task) => {
              const lead = leadById.get(task.lead_id);
              if (!lead) return null;

              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  lead={lead}
                  onSelectLead={onSelectLead}
                  onOpenWhatsAppScript={onOpenWhatsAppScript}
                  onComplete={(t) => handleMarkTaskComplete(t.id)}
                  onReopen={handleUndoComplete}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Section: NEW INBOUND LEADS (2-Hour SLA Timer) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>New Inbound Leads Waiting for First Contact ({uncontactedNewLeads.length})</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">2-Hour First Contact SLA</span>
        </div>

        <div className="divide-y divide-slate-100">
          {uncontactedNewLeads.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              All inbound leads have been contacted!
            </div>
          ) : (
            uncontactedNewLeads.map((lead) => {
              const sla = calculateSlaInfo(lead.created_at, lead.first_contact_at);
              return (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{lead.full_name}</span>
                      <span className="text-xs text-slate-500">{lead.city}</span>
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        Score {lead.score}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Target: {lead.target_degree} ({lead.target_intake})
                    </p>
                    <div>
                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                          sla.status === 'within_sla'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200 font-bold'
                        }`}
                      >
                        {sla.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:${lead.phone_e164}`}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Now</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => onOpenWhatsAppScript(lead)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section: TODAY'S VISITS & CONSULTATIONS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Today's Office Visits & Scheduled Meetings ({todayVisits.length})</span>
          </div>
          <span className="text-[11px] text-slate-500">Dhaka Office Navana Tower</span>
        </div>

        <div className="divide-y divide-slate-100">
          {todayVisits.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No office visits scheduled for today yet. Push prospective leads to visit!
            </div>
          ) : (
            todayVisits.map((vis) => {
              const lead = leadById.get(vis.lead_id);
              if (!lead) return null;
              return (
                <div
                  key={vis.id}
                  onClick={() => onSelectLead(lead)}
                  className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{lead.full_name}</span>
                      <span className="text-xs text-slate-500 font-mono">
                        Time: {new Date(vis.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[11px] uppercase font-semibold text-blue-700 px-1.5 py-0.2 bg-blue-50 rounded">
                        {vis.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Attendees: {vis.attendees} · Target: {lead.target_degree}
                    </p>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onOpenWhatsAppScript(lead)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Send Reminder</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
