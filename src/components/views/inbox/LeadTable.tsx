import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Lead, LeadStage } from '../../../types';
import { LeadRowData, SortKey, SortState, Density } from './types';
import { LeadTableRow } from './LeadTableRow';

interface LeadTableProps {
  rows: LeadRowData[];
  totalCount: number;
  sort: SortState;
  onSort: (key: SortKey) => void;
  density: Density;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  onToggleSelect: (leadId: string) => void;
  onToggleSelectAll: () => void;
  visibleCount: number;
  onShowMore: () => void;
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onStageChange: (lead: Lead, stage: LeadStage) => void;
  onOpenNewLead: () => void;
}

const LeadTable: React.FC<LeadTableProps> = ({
  rows,
  totalCount,
  sort,
  onSort,
  density,
  selectedIds,
  allVisibleSelected,
  onToggleSelect,
  onToggleSelectAll,
  visibleCount,
  onShowMore,
  onSelectLead,
  onOpenWhatsAppScript,
  onStageChange,
  onOpenNewLead,
}) => {
  const SortHeader: React.FC<{ label: string; sortKey: SortKey; align?: 'left' | 'right' }> = ({
    label,
    sortKey,
    align = 'left',
  }) => {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer ${
          align === 'right' ? 'flex-row-reverse ml-auto' : ''
        } ${active ? 'text-slate-900' : ''}`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
      </button>
    );
  };

  return (
    <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Own scroll region so the sticky header actually sticks while the
          table body scrolls (page-level sticky is unreliable inside
          overflow-x containers). */}
      <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[320px]">
        <table className="w-full text-left text-xs border-collapse min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
              <th className="sticky top-0 bg-slate-50 py-3 pl-4 pr-1 w-10 z-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected && rows.length > 0}
                  onChange={onToggleSelectAll}
                  className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                  title="Select all visible leads"
                />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap">
                <SortHeader label="Student" sortKey="name" />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap">Contact</th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap hidden xl:table-cell">
                <SortHeader label="Target" sortKey="intake" />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap hidden xl:table-cell">
                <SortHeader label="Owner" sortKey="owner" />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap">
                <SortHeader label="Stage" sortKey="stage" />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap">
                <SortHeader label="Score" sortKey="weight" />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 z-10 whitespace-nowrap">
                <SortHeader label="SLA" sortKey="sla" />
              </th>
              <th className="sticky top-0 bg-slate-50 py-3 px-3 pr-4 z-10 whitespace-nowrap">
                <SortHeader label="Next Action" sortKey="nextAction" align="right" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {totalCount === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <p className="font-medium text-slate-700">No student leads found matching filters.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try resetting your search query or add a new lead.
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={onOpenNewLead}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
                    >
                      + Create Lead
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((data) => (
                <LeadTableRow
                  key={data.lead.id}
                  data={data}
                  density={density}
                  isSelected={selectedIds.has(data.lead.id)}
                  onToggleSelect={onToggleSelect}
                  onSelectLead={onSelectLead}
                  onOpenWhatsAppScript={onOpenWhatsAppScript}
                  onStageChange={onStageChange}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load-more footer */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 text-xs">
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            Showing <strong className="text-slate-900">{Math.min(visibleCount, totalCount)}</strong> of{' '}
            {totalCount} leads
          </span>
          {visibleCount < totalCount && (
            <button
              type="button"
              onClick={onShowMore}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-md text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
            >
              Show 30 more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadTable;
