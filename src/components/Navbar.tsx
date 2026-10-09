import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCrm } from '../context/CrmContext';
import { Lead, FollowUpTask, TaskPriority } from '../types';
import { findDormantLeadsNeedingFollowUp } from '../utils/automated-scheduling';
import {
  Inbox,
  Kanban,
  CheckSquare,
  Calendar,
  Users,
  ShieldAlert,
  BarChart3,
  Plus,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  ChevronRight,
  Flame,
  AlertCircle,
  Flag,
  X,
  ExternalLink,
  Check,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNewLead: () => void;
  onOpenSimulate: () => void;
  onNavigateToTodayTab?: (subFilter?: 'pending' | 'imminent' | 'overdue' | 'completed') => void;
  onSelectLead?: (lead: Lead) => void;
  onOpenScheduler?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNewLead,
  onOpenSimulate,
  onNavigateToTodayTab,
  onSelectLead,
  onOpenScheduler,
}) => {
  const { currentEmployee, setCurrentEmployee, employees, tasks, leads, activities, completeTask } = useCrm();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [taskScope, setTaskScope] = useState<'my' | 'all'>('my');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Keep scope sensible when user role changes
  useEffect(() => {
    if (currentEmployee.role === 'admin' || currentEmployee.role === 'manager') {
      setTaskScope('all');
    } else {
      setTaskScope('my');
    }
  }, [currentEmployee.id, currentEmployee.role]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  const navLinks = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'kanban', label: 'Pipeline', icon: Kanban },
    { id: 'today', label: 'Today', icon: CheckSquare },
    { id: 'visits', label: 'Visits', icon: Calendar },
    { id: 'manager', label: 'Manager', icon: Users },
    { id: 'jahid', label: 'Jahid Oversight', icon: ShieldAlert },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  // Helper for navigating directly to TodayView or specific sub-filter
  const handleGoToToday = (subFilter?: 'pending' | 'imminent' | 'overdue' | 'completed') => {
    setIsPopoverOpen(false);
    if (onNavigateToTodayTab) {
      onNavigateToTodayTab(subFilter);
    } else {
      setCurrentTab('today');
    }
  };

  // Task analysis for current employee & team
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // My direct tasks
  const myOpenTasks = tasks.filter((t) => t.assigned_to === currentEmployee.id && t.status === 'open');
  const myOverdueTasks = myOpenTasks.filter((t) => new Date(t.due_at).getTime() < now.getTime());
  const myUpcomingTasks = myOpenTasks.filter((t) => {
    const dueTime = new Date(t.due_at).getTime();
    const diffMinutes = Math.floor((dueTime - now.getTime()) / (1000 * 60));
    const isToday = t.due_at.startsWith(todayStr);
    return diffMinutes >= 0 && (isToday || diffMinutes <= 24 * 60);
  });

  // All team tasks
  const allOpenTasks = tasks.filter((t) => t.status === 'open');
  const allOverdueTasks = allOpenTasks.filter((t) => new Date(t.due_at).getTime() < now.getTime());
  const allUpcomingTasks = allOpenTasks.filter((t) => {
    const dueTime = new Date(t.due_at).getTime();
    const diffMinutes = Math.floor((dueTime - now.getTime()) / (1000 * 60));
    const isToday = t.due_at.startsWith(todayStr);
    return diffMinutes >= 0 && (isToday || diffMinutes <= 24 * 60);
  });

  // Active viewed scope in popover
  const activeScopeTasks = taskScope === 'my' ? myOpenTasks : allOpenTasks;
  const activeScopeOverdue = taskScope === 'my' ? myOverdueTasks : allOverdueTasks;
  const activeScopeUpcoming = taskScope === 'my' ? myUpcomingTasks : allUpcomingTasks;

  // Primary badge counts (use active scope or my tasks for counsellor)
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';
  const displayOverdueCount = isManagerOrAdmin && taskScope === 'all' ? allOverdueTasks.length : myOverdueTasks.length;
  const displayUpcomingCount = isManagerOrAdmin && taskScope === 'all' ? allUpcomingTasks.length : myUpcomingTasks.length;

  // Automated follow-up suggestions for dormant leads (3+ days without contact)
  const dormantSuggestions = useMemo(() => {
    return findDormantLeadsNeedingFollowUp(leads, activities, tasks, employees, 3);
  }, [leads, activities, tasks, employees]);

  const scopedDormantCount =
    isManagerOrAdmin && taskScope === 'all'
      ? dormantSuggestions.length
      : dormantSuggestions.filter((s) => s.counsellorId === currentEmployee.id).length;

  // Format relative time helper
  const formatDueRelative = (dueAt: string) => {
    const dueTime = new Date(dueAt).getTime();
    const diffMinutes = Math.floor((dueTime - now.getTime()) / (1000 * 60));
    if (diffMinutes < 0) {
      const overdueMins = Math.abs(diffMinutes);
      const hrs = Math.floor(overdueMins / 60);
      const mins = overdueMins % 60;
      return {
        isOverdue: true,
        text: hrs > 0 ? `Overdue by ${hrs}h ${mins}m` : `Overdue by ${mins}m`,
      };
    }
    if (diffMinutes <= 60) {
      return { isOverdue: false, text: `Due in ${diffMinutes}m` };
    }
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hrs < 24) {
      return { isOverdue: false, text: `Due in ${hrs}h ${mins > 0 ? `${mins}m` : ''}` };
    }
    return { isOverdue: false, text: `Due in ${Math.floor(hrs / 24)}d` };
  };

  // Priority indicator helper
  const renderPriorityBadge = (priority?: TaskPriority) => {
    const p = priority || 'medium';
    if (p === 'high') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <Flame className="w-2.5 h-2.5 text-rose-600" />
          High
        </span>
      );
    }
    if (p === 'medium') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
          Med
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <Flag className="w-2.5 h-2.5 text-slate-400" />
        Low
      </span>
    );
  };

  // Top urgent tasks for list display in popover
  const sortedDisplayTasks = [...activeScopeTasks].sort((a, b) => {
    const isAOverdue = new Date(a.due_at).getTime() < now.getTime();
    const isBOverdue = new Date(b.due_at).getTime() < now.getTime();
    if (isAOverdue && !isBOverdue) return -1;
    if (!isAOverdue && isBOverdue) return 1;
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const pDiff = (pOrder[a.priority || 'medium'] ?? 1) - (pOrder[b.priority || 'medium'] ?? 1);
    if (pDiff !== 0) return pDiff;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }).slice(0, 5);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* Top Bar: Brand, Nav links, and Actions with Today's Tasks Badge */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentTab('inbox')}
            className="text-left font-bold text-lg tracking-tight text-slate-900 hover:text-slate-700 transition-colors whitespace-nowrap"
          >
            SICA Bangladesh <span className="text-blue-600 font-semibold text-sm ml-1">Tracker</span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            const isTodayTab = link.id === 'today';

            return (
              <button
                key={link.id}
                onClick={() => (isTodayTab ? handleGoToToday('pending') : setCurrentTab(link.id))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors relative ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{link.label}</span>

                {/* Notification Badge directly on Today tab link */}
                {isTodayTab && (displayOverdueCount > 0 || displayUpcomingCount > 0) && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none tracking-tight flex items-center gap-0.5 shadow-2xs ${
                      displayOverdueCount > 0
                        ? isActive
                          ? 'bg-rose-500 text-white'
                          : 'bg-rose-600 text-white animate-pulse'
                        : isActive
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-amber-500 text-white'
                    }`}
                    title={
                      displayOverdueCount > 0
                        ? `${displayOverdueCount} Overdue, ${displayUpcomingCount} Upcoming`
                        : `${displayUpcomingCount} Upcoming Tasks Today`
                    }
                  >
                    {displayOverdueCount > 0 ? (
                      <>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {displayOverdueCount}
                      </>
                    ) : (
                      displayUpcomingCount
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Notifications */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* 'Today's Tasks' Notification Badge Button & Dropdown */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setIsPopoverOpen((prev) => !prev)}
              aria-label="Today's Tasks Notifications"
              title="Today's Tasks Alerts: Click to view overdue & upcoming tasks"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs ${
                displayOverdueCount > 0
                  ? 'bg-rose-50/80 hover:bg-rose-100/90 text-rose-900 border-rose-300 ring-1 ring-rose-200'
                  : displayUpcomingCount > 0
                  ? 'bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border-amber-300 ring-1 ring-amber-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <CheckSquare
                  className={`w-4 h-4 shrink-0 ${
                    displayOverdueCount > 0
                      ? 'text-rose-600'
                      : displayUpcomingCount > 0
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                />
                {displayOverdueCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                )}
              </div>

              {/* Title & Badge Counters */}
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline font-semibold">Today's Tasks</span>
                
                {/* Overdue Badge */}
                {displayOverdueCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-2xs">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{displayOverdueCount} Overdue</span>
                  </span>
                ) : displayUpcomingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-white shadow-2xs">
                    <Clock className="w-3 h-3" />
                    <span>{displayUpcomingCount} Due</span>
                  </span>
                ) : (
                  <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Clear</span>
                  </span>
                )}

                {/* If both overdue and upcoming, show compact upcoming count too */}
                {displayOverdueCount > 0 && displayUpcomingCount > 0 && (
                  <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{displayUpcomingCount} upcoming</span>
                  </span>
                )}
              </div>
            </button>

            {/* Notification Popover Flyout */}
            {isPopoverOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Popover Header */}
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-800 rounded-md">
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Today's Tasks Alerts</h4>
                      <p className="text-[11px] text-slate-400">
                        {currentEmployee.full_name} ({currentEmployee.role})
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsPopoverOpen(false)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scope Switcher (My Tasks vs All Team) */}
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg text-xs">
                    <button
                      onClick={() => setTaskScope('my')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        taskScope === 'my'
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      My Tasks ({myOpenTasks.length})
                    </button>
                    <button
                      onClick={() => setTaskScope('all')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        taskScope === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Team ({allOpenTasks.length})
                    </button>
                  </div>

                  <button
                    onClick={() => handleGoToToday('pending')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 group whitespace-nowrap"
                  >
                    <span>TodayView</span>
                    <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Summary Alert Metric Cards */}
                <div className="p-3 grid grid-cols-2 gap-2 bg-slate-50/50 border-b border-slate-100">
                  {/* Overdue Card */}
                  <button
                    onClick={() => handleGoToToday('overdue')}
                    className={`p-2.5 rounded-lg border text-left transition-all hover:shadow-xs cursor-pointer ${
                      activeScopeOverdue.length > 0
                        ? 'bg-rose-50/90 border-rose-200 text-rose-900 hover:bg-rose-100'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                        Overdue
                      </span>
                      <AlertTriangle className={`w-3.5 h-3.5 ${activeScopeOverdue.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-lg font-bold text-rose-800 leading-tight">
                      {activeScopeOverdue.length}
                    </div>
                    <div className="text-[10px] text-rose-600/90 mt-0.5 truncate">
                      {activeScopeOverdue.length > 0 ? 'Action required now' : 'No overdue tasks'}
                    </div>
                  </button>

                  {/* Upcoming Card */}
                  <button
                    onClick={() => handleGoToToday('imminent')}
                    className={`p-2.5 rounded-lg border text-left transition-all hover:shadow-xs cursor-pointer ${
                      activeScopeUpcoming.length > 0
                        ? 'bg-amber-50/90 border-amber-200 text-amber-900 hover:bg-amber-100'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                        Due Today
                      </span>
                      <Clock className={`w-3.5 h-3.5 ${activeScopeUpcoming.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-lg font-bold text-amber-900 leading-tight">
                      {activeScopeUpcoming.length}
                    </div>
                    <div className="text-[10px] text-amber-700/90 mt-0.5 truncate">
                      {activeScopeUpcoming.length > 0 ? 'Upcoming deadlines' : 'No tasks due soon'}
                    </div>
                  </button>
                </div>

                {/* Automated Follow-up Suggestions Banner (Leads inactive 3+ days) */}
                {scopedDormantCount > 0 && (
                  <div className="mx-3 my-2 p-2.5 bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-600 text-white rounded-md">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-900 leading-tight">
                          {scopedDormantCount} Dormant Lead{scopedDormantCount > 1 ? 's' : ''} (3d+ No Contact)
                        </div>
                        <div className="text-[10px] text-blue-700">
                          Automated cadence tasks ready to schedule
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsPopoverOpen(false);
                        if (onOpenScheduler) {
                          onOpenScheduler();
                        } else {
                          handleGoToToday('pending');
                        }
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md shadow-2xs transition-colors whitespace-nowrap"
                    >
                      Auto-Schedule
                    </button>
                  </div>
                )}

                {/* Task List Section */}
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {sortedDisplayTasks.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-800">All caught up!</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        There are no overdue or pending tasks in this view.
                      </p>
                    </div>
                  ) : (
                    sortedDisplayTasks.map((task) => {
                      const rel = formatDueRelative(task.due_at);
                      const lead = leads.find((l) => l.id === task.lead_id);
                      const isOverdue = rel.isOverdue;

                      return (
                        <div
                          key={task.id}
                          className="p-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {renderPriorityBadge(task.priority)}
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isOverdue
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isOverdue ? (
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                )}
                                {rel.text}
                              </span>
                            </div>

                            <p className="text-xs font-medium text-slate-900 truncate" title={task.title}>
                              {task.title}
                            </p>

                            {lead && (
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                <button
                                  onClick={() => {
                                    setIsPopoverOpen(false);
                                    if (onSelectLead) onSelectLead(lead);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-medium hover:underline truncate"
                                  title={`View details for ${lead.full_name}`}
                                >
                                  {lead.full_name}
                                </button>
                                <span>•</span>
                                <span className="truncate">{lead.target_degree || lead.city}</span>
                              </div>
                            )}
                          </div>

                          {/* Quick 1-click complete button */}
                          <div className="shrink-0 flex items-center gap-1">
                            <button
                              onClick={() => completeTask(task.id)}
                              title="Mark task completed"
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md border border-slate-200 hover:border-emerald-300 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Popover Footer with direct links to TodayView */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
                  <button
                    onClick={() => handleGoToToday('pending')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors"
                  >
                    <span>Go to Today's Tasks View</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <button
                      onClick={() => handleGoToToday('overdue')}
                      className="py-1 px-2 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                    >
                      View Overdue ({activeScopeOverdue.length})
                    </button>
                    <button
                      onClick={() => handleGoToToday('imminent')}
                      className="py-1 px-2 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                    >
                      View Upcoming ({activeScopeUpcoming.length})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Persona Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">Role:</span>
            <select
              value={currentEmployee.id}
              onChange={(e) => {
                const selected = employees.find((emp) => emp.id === e.target.value);
                if (selected) setCurrentEmployee(selected);
              }}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-md px-2 py-1.5 font-medium focus:ring-1 focus:ring-slate-400 focus:outline-hidden cursor-pointer"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Scheduler Quick Trigger */}
          {dormantSuggestions.length > 0 && (
            <button
              onClick={onOpenScheduler || (() => handleGoToToday('pending'))}
              title={`Automated Follow-up Scheduler: ${dormantSuggestions.length} leads inactive for 3+ days`}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>Auto-Scheduler ({dormantSuggestions.length})</span>
            </button>
          )}

          {/* Simulate inbound button */}
          <button
            onClick={onOpenSimulate}
            title="Simulate inbound lead via Website, Webinar, or Facebook Ads"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Simulate Inbound</span>
          </button>

          {/* Primary CTA */}
          <button
            onClick={onOpenNewLead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="lg:hidden border-t border-slate-100 bg-slate-50 px-4 py-2 overflow-x-auto flex items-center gap-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = currentTab === link.id;
          const isTodayTab = link.id === 'today';

          return (
            <button
              key={link.id}
              onClick={() => (isTodayTab ? handleGoToToday('pending') : setCurrentTab(link.id))}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap relative ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{link.label}</span>

              {isTodayTab && (displayOverdueCount > 0 || displayUpcomingCount > 0) && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                    displayOverdueCount > 0
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {displayOverdueCount > 0 ? `! ${displayOverdueCount}` : displayUpcomingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
