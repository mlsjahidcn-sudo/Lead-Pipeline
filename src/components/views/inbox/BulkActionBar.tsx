import React from 'react';
import { X, ArrowRight, Download } from 'lucide-react';
import { LeadStage } from '../../../types';
import { Employee } from '../../../types';
import { STAGE_SELECT_OPTIONS } from './types';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onBulkStage: (stage: LeadStage) => void;
  onBulkReassign?: (ownerId: string) => void;
  counsellors: Employee[];
  onExportSelected: () => void;
}

/** In-flow action bar rendered above the table while rows are selected.
 *  'lost' is deliberately excluded from bulk stage changes — it requires a
 *  per-lead exit reason for the daily audit. */
const BulkActionBar: React.FC<BulkActionBarProps> = ({
  count,
  onClear,
  onBulkStage,
  onBulkReassign,
  counsellors,
  onExportSelected,
}) => {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl border border-blue-700 shadow-xs text-xs">
      <span className="font-bold tabular-nums">{count} selected</span>

      {/* Bulk stage change */}
      <div className="flex items-center gap-1.5">
        <span className="text-blue-100 hidden sm:inline">Set stage:</span>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onBulkStage(e.target.value as LeadStage);
            e.target.value = '';
          }}
          className="text-xs bg-white text-slate-800 border border-blue-300 rounded px-2 py-1 font-semibold cursor-pointer focus:outline-hidden"
          title="Apply a pipeline stage to all selected leads (stage history is recorded per lead)"
        >
          <option value="" disabled>
            Choose stage…
          </option>
          {STAGE_SELECT_OPTIONS.filter((o) => o.value !== 'lost').map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk reassign (admin/manager only) */}
      {onBulkReassign && (
        <div className="flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5 text-blue-100 hidden sm:inline" />
          <span className="text-blue-100 hidden sm:inline">Reassign to:</span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onBulkReassign(e.target.value);
              e.target.value = '';
            }}
            className="text-xs bg-white text-slate-800 border border-blue-300 rounded px-2 py-1 font-semibold cursor-pointer focus:outline-hidden"
            title="Reassign all selected leads to a counsellor"
          >
            <option value="" disabled>
              Choose counsellor…
            </option>
            {counsellors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Export selected */}
      <button
        type="button"
        onClick={onExportSelected}
        className="flex items-center gap-1 px-2.5 py-1 bg-blue-700/60 hover:bg-blue-800 rounded font-semibold transition-colors"
        title="Export selected leads to CSV"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Export</span> CSV
      </button>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex items-center gap-1 px-2 py-1 hover:bg-blue-700/60 rounded font-semibold transition-colors"
        title="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
        Clear
      </button>
    </div>
  );
};

export default BulkActionBar;
