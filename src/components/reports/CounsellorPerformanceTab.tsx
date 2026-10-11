import React, { useMemo, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { computeCounsellorStats } from '../../utils/analytics';
import { exportCounsellorScorecardCsv } from '../../utils/csv';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, Users } from 'lucide-react';

/**
 * Per-counsellor performance scorecard: leads, contact rate, visits, paid,
 * revenue, task completion and SLA compliance. Counsellors see only their
 * own row (their bootstrap data is already self-scoped); managers/admins
 * see the whole team.
 */
export const CounsellorPerformanceTab: React.FC = () => {
  const { leads, employees, payments, visits, tasks, currentEmployee, company } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const stats = useMemo(
    () => computeCounsellorStats(leads, employees, payments, visits, tasks),
    [leads, employees, payments, visits, tasks]
  );

  const rows = useMemo(() => {
    const meaningful = stats.filter(
      (s) => s.employeeId === currentEmployee.id || (isManagerOrAdmin && s.leads > 0)
    );
    return [...meaningful].sort((a, b) => b.revenue - a.revenue || b.paid - a.paid);
  }, [stats, currentEmployee.id, isManagerOrAdmin]);

  const chartData = useMemo(
    () =>
      rows.slice(0, 10).map((s) => ({
        name: s.name.split(' ')[0],
        'Paid / Enrolled': s.paid,
        'Visits Attended': s.visitsAttended,
        Revenue: s.revenue,
      })),
    [rows]
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Counsellor Performance</h2>
            <p className="text-xs text-slate-500">
              {isManagerOrAdmin
                ? 'Team scorecard — sorted by revenue contribution'
                : 'Your personal scorecard'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => exportCounsellorScorecardCsv(rows, company.slug)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Scorecard CSV</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          No counsellor activity to report yet.
        </div>
      ) : (
        <>
          {/* Chart: paid / visits / revenue by counsellor */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#f1f5f9',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Paid / Enrolled" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="Visits Attended" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="right" dataKey="Revenue" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Full table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                  <th className="py-2.5 px-3">Counsellor</th>
                  <th className="py-2.5 px-2 text-right">Leads</th>
                  <th className="py-2.5 px-2 text-right">Open</th>
                  <th className="py-2.5 px-2 text-right">Contact %</th>
                  <th className="py-2.5 px-2 text-right">Visits</th>
                  <th className="py-2.5 px-2 text-right">Paid</th>
                  <th className="py-2.5 px-2 text-right">Revenue</th>
                  <th className="py-2.5 px-2 text-right">Tasks done</th>
                  <th className="py-2.5 px-2 text-right">SLA %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {rows.map((s) => (
                  <tr key={s.employeeId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{s.name}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.leads}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.openLeads}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.contactRate.toFixed(0)}%</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.visitsAttended}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-700">{s.paid}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                      {s.revenue.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {s.tasksDone}/{s.tasksTotal}
                      <span className="text-slate-400 ml-1">({s.taskCompletionRate.toFixed(0)}%)</span>
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-bold ${
                        s.slaComplianceRate >= 80
                          ? 'text-emerald-700'
                          : s.slaComplianceRate >= 50
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                      title={`${s.slaCompliant} of ${s.slaEligible} leads first-contacted within 2h`}
                    >
                      {s.slaEligible > 0 ? `${s.slaComplianceRate.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">
            SLA % = leads first-contacted within the 2-hour SLA, of leads created more than 2 hours
            ago. Task completion covers all synced tasks.
          </p>
        </>
      )}
    </div>
  );
};

export default CounsellorPerformanceTab;
