import React, { useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { computeSlaTrend } from '../../utils/analytics';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Activity } from 'lucide-react';

/** Daily first-contact-within-2h SLA compliance over the last 30 days.
 *  Days with no eligible leads render as gaps (not fabricated zeros). */
export const SlaTrendChart: React.FC = () => {
  const { leads } = useCrm();

  const points = useMemo(() => computeSlaTrend(leads, 30), [leads]);

  const summary = useMemo(() => {
    const valid = points.filter((p) => p.compliancePct !== null);
    const totalEligible = points.reduce((acc, p) => acc + p.eligible, 0);
    const totalCompliant = points.reduce((acc, p) => acc + p.contactedInSla, 0);
    return {
      avg: totalEligible > 0 ? Math.round((totalCompliant / totalEligible) * 100) : null,
      chartedDays: valid.length,
      totalEligible,
      totalCompliant,
    };
  }, [points]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">First-Contact SLA Compliance (30 Days)</h2>
            <p className="text-xs text-slate-500">
              Share of leads first-contacted within the 2-hour SLA, per creation day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span
            className={`px-2.5 py-1 rounded-md border font-bold ${
              summary.avg === null
                ? 'bg-slate-50 border-slate-200 text-slate-500'
                : summary.avg >= 80
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : summary.avg >= 50
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            30-day average: {summary.avg === null ? '—' : `${summary.avg}%`}
          </span>
          <span className="text-slate-500 hidden sm:inline">
            {summary.totalCompliant}/{summary.totalEligible} leads on-SLA
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={2} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: 'none',
                borderRadius: 8,
                fontSize: 11,
                color: '#f1f5f9',
              }}
              formatter={(value: unknown, name: unknown) => [value === null || value === undefined ? 'no data' : `${value}%`, String(name ?? '')]}
              labelFormatter={(label: unknown) => `${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="compliancePct"
              name="SLA compliance"
              stroke="#e11d48"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-400">
        Gaps are days with no leads older than the 2-hour SLA window. Counsellors see their own
        leads only; managers/admins see the whole org.
      </p>
    </div>
  );
};

export default SlaTrendChart;
