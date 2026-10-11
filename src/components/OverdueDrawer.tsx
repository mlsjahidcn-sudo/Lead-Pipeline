import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Check, Clock, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useOverdueTasks } from '../hooks/useOverdueTasks';
import { TaskRow } from './common/TaskRow';
import { FollowUpTask, Lead } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectLead?: (leadId: string) => void;
  onOpenWhatsAppScript?: (lead: Lead) => void;
}

export const OverdueDrawer: React.FC<Props> = ({ open, onClose, onSelectLead, onOpenWhatsAppScript }) => {
  const { tasks, completeTask, reopenTask, leads, currentEmployee, company } = useCrm();
  const [scope, setScope] = useState<'my' | 'all'>('my');
  const { overdue, upcoming } = useOverdueTasks(scope);
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  // Undo banner (parity with the Today queue): completing from the drawer
  // can be reverted within 5 seconds.
  const [lastCompleted, setLastCompleted] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (currentEmployee.role === 'admin' || currentEmployee.role === 'manager') {
      setScope('all');
    } else {
      setScope('my');
    }
  }, [currentEmployee.role]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const handleComplete = (t: FollowUpTask) => {
    completeTask(t.id);
    setLastCompleted({ id: t.id, title: t.title });
    setTimeout(() => setLastCompleted((prev) => (prev?.id === t.id ? null : prev)), 5000);
  };

  const handleUndo = () => {
    if (!lastCompleted) return;
    reopenTask(lastCompleted.id);
    setLastCompleted(null);
  };

  const renderRow = (t: FollowUpTask) => {
    const lead = leadById.get(t.lead_id);
    if (!lead) return null;
    return (
      <div key={t.id} className="mb-2 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <TaskRow
          task={t}
          lead={lead}
          variant="compact"
          onSelectLead={(l) => {
            onSelectLead?.(l.id);
            onClose();
          }}
          onOpenWhatsAppScript={(l) => onOpenWhatsAppScript?.(l)}
          onComplete={handleComplete}
          onReopen={reopenTask}
        />
      </div>
    );
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-900/30 z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden
      />
      <aside
        className={`fixed top-0 right-0 z-50 w-full sm:w-96 h-screen bg-white border-l border-slate-200 flex flex-col transform transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Task alerts</h2>
            <p className="text-[11px] text-slate-500">{overdue.length} overdue · {upcoming.length} upcoming</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
          {isManagerOrAdmin ? (
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md text-[11px]">
              <button
                onClick={() => setScope('my')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  scope === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My tasks
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All team
              </button>
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-slate-600 px-1">My tasks</div>
          )}
          <div className="text-[11px] text-slate-500">{company.name}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Undo banner */}
          {lastCompleted && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <span className="truncate font-medium">
                Completed “{lastCompleted.title}”
              </span>
              <button
                onClick={handleUndo}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-300 hover:bg-emerald-100 font-semibold transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Undo
              </button>
            </div>
          )}

          {overdue.length === 0 && upcoming.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">All caught up</p>
              <p className="text-xs mt-1">No overdue or upcoming tasks in this view.</p>
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <section>
                  <div className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Overdue ({overdue.length})
                  </div>
                  {overdue.map(renderRow)}
                </section>
              )}
              {upcoming.length > 0 && (
                <section className="mt-4">
                  <div className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Upcoming ({upcoming.length})
                  </div>
                  {upcoming.map(renderRow)}
                </section>
              )}
            </>
          )}
        </div>

        <footer className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500">
          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">esc</kbd> to close
        </footer>
      </aside>
    </>
  );
};
