import React from 'react';
import { Search, X, Filter, List, Kanban, Sparkles } from 'lucide-react';
import { LeadStage } from '../../types';

interface GlobalSearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  matchingCount: number;
  totalCount: number;
  onClearFilters: () => void;
  currentView: 'inbox' | 'kanban';
  onSwitchView?: (view: 'inbox' | 'kanban') => void;
  placeholder?: string;
}

const PIPELINE_STATUS_OPTIONS: { id: string; label: string; group?: string }[] = [
  { id: 'all', label: 'All Pipeline Stages' },
  { id: 'new', label: 'New Inbound' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'consultation_booked', label: 'Consultation Booked' },
  { id: 'consultation_done', label: 'Consultation Done' },
  { id: 'office_visit_booked', label: 'Office Visit Booked (Gulshan)' },
  { id: 'office_visit_done', label: 'Office Visit Done' },
  { id: 'paid', label: 'Paid Student' },
  { id: 'enrolled', label: 'Enrolled' },
  { id: 'lost', label: 'Lost / Closed' },
  { id: 'nurture', label: 'Nurture' },
];

export const GlobalSearchFilterBar: React.FC<GlobalSearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  matchingCount,
  totalCount,
  onClearFilters,
  currentView,
  onSwitchView,
  placeholder = 'Search lead by student name, phone number (+8801 / 017...), or city...',
}) => {
  const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Global Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full text-xs pl-9 pr-8 py-2 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Pipeline Status Selector & View Switcher */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 font-medium hidden sm:inline text-[11px]">Pipeline Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {PIPELINE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle (Inbox Table <-> Kanban Pipeline) */}
          {onSwitchView && (
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => onSwitchView('inbox')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                  currentView === 'inbox'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View as Table List"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => onSwitchView('kanban')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                  currentView === 'kanban'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View as Kanban Pipeline"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Match Count Indicator & Active Filter Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <span>
            Showing <strong className="text-slate-900 font-mono tabular-nums">{matchingCount}</strong> of{' '}
            <span className="font-mono tabular-nums">{totalCount}</span> leads
          </span>
          {isFiltered && (
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-100">
              Filter Active
            </span>
          )}
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Reset Search & Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
