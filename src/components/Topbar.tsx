import React from 'react';
import { Bell, Search, Menu, Sparkles, type LucideIcon } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useOverdueTasks } from '../hooks/useOverdueTasks';
import { PrimaryActions } from './Sidebar';
import { ImportButton } from './common/ImportButton';

const PAGE_TITLES: Record<string, { label: string; hint?: string; icon?: LucideIcon }> = {
  inbox: { label: 'Inbox', hint: 'Replies & inbound leads' },
  kanban: { label: 'Pipeline', hint: 'Stage-by-stage view' },
  today: { label: 'Today', hint: 'Tasks and follow-ups due now' },
  visits: { label: 'Visits', hint: 'Scheduled office and video visits' },
  manager: { label: 'Manager', hint: 'Team performance & coverage' },
  jahid: { label: 'Executive Oversight', hint: 'Cross-team metrics' },
  reports: { label: 'Reports', hint: 'Conversion & SLA dashboards' },
};

interface TopbarProps {
  currentTab: string;
  onOpenDrawer: () => void;
  onOpenMobileSidebar: () => void;
  onOpenNewLead: () => void;
  onOpenImport: () => void;
  onOpenSearch: () => void;
  onOpenScheduler?: () => void;
  schedulerCount?: number;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  onOpenDrawer,
  onOpenMobileSidebar,
  onOpenNewLead,
  onOpenImport,
  onOpenSearch,
  onOpenScheduler,
  schedulerCount,
}) => {
  const { currentEmployee, syncError, clearSyncError } = useCrm();
  const { overdue, upcoming, total } = useOverdueTasks('all');
  const meta = PAGE_TITLES[currentTab] ?? { label: 'CRM' };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 lg:px-6">
      <button
        onClick={onOpenMobileSidebar}
        className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">{meta.label}</h1>
        {meta.hint && <p className="text-[11px] text-slate-500 leading-tight truncate">{meta.hint}</p>}
      </div>

      {/* Global search trigger */}
      <button
        onClick={onOpenSearch}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors min-w-[200px]"
        title="Search (⌘K)"
        aria-label="Open global search"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search leads, tasks…</span>
        <span className="ml-auto text-[10px] font-mono text-slate-400">⌘K</span>
      </button>

      <PrimaryActions onOpenNewLead={onOpenNewLead} role={currentEmployee.role} />

      {syncError && (
        <div
          className="flex items-center gap-2 max-w-xs px-2.5 py-1.5 text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-md"
          title={syncError}
        >
          <span className="font-semibold shrink-0">Sync error:</span>
          <span className="truncate">{syncError}</span>
          <button
            onClick={clearSyncError}
            className="ml-auto text-rose-500 hover:text-rose-700 text-xs leading-none"
            aria-label="Dismiss sync error"
          >
            ✕
          </button>
        </div>
      )}

      {(currentEmployee.role === 'admin' || currentEmployee.role === 'manager') && (
        <ImportButton onClick={onOpenImport} />
      )}

      {onOpenScheduler && (
        <button
          onClick={onOpenScheduler}
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          title="Auto-schedule follow-ups"
          aria-label="Open auto-scheduler"
        >
          <Sparkles className="w-4.5 h-4.5" />
          {schedulerCount && schedulerCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-bold leading-none flex items-center justify-center rounded-full text-white bg-amber-500">
              {schedulerCount}
            </span>
          )}
        </button>
      )}

      <button
        onClick={onOpenDrawer}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
        title="Tasks alerts"
        aria-label="Open tasks alerts"
      >
        <Bell className="w-4.5 h-4.5" />
        {total > 0 && (
          <span
            className={`absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-bold leading-none flex items-center justify-center rounded-full text-white ${
              overdue.length > 0 ? 'bg-rose-600' : 'bg-amber-500'
            }`}
          >
            {total}
          </span>
        )}
      </button>
    </header>
  );
};
