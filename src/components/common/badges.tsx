import React from 'react';
import { Gauge } from 'lucide-react';
import {
  LeadStage,
  LeadTemperature,
  LeadScoreWeightResult,
  SlaInfo,
} from '../../types';
import { STAGE_CONFIG } from '../../utils/crm-logic';

/**
 * Shared badge/pill primitives. These were copy-pasted with identical classes
 * across InboxView, KanbanView and TodayView — keep one source of truth here
 * so all views stay visually consistent.
 */

/** Colored pipeline-stage pill driven by STAGE_CONFIG. */
export const StageBadge: React.FC<{
  stage: LeadStage;
  className?: string;
}> = ({ stage, className = '' }) => {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${cfg.badgeClass} ${className}`}
    >
      {cfg.label}
    </span>
  );
};

/** Hot / Warm / Cold micro-pill. 'sm' = Inbox/Kanban style, 'md' = TodayView style. */
export const TemperaturePill: React.FC<{
  temperature: LeadTemperature;
  className?: string;
  size?: 'sm' | 'md';
}> = ({ temperature, className = '', size = 'sm' }) => (
  <span
    className={`uppercase ${
      size === 'md' ? 'text-[10px] font-semibold px-1.5 py-0.2 rounded' : 'text-[9px] font-bold px-1 py-0.2 rounded-xs'
    } ${
      temperature === 'hot'
        ? 'bg-rose-100 text-rose-800'
        : temperature === 'warm'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-blue-100 text-blue-800'
    } ${className}`}
  >
    {temperature}
  </span>
);

/** Lead score weight (1-10) badge with the 3-factor tooltip breakdown. */
export const ScoreWeightBadge: React.FC<{
  result: LeadScoreWeightResult;
  /** 'md' = table rows, 'sm' = kanban cards. */
  size?: 'sm' | 'md';
}> = ({ result, size = 'md' }) => {
  const isHigh = result.weight >= 8;
  const isMed = result.weight >= 5 && result.weight <= 7;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border tabular-nums shadow-2xs ${
        size === 'sm' ? 'text-[10px] font-extrabold' : 'text-[11px] font-bold'
      } ${
        isHigh
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : isMed
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
      title={`Score Weight: ${result.weight}/10 (${result.exactWeight} raw score)
• Activity Frequency: ${result.activityScore}/3.5 (${result.activityCount} acts)
• Lead Source: ${result.sourceScore}/3.0 (${result.sourceName})
• Profile Completion: ${result.profileScore}/3.5 (${result.profileCompletionPercentage}%)`}
    >
      <Gauge
        className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-indigo-600 shrink-0`}
      />
      <span>Score {result.weight}/10</span>
    </span>
  );
};

/** First-contact SLA pill (within SLA / warning / breached). */
export const SlaBadge: React.FC<{ sla: SlaInfo }> = ({ sla }) => (
  <span
    className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
      sla.status === 'within_sla'
        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        : sla.status === 'warning'
        ? 'bg-amber-50 text-amber-800 border border-amber-200'
        : 'bg-rose-50 text-rose-800 border border-rose-200'
    }`}
  >
    {sla.label}
  </span>
);
