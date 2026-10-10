// Lightweight hook for the overdue / upcoming task counters shown in the
// topbar bell and in the side drawer. Centralised so the badge and the
// drawer never disagree about the count.
import { useMemo } from 'react';
import { useCrm } from '../context/CrmContext';
import { FollowUpTask } from '../types';

export interface OverdueBucket {
  overdue: FollowUpTask[];
  upcoming: FollowUpTask[];
  total: number;
}

export function useOverdueTasks(scope: 'my' | 'all' = 'my') {
  const { tasks, currentEmployee } = useCrm();

  return useMemo<OverdueBucket>(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const eligible = scope === 'my'
      ? tasks.filter((t) => t.assigned_to === currentEmployee.id && t.status === 'open')
      : tasks.filter((t) => t.status === 'open');

    const overdue: FollowUpTask[] = [];
    const upcoming: FollowUpTask[] = [];
    for (const t of eligible) {
      if (!t.due_at) continue;
      const dueMs = new Date(t.due_at).getTime();
      if (dueMs < now.getTime()) {
        overdue.push(t);
        continue;
      }
      const diffMin = Math.floor((dueMs - now.getTime()) / 60_000);
      const isToday = t.due_at.startsWith(todayStr);
      if (diffMin >= 0 && (isToday || diffMin <= 24 * 60)) {
        upcoming.push(t);
      }
    }
    return { overdue, upcoming, total: overdue.length + upcoming.length };
  }, [tasks, currentEmployee.id, scope]);
}
