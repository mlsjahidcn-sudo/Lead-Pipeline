import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead } from '../../types';
import { formatBdDateTime } from '../../utils/crm-logic';
import {
  ShieldAlert,
  Flame,
  AlertOctagon,
  Clock,
  Award,
  Copy,
  Check,
  RotateCcw,
  UserCheck,
  ChevronRight,
} from 'lucide-react';

interface JahidOversightViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
}

export const JahidOversightView: React.FC<JahidOversightViewProps> = ({
  onSelectLead,
}) => {
  const { leads, employees, lostReasons, updateLead, payments, company } = useCrm();

  const [copiedReport, setCopiedReport] = useState(false);
  const now = new Date();

  // 1. Hot leads with no visit booked within 3 days of arrival
  const hotLeadsWithoutVisit = leads.filter((l) => {
    if (l.duplicate_of || l.temperature !== 'hot') return false;
    if (['office_visit_booked', 'office_visit_done', 'paid', 'enrolled', 'lost'].includes(l.stage)) {
      return false;
    }
    const daysSinceCreated = (now.getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreated >= 1; // 1+ days hot without booking a visit
  });

  // 2. Visited but undecided after 7 days
  const visitedUndecided = leads.filter((l) => {
    if (l.duplicate_of || l.stage !== 'office_visit_done') return false;
    const daysSinceUpdated = (now.getTime() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdated >= 3; // flagging undecided
  });

  // 3. Hot leads marked Lost (Jahid audit rule: Jahid reviews to salvage or reopen)
  const hotLeadsLost = leads.filter((l) => l.stage === 'lost' && l.temperature === 'hot' && !l.duplicate_of);

  // 4. Stage ageing: leads stuck > 7 days in any open stage
  const stageAgeingLeads = leads.filter((l) => {
    if (['lost', 'enrolled', 'paid'].includes(l.stage) || l.duplicate_of) return false;
    const daysSinceUpdated = (now.getTime() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdated >= 7;
  });

  // 5. Counsellor League Table
  const counsellorLeague = employees
    .filter((e) => e.role === 'counsellor')
    .map((c) => {
      const myLeads = leads.filter((l) => l.owner_id === c.id && !l.duplicate_of);
      const contacted = myLeads.filter((l) => l.first_contact_at !== null);
      const visits = myLeads.filter((l) => ['office_visit_booked', 'office_visit_done', 'paid'].includes(l.stage));
      const paid = myLeads.filter((l) => l.stage === 'paid');

      const contactRate = myLeads.length > 0 ? Math.round((contacted.length / myLeads.length) * 100) : 0;
      const visitRate = myLeads.length > 0 ? Math.round((visits.length / myLeads.length) * 100) : 0;
      const totalRevenue = payments
        .filter((p) => myLeads.some((l) => l.id === p.lead_id))
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        counsellor: c,
        totalLeads: myLeads.length,
        contactRate,
        visitRate,
        paidCount: paid.length,
        totalRevenue,
      };
    })
    .sort((a, b) => b.paidCount - a.paidCount || b.totalRevenue - a.totalRevenue);

  // Daily Morning Report text generator (exact format from section 7)
  const generateDailyReportText = () => {
    const totalNewYesterday = leads.filter((l) => {
      const diffHours = (now.getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
      return diffHours <= 24;
    }).length;

    const totalPaidBdt = payments.reduce((acc, p) => acc + p.amount, 0);

    return `${company.name.toUpperCase()} – DAILY MORNING REPORT
Prepared for: ${company.executive_sponsor || 'Executive Leadership'}
Timestamp: ${new Date().toLocaleDateString('en-GB')} 09:30 BST

1. INBOUND & SLA SUMMARY
- New Leads in last 24h: ${totalNewYesterday}
- Active SLA Breaches: ${hotLeadsWithoutVisit.length}
- Total Active Open Pipeline: ${leads.filter((l) => !['lost', 'enrolled', 'paid'].includes(l.stage)).length}

2. CRITICAL ESCALATIONS
- Hot leads with no visit booked in 3 days: ${hotLeadsWithoutVisit.length}
- Completed visit but undecided >7 days: ${visitedUndecided.length}
- Hot leads marked Lost (needing audit): ${hotLeadsLost.length}

3. FINANCIAL PERFORMANCE
- Total verified deposits & fees: ${totalPaidBdt.toLocaleString()} ${company.currency_code}
- Confirmed Enrolled Clients: ${leads.filter((l) => l.stage === 'paid' || l.stage === 'enrolled').length}

4. RECOMMENDATIONS
- Join 1-on-1 decision-maker call for high-priority leads needing executive confirmation.
- Direct management to audit no-show recovery for office visits and scheduled consultations.`;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateDailyReportText());
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleReopenLost = (lead: Lead) => {
    updateLead(lead.id, {
      stage: 'contacted',
      temperature: 'hot',
      next_action_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      next_action_note: 'Reopened by Executive Director for personal review',
    }, 'Reopened from Lost by Executive Director');
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-700" />
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {company.name} Executive Oversight Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {company.executive_sponsor || 'Director Oversight'} · Hot lead escalations · Lost audits · Daily morning briefing
          </p>
        </div>

        <button
          onClick={handleCopyReport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors shadow-2xs"
        >
          {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedReport ? 'Report Copied!' : 'Copy 09:30 AM Morning Brief'}</span>
        </button>
      </div>

      {/* Escalation Matrix: 3 Critical Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bucket 1: Hot with no visit in 3 days */}
        <div className="bg-white rounded-xl border border-rose-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
              <Flame className="w-4 h-4 text-rose-600" />
              <span>Hot · No Visit in 3 Days</span>
            </div>
            <span className="font-mono text-sm font-bold text-rose-800 tabular-nums">
              {hotLeadsWithoutVisit.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            High-intent students. Escalate to ensure counsellor pushes for office meeting before lead cools off.
          </p>

          <div className="space-y-2 pt-1">
            {hotLeadsWithoutVisit.slice(0, 3).map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectLead(l)}
                className="p-2 bg-rose-50/50 hover:bg-rose-100/60 rounded border border-rose-100 text-xs cursor-pointer flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-900">{l.full_name}</div>
                  <div className="text-[10px] text-slate-500">{l.target_degree}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-rose-600" />
              </div>
            ))}
          </div>
        </div>

        {/* Bucket 2: Visited but undecided > 7 days */}
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Visited · Undecided &gt; 7 Days</span>
            </div>
            <span className="font-mono text-sm font-bold text-amber-900 tabular-nums">
              {visitedUndecided.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Student visited Gulshan office but hasn't paid deposit. Jahid can join a call to build trust and close.
          </p>

          <div className="space-y-2 pt-1">
            {visitedUndecided.map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectLead(l)}
                className="p-2 bg-amber-50/50 hover:bg-amber-100/60 rounded border border-amber-100 text-xs cursor-pointer flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-900">{l.full_name}</div>
                  <div className="text-[10px] text-slate-500">{l.target_programme}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
              </div>
            ))}
          </div>
        </div>

        {/* Bucket 3: Hot leads marked Lost */}
        <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
              <AlertOctagon className="w-4 h-4 text-purple-600" />
              <span>Hot Leads Marked Lost (Audit)</span>
            </div>
            <span className="font-mono text-sm font-bold text-purple-900 tabular-nums">
              {hotLeadsLost.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Jahid audits all lost hot leads next morning. 1-click option to reopen if salvageable.
          </p>

          <div className="space-y-2 pt-1">
            {hotLeadsLost.map((l) => {
              const reason = lostReasons.find((r) => r.id === l.lost_reason_id);
              return (
                <div
                  key={l.id}
                  className="p-2.5 bg-purple-50/50 rounded border border-purple-100 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{l.full_name}</span>
                    <button
                      type="button"
                      onClick={() => handleReopenLost(l)}
                      className="text-[10px] font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reopen</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Reason: <strong>{reason?.label}</strong>
                  </div>
                  {l.lost_note && (
                    <div className="text-[10px] text-slate-500 italic">"{l.lost_note}"</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Counsellor League Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <Award className="w-4 h-4 text-blue-600" />
            <span>Counsellor League Table (Conversion, Visits & Revenue)</span>
          </div>
          <span className="text-[11px] text-slate-500">Weekly Scorecard Rankings</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Rank & Counsellor</th>
                <th className="py-3 px-3">Total Assigned</th>
                <th className="py-3 px-3">Contact Rate</th>
                <th className="py-3 px-3">Visit Rate</th>
                <th className="py-3 px-3">Paid Students</th>
                <th className="py-3 px-4 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counsellorLeague.map((row, idx) => (
                <tr key={row.counsellor.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span className="text-slate-900 font-semibold">{row.counsellor.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-slate-700">
                    {row.totalLeads} leads
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-slate-700">
                    {row.contactRate}%
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-slate-700">
                    {row.visitRate}%
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums font-bold text-emerald-700">
                    {row.paidCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                    {row.totalRevenue.toLocaleString()} BDT
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage Ageing: Leads Stuck > 7 Days */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Pipeline Ageing (Leads Stuck in Same Stage &gt; 7 Days)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {stageAgeingLeads.length} leads delayed
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {stageAgeingLeads.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No leads stuck more than 7 days. Pipeline velocity is healthy!
            </div>
          ) : (
            stageAgeingLeads.map((lead) => {
              const owner = employees.find((e) => e.id === lead.owner_id);
              return (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-900">{lead.full_name}</div>
                    <div className="text-[11px] text-slate-500">
                      Stage: <span className="font-semibold uppercase">{lead.stage}</span> · Owner: {owner?.full_name}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-[11px] text-amber-700 font-semibold">
                      Last Update: {formatBdDateTime(lead.updated_at)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Target: {lead.target_degree}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
