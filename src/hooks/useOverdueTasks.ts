// Lightweight hook for the overdue / upcoming task counters shown in the
// topbar bell and in the side drawer. Centralised so the badge and the
// drawer never disagree about the count. Window semantics come from the
// shared task-window primitives in utils/automated-scheduling.ts.
import { useMemo } from 'react';
import { useCrm } from '../context/CrmContext';
import { FollowUpTask } from '../types';
import { isTaskOverdue, isTaskUpcoming24h } from '../utils/automated-scheduling';

export interface OverdueBucket {
  overdue: FollowUpTask[];
  upcoming: FollowUpTask[];
  total: number;
}

export function useOverdueTasks(scope: 'my' | 'all' = 'my') {
  const { tasks, currentEmployee } = useCrm();

  return useMemo<OverdueBucket>(() => {
    const now = Date.now();
    const eligible = scope === 'my'
      ? tasks.filter((t) => t.assigned_to === currentEmployee.id && t.status === 'open')
      : tasks.filter((t) => t.status === 'open');

    const overdue: FollowUpTask[] = [];
    const upcoming: FollowUpTask[] = [];
    for (const t of eligible) {
      if (!t.due_at) continue;
      if (isTaskOverdue(t, now)) {
        overdue.push(t);
      } else if (isTaskUpcoming24h(t, now)) {
        upcoming.push(t);
      }
    }
    return { overdue, upcoming, total: overdue.length + upcoming.length };
  }, [tasks, currentEmployee.id, scope]);
}
