import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Employee, LeadSource } from '../../../types';
import { SavedViewMenu } from '../../common/SavedViewMenu';
import { SavedView } from '../../../utils/saved-views';
import { InboxFilters, InboxTab, Density } from './types';

interface LeadTableToolbarProps {
  filters: InboxFilters;
  onPatch: (patch: Partial<InboxFilters>) => void;
  onClear: () => void;
  tabCounts: { all: number; new: number; hot: number; overdue: number; open: number; paid: number };
  employees: Employee[];
  sources: LeadSource[];
  showOwnerFilter: boolean;
  density: Density;
  onToggleDensity: () => void;
  filteredCount: number;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
}

export const LeadTableToolbar: React.FC<LeadTableToolbarProps> = ({
  filters,
  onPatch,
  onClear,
  tabCounts,
  employees,
  sources,
  showOwnerFilter,
  density,
  onToggleDensity,
  filteredCount,
  savedViews,
  onSaveView,
  onApplyView,
  onDeleteView,
}) => {
  const hasActiveFilters =
    filters.filterOwner !== 'all' ||
    filters.filterSource !== 'all' ||
    filters.filterTemp !== 'all' ||
    filters.filterStage !== 'all' ||
    filters.filterWeight !== 'all' ||
    filters.searchQuery !== '';

  const tabs: { id: InboxTab; label: string }[] = [
    { id: 'all', label: `All (${tabCounts.all})` },
    { id: 'new', label: `New Inbound (${tabCounts.new})` },
    { id: 'hot', label: `Hot (${tabCounts.hot})` },
    { id: 'overdue', label: `Overdue Action (${tabCounts.overdue})` },
    { id: 'open', label: `Open Pipeline (${tabCounts.open})` },
    { id: 'paid', label: 'Paid / Converted' },
  ];

  const selectClass =
    'text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden';

  return (
    <>
      {/* Filter Tabs + Search + Density */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onPatch({ activeTab: tab.id })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                filters.activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Saved filter views */}
          <SavedViewMenu
            views={savedViews}
            onSave={onSaveView}
            onApply={onApplyView}
            onDelete={onDeleteView}
          />

          {/* Density toggle */}
          <div
            className="flex items-center rounded-md border border-slate-200 overflow-hidden shrink-0"
            title="Row density"
          >
            {(['comfortable', 'compact'] as Density[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (density !== d) onToggleDensity();
                }}
                className={`px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  density === d
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
              >
                {d === 'comfortable' ? 'Comfy' : 'Compact'}
              </button>
            ))}
          </div>

          {/* Global Search */}
          <div className="relative flex-1 sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => onPatch({ searchQuery: e.target.value })}
              placeholder="Search name, phone (+880...), or pipeline status..."
              className="w-full text-xs pl-8 pr-8 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-400 focus:outline-hidden"
            />
            {filters.searchQuery && (
              <button
                onClick={() => onPatch({ searchQuery: '' })}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search query"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80">
        <div className="flex items-center gap-1 text-slate-600 font-semibold">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span>Filters:</span>
        </div>

        {/* Pipeline Stage filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Status:</span>
          <select
            value={filters.filterStage}
            onChange={(e) => onPatch({ filterStage: e.target.value })}
            className={selectClass}
          >
            <option value="all">All Pipeline Statuses</option>
            <option value="new">New Inbound</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="consultation_booked">Consultation Booked</option>
            <option value="consultation_done">Consultation Done</option>
            <option value="office_visit_booked">Office Visit Booked</option>
            <option value="office_visit_done">Office Visit Done</option>
            <option value="paid">Paid Student</option>
            <option value="enrolled">Enrolled</option>
            <option value="lost">Lost / Closed</option>
            <option value="nurture">Nurture</option>
          </select>
        </div>

        {/* Owner filter (managers/admins only — counsellor data is already self-scoped) */}
        {showOwnerFilter && (
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Owner:</span>
            <select
              value={filters.filterOwner}
              onChange={(e) => onPatch({ filterOwner: e.target.value })}
              className={selectClass}
            >
              <option value="all">All Counsellors</option>
              {employees
                .filter((e) => e.role === 'counsellor' || e.role === 'manager')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.role})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Source filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Source:</span>
          <select
            value={filters.filterSource}
            onChange={(e) => onPatch({ filterSource: e.target.value })}
            className={selectClass}
          >
            <option value="all">All Lead Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Urgency:</span>
          <select
            value={filters.filterTemp}
            onChange={(e) => onPatch({ filterTemp: e.target.value })}
            className={selectClass}
          >
            <option value="all">All Temperatures</option>
            <option value="hot">Hot (Score 70+)</option>
            <option value="warm">Warm (Score 40–69)</option>
            <option value="cold">Cold (&lt;40)</option>
          </select>
        </div>

        {/* Lead Score Weight filter (1-10) */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Weight:</span>
          <select
            value={filters.filterWeight}
            onChange={(e) => onPatch({ filterWeight: e.target.value })}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-indigo-900 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="all">All Weights (1-10)</option>
            <option value="high">High Priority (8–10)</option>
            <option value="medium">Medium Priority (5–7)</option>
            <option value="low">Low Priority (1–4)</option>
          </select>
        </div>

        {/* Result summary and clear button */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            Showing <strong className="text-slate-900">{filteredCount}</strong> of {tabCounts.all}
          </span>

          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default LeadTableToolbar;
