import React from 'react';
import { Phone, MessageSquare, AlertTriangle, Sparkles } from 'lucide-react';
import { Lead, LeadStage, LeadTemperature } from '../../../types';
import {
  STAGE_CONFIG,
  formatBdDateTime,
  formatRelativeDue,
} from '../../../utils/crm-logic';
import { ScoreWeightBadge, TemperaturePill, SlaBadge } from '../../common/badges';
import { getDisplayTags } from '../../../utils/tags';
import { LeadRowData, Density, STAGE_SELECT_OPTIONS } from './types';

/** Initials for the row avatar, e.g. "Mahir Faisal" -> "MF". */
const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_CLASS: Record<LeadTemperature, string> = {
  hot: 'bg-rose-100 text-rose-800 ring-rose-200',
  warm: 'bg-amber-100 text-amber-800 ring-amber-200',
  cold: 'bg-blue-100 text-blue-800 ring-blue-200',
};

interface LeadTableRowProps {
  data: LeadRowData;
  density: Density;
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onStageChange: (lead: Lead, stage: LeadStage) => void;
}

const LeadTableRowInner: React.FC<LeadTableRowProps> = ({
  data,
  density,
  isSelected,
  onToggleSelect,
  onSelectLead,
  onOpenWhatsAppScript,
  onStageChange,
}) => {
  const { lead } = data;
  const compact = density === 'compact';
  const py = compact ? 'py-1.5' : 'py-3';
  const tags = getDisplayTags(lead.tags);

  return (
    <tr
      onClick={() => onSelectLead(lead)}
      className={`cursor-pointer transition-colors group ${
        isSelected ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50/80'
      }`}
    >
      {/* 0. Selection checkbox */}
      <td className={`${py} pl-4 pr-1 w-10`} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
          title="Select lead for bulk actions"
        />
      </td>

      {/* 1. Student: avatar + name + dormancy + city · source · tags */}
      <td className={`${py} px-3`}>
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 shrink-0 select-none ${AVATAR_CLASS[lead.temperature]}`}
            title={`${lead.full_name} (${lead.temperature})`}
          >
            {initialsOf(lead.full_name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                {lead.full_name}
              </span>
              {data.isDormant && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                  title={`No contact for ${Math.floor(data.daysDormant)} days - automated follow-up suggested`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                  {Math.floor(data.daysDormant)}d idle
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap min-w-0">
              <span>{lead.city}</span>
              {tags.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  {tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1 rounded whitespace-nowrap"
                    >
                      {tag}
                    </span>
                  ))}
                  {tags.length > 2 && (
                    <span
                      className="text-[9px] text-slate-400 font-semibold"
                      title={tags.slice(2).join(', ')}
                    >
                      +{tags.length - 2}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* 2. Contact & Quick Script */}
      <td className={`${py} px-3`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <a
            href={`tel:${lead.phone_e164}`}
            title={`Call ${lead.phone_e164}`}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => onOpenWhatsAppScript(lead)}
            title="Open WhatsApp Script"
            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-medium text-[11px] transition-colors"
          >
            <MessageSquare className="w-3 h-3 text-emerald-600" />
            <span className="hidden xl:inline">WhatsApp</span>
          </button>
        </div>
        <div className="font-mono text-[11px] text-slate-400 mt-1 whitespace-nowrap">
          {lead.phone_e164 || lead.phone_raw}
        </div>
      </td>

      {/* 3. Target in China */}
      <td className={`${py} px-3 hidden xl:table-cell`}>
        <div className="font-medium text-slate-800 line-clamp-1 max-w-44" title={lead.target_degree}>
          {lead.target_degree}
        </div>
        <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{lead.target_intake}</div>
      </td>

      {/* 4. Owner */}
      <td className={`${py} px-3 hidden xl:table-cell`}>
        <span className="font-medium text-slate-700 whitespace-nowrap">{data.ownerName || 'Unassigned'}</span>
        {!compact && (
          <div className="text-[10px] text-slate-400 uppercase font-mono">{data.ownerRole}</div>
        )}
      </td>

      {/* 5. Stage: quick-change select tinted with the stage color */}
      <td className={`${py} px-3`} onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.stage}
          onChange={(e) => onStageChange(lead, e.target.value as LeadStage)}
          className={`text-xs border rounded px-2 py-1 font-semibold cursor-pointer whitespace-nowrap max-w-40 truncate ${
            STAGE_CONFIG[lead.stage]?.badgeClass || 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
          title="Quick stage change"
        >
          {STAGE_SELECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>

      {/* 6. Score Weight + Temperature + micro-metrics */}
      <td className={`${py} px-3`}>
        <div className={compact ? 'flex items-center gap-1.5 flex-nowrap' : 'space-y-1'}>
          <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
            <ScoreWeightBadge result={data.weight} />
            <TemperaturePill temperature={lead.temperature} />
          </div>
          {!compact && (
            <div
              className="text-[10px] text-slate-500 font-mono flex items-center gap-1 tabular-nums whitespace-nowrap"
              title={`Activity: ${data.weight.activityScore}/3.5 | Source: ${data.weight.sourceScore}/3.0 | Profile: ${data.weight.profileScore}/3.5`}
            >
              <span className="text-slate-600 font-sans">Prof {data.weight.profileCompletionPercentage}%</span>
              <span className="text-slate-300">·</span>
              <span>{data.weight.activityCount} acts</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{lead.score}pt</span>
            </div>
          )}
        </div>
      </td>

      {/* 7. First Contact SLA */}
      <td className={`${py} px-3`}>
        <SlaBadge sla={data.sla} />
      </td>

      {/* 8. Next Action Due */}
      <td className={`${py} px-3 pr-4 text-right`}>
        <div
          className={`font-mono text-xs ${
            data.isOverdue
              ? 'text-rose-600 font-bold flex items-center gap-1 justify-end'
              : 'text-slate-700'
          }`}
          title={formatBdDateTime(lead.next_action_at)}
        >
          {data.isOverdue && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span>{formatRelativeDue(lead.next_action_at)}</span>
        </div>
        {!compact && (
          <>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
              {formatBdDateTime(lead.next_action_at)}
            </div>
            {lead.next_action_note && (
              <div className="text-[11px] text-slate-400 truncate max-w-48 ml-auto mt-0.5" title={lead.next_action_note}>
                {lead.next_action_note}
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
};

export const LeadTableRow = React.memo(LeadTableRowInner);
