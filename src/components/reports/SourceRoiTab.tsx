import React, { useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { computeSourceStats } from '../../utils/analytics';
import { exportSourceScorecardCsv } from '../../utils/csv';
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
import { Download, Target } from 'lucide-react';

/** Per-source ROI: leads → contacted → visits → paid funnel, revenue and
 *  conversion per acquisition channel. */
export const SourceRoiTab: React.FC = () => {
  const { leads, sources, payments, company } = useCrm();

  const stats = useMemo(
    () => computeSourceStats(leads, sources, payments),
    [leads, sources, payments]
  );
  const withLeads = useMemo(() => stats.filter((s) => s.leads > 0), [stats]);

  const chartData = useMemo(
    () =>
      withLeads.slice(0, 10).map((s) => ({
        name: s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name,
        Leads: s.leads,
        Contacted: s.contacted,
        'Visit Stage': s.visits,
        'Paid / Enrolled': s.paid,
      })),
    [withLeads]
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Source ROI & Channel Funnel</h2>
            <p className="text-xs text-slate-500">
              Which acquisition channels actually convert and pay — top 10 by lead volume charted
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => exportSourceScorecardCsv(stats, company.slug)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Scorecard CSV</span>
        </button>
      </div>

      {withLeads.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          No source-attributed leads yet.
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
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
                <Bar dataKey="Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Contacted" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Visit Stage" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Paid / Enrolled" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-2">Channel</th>
                  <th className="py-2.5 px-2 text-right">Leads</th>
                  <th className="py-2.5 px-2 text-right">Contacted</th>
                  <th className="py-2.5 px-2 text-right">Visit Stage</th>
                  <th className="py-2.5 px-2 text-right">Paid</th>
                  <th className="py-2.5 px-2 text-right">Conversion</th>
                  <th className="py-2.5 px-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {stats.map((s) => (
                  <tr key={s.sourceId || 'direct'} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{s.name}</td>
                    <td className="py-2.5 px-2 text-slate-500">{s.channel.replace(/_/g, ' ') || '—'}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.leads}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.contacted}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{s.visits}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-700">{s.paid}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-800">
                      {s.conversionRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                      {s.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SourceRoiTab;
