import React from 'react';
import { Phone, MessageSquare, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Lead, LeadStage, LeadTemperature } from '../../../types';
import { formatBdDateTime, formatRelativeDue, STAGE_CONFIG } from '../../../utils/crm-logic';
import { ScoreWeightBadge, TemperaturePill, SlaBadge } from '../../common/badges';
import { LeadRowData, STAGE_SELECT_OPTIONS } from './types';

const AVATAR_CLASS: Record<LeadTemperature, string> = {
  hot: 'bg-rose-100 text-rose-800 ring-rose-200',
  warm: 'bg-amber-100 text-amber-800 ring-amber-200',
  cold: 'bg-blue-100 text-blue-800 ring-blue-200',
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface LeadCardProps {
  data: LeadRowData;
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onStageChange: (lead: Lead, stage: LeadStage) => void;
  onQuickComplete: (task: NonNullable<LeadRowData['nextOpenTask']>) => void;
}

/** Compact card layout used below the sm breakpoint instead of the
 *  horizontally-scrolled table. */
const LeadCard: React.FC<LeadCardProps> = ({
  data,
  isSelected,
  onToggleSelect,
  onSelectLead,
  onOpenWhatsAppScript,
  onStageChange,
  onQuickComplete,
}) => {
  const { lead } = data;

  return (
    <div
      onClick={() => onSelectLead(lead)}
      className={`bg-white rounded-xl border p-3 space-y-2 shadow-2xs cursor-pointer transition-colors ${
        isSelected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Row 1: checkbox + avatar + name + temp + chevron */}
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer shrink-0"
        />
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 shrink-0 select-none ${AVATAR_CLASS[lead.temperature]}`}
        >
          {initialsOf(lead.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 truncate">{lead.full_name}</div>
          <div className="text-[11px] text-slate-500 truncate">{lead.city}</div>
        </div>
        <TemperaturePill temperature={lead.temperature} />
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
      </div>

      {/* Row 2: stage quick-change + score */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={lead.stage}
          onChange={(e) => onStageChange(lead, e.target.value as LeadStage)}
          onClick={(e) => e.stopPropagation()}
          className={`text-xs border rounded px-2 py-1 font-semibold cursor-pointer ${
            STAGE_CONFIG[lead.stage]?.badgeClass || 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
        >
          {STAGE_SELECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ScoreWeightBadge result={data.weight} size="sm" />
      </div>

      {/* Row 3: target */}
      <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
        <span className="font-medium text-slate-800">{lead.target_degree}</span>
        <span className="text-slate-300">·</span>
        <span className="font-mono text-[11px] text-slate-500">{lead.target_intake}</span>
      </div>

      {/* Row 4: next action + SLA + quick-complete */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 min-w-0">
          {data.nextOpenTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickComplete(data.nextOpenTask!);
              }}
              className="p-0.5 rounded text-emerald-600 hover:text-emerald-800 transition-colors shrink-0"
              title={`Quick-complete next task: "${data.nextOpenTask.title}"`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <span
            className={`font-mono truncate ${
              data.isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-600'
            }`}
            title={formatBdDateTime(lead.next_action_at)}
          >
            {data.isOverdue && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            {formatRelativeDue(lead.next_action_at)}
          </span>
        </span>
        <SlaBadge sla={data.sla} />
      </div>

      {/* Row 5: quick actions */}
      <div
        className="flex items-center gap-2 pt-1 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={`tel:${lead.phone_e164}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium flex-1 justify-center transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          <span className="font-mono">{lead.phone_e164 || lead.phone_raw}</span>
        </a>
        <button
          type="button"
          onClick={() => onOpenWhatsAppScript(lead)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md font-medium text-xs transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>WhatsApp</span>
        </button>
      </div>
    </div>
  );
};

export default LeadCard;
