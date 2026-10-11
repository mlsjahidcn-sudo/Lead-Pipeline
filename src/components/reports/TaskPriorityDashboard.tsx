import React, { useState, useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { TaskPriority } from '../../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Flame,
  AlertCircle,
  Flag,
  CheckCircle2,
  Clock,
  TrendingUp,
  Filter,
  BarChart2,
} from 'lucide-react';

export const TaskPriorityDashboard: React.FC = () => {
  const { tasks, employees } = useCrm();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  const now = new Date();
  const thirtyDaysAgo = useMemo(() => new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), []);

  // Filter tasks within the last 30 days
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Counsellor filter
      if (selectedEmployeeId !== 'all' && t.assigned_to !== selectedEmployeeId) {
        return false;
      }
      // Date in last 30 days
      const taskTime = new Date(t.created_at || t.due_at).getTime();
      return taskTime >= thirtyDaysAgo.getTime();
    });
  }, [tasks, selectedEmployeeId, thirtyDaysAgo]);

  // Aggregate by priority
  const statsByPriority = useMemo(() => {
    const counts: Record<TaskPriority, { total: number; completed: number; open: number }> = {
      high: { total: 0, completed: 0, open: 0 },
      medium: { total: 0, completed: 0, open: 0 },
      low: { total: 0, completed: 0, open: 0 },
    };

    filteredTasks.forEach((t) => {
      const p = t.priority || 'medium';
      counts[p].total += 1;
      if (t.status === 'done') {
        counts[p].completed += 1;
      } else {
        counts[p].open += 1;
      }
    });

    const highRate = counts.high.total > 0 ? Math.round((counts.high.completed / counts.high.total) * 100) : 0;
    const mediumRate = counts.medium.total > 0 ? Math.round((counts.medium.completed / counts.medium.total) * 100) : 0;
    const lowRate = counts.low.total > 0 ? Math.round((counts.low.completed / counts.low.total) * 100) : 0;

    const totalAll = filteredTasks.length;
    const totalCompleted = filteredTasks.filter((t) => t.status === 'done').length;
    const overallRate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;

    return { counts, highRate, mediumRate, lowRate, overallRate, totalAll, totalCompleted };
  }, [filteredTasks]);

  // Bar Chart Data (Comparison of Completed vs Open by Priority)
  const barChartData = useMemo(() => {
    return [
      {
        priority: 'High Priority',
        completed: statsByPriority.counts.high.completed,
        open: statsByPriority.counts.high.open,
        total: statsByPriority.counts.high.total,
        rate: statsByPriority.highRate,
      },
      {
        priority: 'Medium Priority',
        completed: statsByPriority.counts.medium.completed,
        open: statsByPriority.counts.medium.open,
        total: statsByPriority.counts.medium.total,
        rate: statsByPriority.mediumRate,
      },
      {
        priority: 'Low Priority',
        completed: statsByPriority.counts.low.completed,
        open: statsByPriority.counts.low.open,
        total: statsByPriority.counts.low.total,
        rate: statsByPriority.lowRate,
      },
    ];
  }, [statsByPriority]);

  // 4-Week Trend Data over last 30 days
  const trendData = useMemo(() => {
    // 4 periods: Weeks 1, 2, 3, 4
    const weeks = [
      { name: 'W1 (22-30d ago)', startDaysAgo: 30, endDaysAgo: 22 },
      { name: 'W2 (15-21d ago)', startDaysAgo: 21, endDaysAgo: 15 },
      { name: 'W3 (8-14d ago)', startDaysAgo: 14, endDaysAgo: 8 },
      { name: 'W4 (Past 7d)', startDaysAgo: 7, endDaysAgo: 0 },
    ];

    return weeks.map((w) => {
      const startTime = now.getTime() - w.startDaysAgo * 24 * 60 * 60 * 1000;
      const endTime = now.getTime() - w.endDaysAgo * 24 * 60 * 60 * 1000;

      const wTasks = filteredTasks.filter((t) => {
        const tTime = new Date(t.created_at || t.due_at).getTime();
        return tTime >= startTime && tTime <= endTime;
      });

      const calcRate = (priority: TaskPriority) => {
        const group = wTasks.filter((t) => (t.priority || 'medium') === priority);
        if (group.length === 0) return 0;
        const done = group.filter((t) => t.status === 'done').length;
        return Math.round((done / group.length) * 100);
      };

      const highTasks = wTasks.filter((t) => (t.priority || 'medium') === 'high');
      const medTasks = wTasks.filter((t) => (t.priority || 'medium') === 'medium');
      const lowTasks = wTasks.filter((t) => (t.priority || 'medium') === 'low');

      // Weeks without tasks of a priority render as chart gaps (null), not
      // fabricated rates — the old 80/60/50 fallbacks overstated performance.
      return {
        period: w.name,
        highRate: highTasks.length > 0 ? calcRate('high') : null,
        mediumRate: medTasks.length > 0 ? calcRate('medium') : null,
        lowRate: lowTasks.length > 0 ? calcRate('low') : null,
        totalTasks: wTasks.length,
      };
    });
  }, [filteredTasks, now]);

  // Donut Chart Data (Distribution of Completed Tasks by Priority)
  const donutData = useMemo(() => {
    return [
      { name: 'High Priority', value: statsByPriority.counts.high.completed, color: '#e11d48' },
      { name: 'Medium Priority', value: statsByPriority.counts.medium.completed, color: '#f59e0b' },
      { name: 'Low Priority', value: statsByPriority.counts.low.completed, color: '#64748b' },
    ].filter((item) => item.value > 0);
  }, [statsByPriority]);

  return (
    <div className="space-y-6">
      {/* Mini Dashboard Header & Filter Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Task Completion by Priority (Last 30 Days)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Performance analytics across High, Medium, and Low urgency leads · Measured against 30-day resolution window
          </p>
        </div>

        {/* Filter by Counsellor */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Counsellor:</span>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Office Staff</option>
            {employees
              .filter((e) => e.role === 'counsellor' || e.role === 'manager')
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role})
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Completion Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">30-Day Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {statsByPriority.overallRate}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {statsByPriority.totalCompleted} done / {statsByPriority.totalAll} total tasks
          </div>
        </div>

        {/* High Priority Completion Rate */}
        <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 uppercase flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              <span>High Priority Rate</span>
            </span>
            <span className="text-xs font-mono font-bold text-rose-900 px-1.5 py-0.2 bg-rose-200/70 rounded">
              Goal &ge;85%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-900 tabular-nums">
            {statsByPriority.highRate}%
          </div>
          <div className="text-[11px] text-rose-700 font-mono">
            {statsByPriority.counts.high.completed} completed · {statsByPriority.counts.high.open} pending
          </div>
        </div>

        {/* Medium Priority Completion Rate */}
        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Medium Priority Rate</span>
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 tabular-nums">
            {statsByPriority.mediumRate}%
          </div>
          <div className="text-[11px] text-amber-700 font-mono">
            {statsByPriority.counts.medium.completed} completed · {statsByPriority.counts.medium.open} pending
          </div>
        </div>

        {/* Low Priority Completion Rate */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 uppercase flex items-center gap-1">
              <Flag className="w-3.5 h-3.5 text-slate-500" />
              <span>Low Priority Rate</span>
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800 tabular-nums">
            {statsByPriority.lowRate}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {statsByPriority.counts.low.completed} completed · {statsByPriority.counts.low.open} pending
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Bar Chart of Task Volumes & Completion (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Completed vs Open Tasks by Priority
              </h3>
              <p className="text-[11px] text-slate-500">
                Volume of tasks resolved vs pending in the last 30 days
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="priority"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg space-y-1 font-sans">
                          <div className="font-bold border-b border-slate-800 pb-1">{data.priority}</div>
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-400">Completed:</span>
                            <span className="font-mono font-bold tabular-nums">{data.completed}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Open / Pending:</span>
                            <span className="font-mono font-bold tabular-nums">{data.open}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 font-semibold text-blue-300">
                            <span>Completion Rate:</span>
                            <span className="font-mono tabular-nums">{data.rate}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="open" name="Open / Pending" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Donut of Completed Tasks Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Completed Tasks Share by Urgency
              </h3>
              <p className="text-[11px] text-slate-500">
                Proportion of successfully finished tasks by priority tier
              </p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {donutData.length === 0 ? (
              <div className="text-xs text-slate-400 text-center">No completed tasks yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-md shadow font-sans">
                            <span className="font-bold">{data.name}:</span>{' '}
                            <span className="font-mono tabular-nums">{data.value} tasks</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Chart 3: Weekly Completion Rate Trend by Priority */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Weekly Task Completion Rate Trends (%)
            </h3>
            <p className="text-[11px] text-slate-500">
              4-week progression of resolution percentage across High, Medium, and Low priorities
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-600" /> High Priority
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium Priority
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-slate-500" /> Low Priority
            </span>
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg space-y-1 font-sans">
                        <div className="font-bold border-b border-slate-800 pb-1">{data.period}</div>
                        <div className="flex justify-between gap-4 text-rose-300">
                          <span>High Priority:</span>
                          <span className="font-mono font-bold tabular-nums">{data.highRate}%</span>
                        </div>
                        <div className="flex justify-between gap-4 text-amber-300">
                          <span>Medium Priority:</span>
                          <span className="font-mono font-bold tabular-nums">{data.mediumRate}%</span>
                        </div>
                        <div className="flex justify-between gap-4 text-slate-300">
                          <span>Low Priority:</span>
                          <span className="font-mono font-bold tabular-nums">{data.lowRate}%</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="highRate"
                name="High Priority"
                stroke="#e11d48"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#e11d48' }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="mediumRate"
                name="Medium Priority"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3.5, fill: '#f59e0b' }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="lowRate"
                name="Low Priority"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#64748b' }}
                connectNulls={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Priority Performance Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Detailed 30-Day Resolution Ledger by Priority Tier
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            {statsByPriority.totalAll} Total Tracked Tasks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                <th className="py-3 px-4">Priority Tier</th>
                <th className="py-3 px-3">Total Tasks (30D)</th>
                <th className="py-3 px-3">Completed Tasks</th>
                <th className="py-3 px-3">Open / Pending</th>
                <th className="py-3 px-3">Resolution Rate</th>
                <th className="py-3 px-4 text-right">Target SLA Benchmark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-sans font-semibold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>High Priority</span>
                </td>
                <td className="py-3 px-3 text-slate-700">{statsByPriority.counts.high.total}</td>
                <td className="py-3 px-3 text-emerald-700 font-bold">
                  {statsByPriority.counts.high.completed}
                </td>
                <td className="py-3 px-3 text-rose-700 font-bold">{statsByPriority.counts.high.open}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{statsByPriority.highRate}%</span>
                    <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-600 h-full rounded-full"
                        style={{ width: `${statsByPriority.highRate}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-sans text-xs text-rose-800 font-semibold">
                  &le; 24h Outreach (Critical)
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-sans font-semibold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Medium Priority</span>
                </td>
                <td className="py-3 px-3 text-slate-700">{statsByPriority.counts.medium.total}</td>
                <td className="py-3 px-3 text-emerald-700 font-bold">
                  {statsByPriority.counts.medium.completed}
                </td>
                <td className="py-3 px-3 text-amber-700">{statsByPriority.counts.medium.open}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{statsByPriority.mediumRate}%</span>
                    <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${statsByPriority.mediumRate}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-sans text-xs text-slate-600">
                  &le; 48h Follow-up (Standard)
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-sans font-semibold text-slate-900 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Low Priority</span>
                </td>
                <td className="py-3 px-3 text-slate-700">{statsByPriority.counts.low.total}</td>
                <td className="py-3 px-3 text-emerald-700 font-bold">
                  {statsByPriority.counts.low.completed}
                </td>
                <td className="py-3 px-3 text-slate-500">{statsByPriority.counts.low.open}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{statsByPriority.lowRate}%</span>
                    <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-500 h-full rounded-full"
                        style={{ width: `${statsByPriority.lowRate}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-sans text-xs text-slate-400">
                  Weekly / Cadence Nurture
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
