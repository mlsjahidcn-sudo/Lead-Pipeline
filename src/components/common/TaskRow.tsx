import React, { useState } from 'react';
import { FollowUpTask, Lead, TaskPriority } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { formatBdDateTime } from '../../utils/crm-logic';
import { suggestDueAt } from '../../utils/automated-scheduling';
import { TemperaturePill } from './badges';
import {
  Phone,
  MessageSquare,
  MapPin,
  CheckCheck,
  RotateCcw,
  Flame,
  AlertCircle,
  Flag,
  AlarmClockOff,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Priority / deadline indicators (moved from TodayView so both the Today task
// queue and the OverdueDrawer share one implementation).
// ---------------------------------------------------------------------------

export const getPriorityIndicator = (priority?: TaskPriority) => {
  const p = priority || 'medium';
  if (p === 'high') {
    return {
      level: 'high' as const,
      label: 'High Priority',
      shortLabel: 'High',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      dotColor: 'bg-rose-600',
      textColor: 'text-rose-700 font-bold',
      icon: Flame,
    };
  }
  if (p === 'medium') {
    return {
      level: 'medium' as const,
      label: 'Medium Priority',
      shortLabel: 'Medium',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-800 font-semibold',
      icon: AlertCircle,
    };
  }
  return {
    level: 'low' as const,
    label: 'Low Priority',
    shortLabel: 'Low',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-600 font-medium',
    icon: Flag,
  };
};

export const getDeadlineIndicator = (dueAt: string, now = new Date()) => {
  const dueTime = new Date(dueAt).getTime();
  const diffMinutes = Math.floor((dueTime - now.getTime()) / (1000 * 60));
  const todayStr = now.toISOString().slice(0, 10);

  if (diffMinutes < 0) {
    const overdueMins = Math.abs(diffMinutes);
    const hours = Math.floor(overdueMins / 60);
    const mins = overdueMins % 60;
    return {
      urgency: 'overdue' as const,
      badgeText: hours > 0 ? `Overdue by ${hours}h ${mins}m` : `Overdue by ${mins}m`,
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      dotColor: 'bg-rose-600',
      textColor: 'text-rose-700 font-bold',
      isCritical: true,
    };
  }

  if (diffMinutes <= 60) {
    return {
      urgency: 'imminent' as const,
      badgeText: `Due in ${diffMinutes}m (Urgent)`,
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      dotColor: 'bg-rose-500',
      textColor: 'text-rose-700 font-bold',
      isCritical: true,
    };
  }

  if (diffMinutes <= 180) {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return {
      urgency: 'soon' as const,
      badgeText: `Due in ${hours}h ${mins}m`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-800 font-semibold',
      isCritical: false,
    };
  }

  const dueTimeFormatted = new Date(dueAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (dueAt.startsWith(todayStr)) {
    return {
      urgency: 'today' as const,
      badgeText: `Due today at ${dueTimeFormatted}`,
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      dotColor: 'bg-blue-500',
      textColor: 'text-blue-800 font-medium',
      isCritical: false,
    };
  }

  return {
    urgency: 'upcoming' as const,
    badgeText: `Due ${formatBdDateTime(dueAt)}`,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-600',
    isCritical: false,
  };
};

/** Tomorrow 10:00 Asia/Dhaka as ISO UTC (UTC-field math — machine-tz safe). */
export const bdTomorrowTen = (): string => {
  const bd = new Date(Date.now() + 6 * 60 * 60 * 1000);
  bd.setUTCDate(bd.getUTCDate() + 1);
  bd.setUTCHours(10, 0, 0, 0);
  return new Date(bd.getTime() - 6 * 60 * 60 * 1000).toISOString();
};

const snoozeChoices = () => [
  { label: '+1 hour', dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  { label: '+3 hours', dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
  { label: 'Tomorrow 10:00 (BD)', dueAt: bdTomorrowTen() },
  { label: 'Next business window', dueAt: suggestDueAt() },
];

// ---------------------------------------------------------------------------
// Shared task row — full variant for the Today queue, compact for the
// OverdueDrawer. Snooze + priority + complete/reopen live here so both
// surfaces have feature parity.
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: FollowUpTask;
  lead: Lead;
  variant?: 'full' | 'compact';
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onComplete: (task: FollowUpTask) => void;
  onReopen: (taskId: string) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  lead,
  variant = 'full',
  onSelectLead,
  onOpenWhatsAppScript,
  onComplete,
  onReopen,
}) => {
  const { updateTaskPriority, snoozeTask } = useCrm();
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const isCompleted = task.status === 'done';
  const deadline = getDeadlineIndicator(task.due_at);
  const priorityInfo = getPriorityIndicator(task.priority);
  const PriorityIcon = priorityInfo.icon;
  const compact = variant === 'compact';

  return (
    <div
      onClick={() => onSelectLead(lead)}
      className={`hover:bg-slate-50/90 transition-all flex ${compact ? 'flex-col gap-2 p-3' : 'flex-col md:flex-row md:items-center justify-between gap-3 p-4'} cursor-pointer group ${
        isCompleted ? 'bg-slate-50/50 opacity-80' : ''
      }`}
    >
      {/* Left: badges + title + lead meta */}
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border ${priorityInfo.badgeClass}`}
            title={`Task Priority: ${priorityInfo.label}`}
          >
            <PriorityIcon className="w-3 h-3 shrink-0" />
            <span>{priorityInfo.label}</span>
          </div>

          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Done on {formatBdDateTime(task.completed_at || task.due_at)}</span>
            </span>
          ) : (
            <div
              className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${deadline.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${deadline.dotColor} shrink-0`} />
              <span>{deadline.badgeText}</span>
            </div>
          )}

          <TemperaturePill temperature={lead.temperature} size="md" />
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            Score {lead.score}/100
          </span>

          {task.cadence_step !== undefined && !compact && (
            <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
              Cadence Step: Day {task.cadence_step}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <h3
            className={`text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors ${
              isCompleted ? 'line-through text-slate-500' : ''
            }`}
          >
            {task.title}
          </h3>
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{lead.full_name}</span>
            <span>·</span>
            <span className="font-mono text-slate-600">{lead.phone_e164 || lead.phone_raw}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              {lead.city}
            </span>
            <span>·</span>
            <span className="text-slate-700">
              {lead.target_degree} ({lead.target_intake})
            </span>
          </div>
        )}
        {compact && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{lead.full_name}</span>
            <span className="font-mono text-slate-600">{lead.phone_e164 || lead.phone_raw}</span>
          </div>
        )}
      </div>

      {/* Right: snooze, priority, call/WhatsApp, complete/reopen */}
      <div
        className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Snooze menu (open tasks only) */}
        {!isCompleted && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSnoozeOpen((v) => !v)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-300 hover:text-amber-700 text-slate-600 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Snooze / reschedule task"
            >
              <AlarmClockOff className="w-3.5 h-3.5" />
              <span>Snooze</span>
            </button>
            {snoozeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSnoozeOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-48">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Push due date to
                  </div>
                  {snoozeChoices().map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      onClick={() => {
                        snoozeTask(task.id, choice.dueAt);
                        setSnoozeOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Inline priority modifier */}
        {!isCompleted && (
          <select
            value={task.priority || 'medium'}
            onChange={(e) => {
              e.stopPropagation();
              updateTaskPriority(task.id, e.target.value as TaskPriority);
            }}
            className="text-[11px] font-semibold bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 hover:border-slate-300 focus:outline-hidden cursor-pointer"
            title="Change task priority"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        )}

        <a
          href={`tel:${lead.phone_e164}`}
          title={`Call ${lead.full_name}`}
          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Call</span>
        </a>

        <button
          type="button"
          onClick={() => onOpenWhatsAppScript(lead)}
          title="Open WhatsApp Template"
          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </button>

        {/* Primary action: complete / reopen */}
        {isCompleted ? (
          <button
            type="button"
            onClick={() => onReopen(task.id)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Reopen task"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reopen</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onComplete(task)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Mark task completed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Complete</span>
          </button>
        )}
      </div>
    </div>
  );
};
