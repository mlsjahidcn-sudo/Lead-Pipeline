import React, { useMemo, useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { getStageLabel, formatBdDateTime } from '../../../utils/crm-logic';
import { findDuplicatePairs } from '../../../utils/duplicates';
import { Copy, ShieldCheck } from 'lucide-react';

/**
 * Admin/manager duplicate review: lists lead pairs matched on
 * phone/WhatsApp/email, lets the reviewer pick the surviving record, and
 * merges via CrmContext.mergeLeads (which re-parents all child rows and
 * archives the duplicate).
 */
export const DuplicateReviewPanel: React.FC = () => {
  const { leads, employees, getLeadActivities, mergeLeads } = useCrm();
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [keepChoice, setKeepChoice] = useState<Record<string, 'a' | 'b'>>({});

  const pairs = useMemo(
    () => findDuplicatePairs(leads).filter((p) => !dismissedPairs.has(`${p.a.id}|${p.b.id}`)),
    [leads, dismissedPairs]
  );

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.full_name || 'Unassigned';

  const handleMerge = (pairKey: string, aId: string, bId: string) => {
    const keep = keepChoice[pairKey] === 'b' ? bId : aId; // default keep A (older)
    const dup = keep === aId ? bId : aId;
    if (!window.confirm('Merge these two lead records? The duplicate is archived as Lost and all its activities, tasks, visits and payments move to the surviving record.')) {
      return;
    }
    mergeLeads(keep, dup);
    setDismissedPairs((prev) => new Set([...prev, pairKey]));
  };

  const dismiss = (pairKey: string) => {
    setDismissedPairs((prev) => new Set([...prev, pairKey]));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
          <Copy className="w-4 h-4 text-amber-600" />
          <span>Possible Duplicate Leads ({pairs.length})</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Matched on phone / WhatsApp / email
        </span>
      </div>

      {pairs.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400">
          <ShieldCheck className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
          No duplicate lead records detected.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {pairs.slice(0, 30).map((p) => {
            const pairKey = `${p.a.id}|${p.b.id}`;
            const choice = keepChoice[pairKey] ?? 'a';
            const renderLeadCard = (lead: typeof p.a, side: 'a' | 'b') => {
              const isKeep = choice === side;
              return (
                <button
                  type="button"
                  onClick={() => setKeepChoice((prev) => ({ ...prev, [pairKey]: side }))}
                  className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer flex-1 min-w-0 ${
                    isKeep
                      ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  title={isKeep ? 'Surviving record' : 'Click to make this the surviving record'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-slate-900 truncate">{lead.full_name}</span>
                    {isKeep && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                        KEEP
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {lead.phone_e164 || lead.phone_raw || 'no phone'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>Stage: <span className="font-medium text-slate-700">{getStageLabel(lead.stage)}</span></div>
                    <div>Owner: <span className="font-medium text-slate-700">{employeeName(lead.owner_id)}</span></div>
                    <div>Created: <span className="font-mono">{formatBdDateTime(lead.created_at)}</span></div>
                    <div>Activities: <span className="font-mono">{getLeadActivities(lead.id).length}</span></div>
                  </div>
                </button>
              );
            };

            return (
              <div key={pairKey} className="p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    Matched on {p.matchField}
                  </span>
                  <button
                    type="button"
                    onClick={() => dismiss(pairKey)}
                    className="text-slate-400 hover:text-slate-600 font-medium"
                    title="Dismiss this pair (not a duplicate)"
                  >
                    Not a duplicate
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  {renderLeadCard(p.a, 'a')}
                  <div className="flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase shrink-0">
                    vs
                  </div>
                  {renderLeadCard(p.b, 'b')}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleMerge(pairKey, p.a.id, p.b.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    Merge — keep {choice === 'a' ? p.a.full_name : p.b.full_name}
                  </button>
                </div>
              </div>
            );
          })}
          {pairs.length > 30 && (
            <div className="p-3 text-center text-[11px] text-slate-400">
              Showing first 30 pairs of {pairs.length} — merge or dismiss from the top to reveal more.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DuplicateReviewPanel;
