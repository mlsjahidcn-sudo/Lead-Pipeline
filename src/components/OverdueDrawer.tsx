import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Check, Clock, AlertTriangle, X, Users, type LucideIcon } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useOverdueTasks } from '../hooks/useOverdueTasks';
import { FollowUpTask } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectLead?: (leadId: string) => void;
}

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

const TaskRow: React.FC<{
  task: FollowUpTask;
  overdue: boolean;
  onComplete: () => void;
  onSelect: () => void;
}> = ({ task, overdue, onComplete, onSelect }) => {
  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        overdue ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {overdue ? (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          ) : (
            <Clock className="w-4 h-4 text-amber-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900 line-clamp-2">{task.title}</div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
            <span>{task.task_type}</span>
            <span>•</span>
            <span>{overdue ? `Overdue ${formatRelative(task.due_at)}` : `Due ${new Date(task.due_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}</span>
            {task.priority && (
              <>
                <span>•</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  task.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                  task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>{task.priority}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <button
          onClick={onComplete}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 border border-emerald-200 rounded transition-colors"
        >
          <Check className="w-3 h-3" />
          Complete
        </button>
        <button
          onClick={onSelect}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
        >
          Open lead
        </button>
      </div>
    </div>
  );
};

export const OverdueDrawer: React.FC<Props> = ({ open, onClose, onSelectLead }) => {
  const { tasks, completeTask, leads, currentEmployee, company } = useCrm();
  const [scope, setScope] = useState<'my' | 'all'>('my');
  const { overdue, upcoming } = useOverdueTasks(scope);
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

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
                  {overdue.map((t) => (
                    <div key={t.id} className="mb-2">
                      <TaskRow
                        task={t}
                        overdue
                        onComplete={() => completeTask(t.id)}
                        onSelect={() => {
                          onSelectLead?.(t.lead_id);
                          onClose();
                        }}
                      />
                    </div>
                  ))}
                </section>
              )}
              {upcoming.length > 0 && (
                <section className="mt-4">
                  <div className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Upcoming ({upcoming.length})
                  </div>
                  {upcoming.map((t) => (
                    <div key={t.id} className="mb-2">
                      <TaskRow
                        task={t}
                        overdue={false}
                        onComplete={() => completeTask(t.id)}
                        onSelect={() => {
                          onSelectLead?.(t.lead_id);
                          onClose();
                        }}
                      />
                    </div>
                  ))}
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
