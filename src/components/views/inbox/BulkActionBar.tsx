import React, { useState } from 'react';
import { X, ArrowRight, Download, ChevronDown, ChevronUp, Plus, CalendarClock, Tag } from 'lucide-react';
import { LeadStage } from '../../../types';
import { Employee } from '../../../types';
import { STAGE_SELECT_OPTIONS } from './types';
import { bdTomorrowTen } from '../../common/TaskRow';
import { suggestDueAt } from '../../../utils/automated-scheduling';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onBulkStage: (stage: LeadStage) => void;
  onBulkReassign?: (ownerId: string) => void;
  counsellors: Employee[];
  onExportSelected: () => void;
  onBulkFollowUp: (taskType: string, dueAt: string) => void;
  onBulkAddTag: (tag: string) => void;
  onBulkNextAction: (iso: string, note: string) => void;
}

const FOLLOW_UP_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
];

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
  onBulkFollowUp,
  onBulkAddTag,
  onBulkNextAction,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);

  // Follow-up mini-form state
  const [fuType, setFuType] = useState('call');
  const [fuDue, setFuDue] = useState('3h');
  // Tag mini-form state
  const [tagInput, setTagInput] = useState('');
  // Next-action mini-form state
  const [naValue, setNaValue] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [naNote, setNaNote] = useState('');

  const fuDueChoices = () => [
    { value: '3h', label: '+3 hours', dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
    { value: 'tmr', label: 'Tomorrow 10:00 (BD)', dueAt: bdTomorrowTen() },
    { value: 'biz', label: 'Next business window', dueAt: suggestDueAt() },
  ];

  if (count === 0) return null;

  const runFollowUp = () => {
    const choice = fuDueChoices().find((c) => c.value === fuDue);
    if (choice) onBulkFollowUp(fuType, choice.dueAt);
  };

  return (
    <div className="rounded-xl border border-blue-700 shadow-xs overflow-hidden text-xs">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-blue-600 text-white">
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
          onClick={() => setMoreOpen((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-700/60 hover:bg-blue-800 rounded font-semibold transition-colors"
          title="More bulk actions"
        >
          {moreOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>More</span>
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

      {/* Expandable "More" row: follow-up / tag / next-action */}
      {moreOpen && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2.5 bg-blue-50 border-t border-blue-200 text-slate-800">
          {/* Schedule follow-up for all selected */}
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline">Follow-up:</span>
            <select
              value={fuType}
              onChange={(e) => setFuType(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 font-semibold cursor-pointer"
              title="Task type"
            >
              {FOLLOW_UP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={fuDue}
              onChange={(e) => setFuDue(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 font-semibold cursor-pointer"
              title="Due time"
            >
              {fuDueChoices().map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runFollowUp}
              className="px-2 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors cursor-pointer"
              title="Create a follow-up task for every selected lead"
            >
              Schedule
            </button>
          </div>

          {/* Add a tag to all selected */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (tagInput.trim()) {
                    onBulkAddTag(tagInput);
                    setTagInput('');
                  }
                }
              }}
              placeholder="Add tag to all…"
              className="text-xs px-2 py-1 border border-slate-200 rounded bg-white w-32 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => {
                if (tagInput.trim()) {
                  onBulkAddTag(tagInput);
                  setTagInput('');
                }
              }}
              disabled={!tagInput.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Tag
            </button>
          </div>

          {/* Set next action for all selected */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline">Next action:</span>
            <input
              type="datetime-local"
              value={naValue}
              onChange={(e) => setNaValue(e.target.value)}
              className="text-xs px-2 py-1 border border-slate-200 rounded bg-white font-mono"
              title="Next action due date for all selected leads"
            />
            <input
              type="text"
              value={naNote}
              onChange={(e) => setNaNote(e.target.value)}
              placeholder="Note (optional)"
              className="text-xs px-2 py-1 border border-slate-200 rounded bg-white w-32 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => onBulkNextAction(new Date(naValue).toISOString(), naNote.trim() || 'Bulk update from Inbox')}
              disabled={!naValue}
              className="px-2 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded transition-colors cursor-pointer"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkActionBar;
