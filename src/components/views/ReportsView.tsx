import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { TaskPriorityDashboard } from '../reports/TaskPriorityDashboard';
import { Lead } from '../../types';
import {
  getStageLabel,
  isNextActionOverdue,
  formatBdDateTime,
} from '../../utils/crm-logic';
import {
  BarChart3,
  FileText,
  Database,
  Copy,
  Check,
  TrendingUp,
  Download,
  Calendar,
  CheckSquare,
  FileSpreadsheet,
  Filter,
  Sparkles,
  Users,
  CheckCircle2,
  Table,
  Clock,
  Flame,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { leads, payments, employees, visits, sources, company } = useCrm();

  const [activeReportTab, setActiveReportTab] = useState<'daily' | 'weekly' | 'tasks' | 'sql' | 'export'>('daily');
  const [copiedSql, setCopiedSql] = useState(false);
  const [hasRecentlyExported, setHasRecentlyExported] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'open' | 'hot' | 'paid' | 'overdue'>('all');

  // Filter out internal archived duplicates
  const allPipelineLeads = leads.filter((l) => !l.duplicate_of);

  // Daily report metrics
  const now = new Date();
  const leadsYesterday = allPipelineLeads.filter((l) => {
    const diff = (now.getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
    return diff <= 24;
  });

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

  // Real-time Executive KPI Summary Metrics for Managers
  const totalActiveLeads = allPipelineLeads.filter((l) => !['lost', 'enrolled'].includes(l.stage)).length;
  const hotActiveLeads = allPipelineLeads.filter((l) => !['lost', 'enrolled'].includes(l.stage) && l.temperature === 'hot').length;
  const newActiveLeads = allPipelineLeads.filter((l) => l.stage === 'new').length;

  const convertedLeadsCount = allPipelineLeads.filter((l) => l.stage === 'paid' || l.stage === 'enrolled').length;
  const conversionRate = allPipelineLeads.length > 0
    ? ((convertedLeadsCount / allPipelineLeads.length) * 100).toFixed(1)
    : '0.0';

  const totalPaymentCollected = totalPaid;
  const verifiedPaymentsCount = payments.length;

  const attendedVisitsCount = visits.filter((v) => v.status === 'attended').length;
  const scheduledVisitsCount = visits.filter((v) => v.status === 'booked' || v.status === 'confirmed').length;

  // Funnel Stage Counts
  const funnelStages = [
    { stage: 'new', label: '1. Inbound Leads', count: allPipelineLeads.length },
    {
      stage: 'contacted',
      label: '2. Contacted (First Outreach)',
      count: allPipelineLeads.filter((l) => l.first_contact_at !== null).length,
    },
    {
      stage: 'consultation',
      label: '3. Consultations Scheduled',
      count: allPipelineLeads.filter((l) =>
        ['consultation_booked', 'consultation_done', 'office_visit_booked', 'office_visit_done', 'paid'].includes(
          l.stage
        )
      ).length,
    },
    {
      stage: 'visit',
      label: '4. Office Visits Booked/Done',
      count: allPipelineLeads.filter((l) =>
        ['office_visit_booked', 'office_visit_done', 'paid', 'enrolled'].includes(l.stage)
      ).length,
    },
    {
      stage: 'paid',
      label: '5. Paid / Enrolled Students',
      count: allPipelineLeads.filter((l) => l.stage === 'paid' || l.stage === 'enrolled').length,
    },
  ];

  // Filter leads based on selected export scope
  const getScopedLeads = (): Lead[] => {
    switch (exportScope) {
      case 'open':
        return allPipelineLeads.filter((l) => !['lost', 'enrolled', 'paid'].includes(l.stage));
      case 'hot':
        return allPipelineLeads.filter((l) => l.temperature === 'hot' && l.stage !== 'lost');
      case 'paid':
        return allPipelineLeads.filter((l) => l.stage === 'paid' || l.stage === 'enrolled');
      case 'overdue':
        return allPipelineLeads.filter((l) => isNextActionOverdue(l));
      case 'all':
      default:
        return allPipelineLeads;
    }
  };

  const scopedLeads = getScopedLeads();

  // CSV Generator function
  const handleExportCsv = (leadsToExport: Lead[], label: string) => {
    const headers = [
      'Lead ID',
      'Student Name',
      'Phone (E.164)',
      'Phone (Raw)',
      'WhatsApp (E.164)',
      'Email',
      'City',
      'Country',
      'Pipeline Stage Code',
      'Pipeline Status Label',
      'Temperature',
      'Score (0-100)',
      'Target Degree',
      'Target Programme',
      'Target Intake',
      'Education Level',
      'Last Academic Result GPA',
      'English Proficiency',
      'Funding Confirmed',
      'Parent/Guardian Involved',
      'Has Valid Passport',
      'Lead Source Name',
      'Source Channel',
      'Assigned Counsellor',
      'Counsellor Email',
      'First Contact Date',
      'Next Action Due Date',
      'Next Action Note',
      'Next Action Overdue',
      'Lost Exit Reason',
      'Lost Note',
      'Created Date',
      'Last Updated Date',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leadsToExport.map((l) => {
      const owner = employees.find((e) => e.id === l.owner_id);
      const source = sources.find((s) => s.id === l.source_id);
      const stageLabel = getStageLabel(l.stage);
      const isOverdue = isNextActionOverdue(l);

      return [
        escapeCsv(l.id),
        escapeCsv(l.full_name),
        escapeCsv(l.phone_e164),
        escapeCsv(l.phone_raw),
        escapeCsv(l.whatsapp_e164),
        escapeCsv(l.email || ''),
        escapeCsv(l.city),
        escapeCsv(l.country || 'Bangladesh'),
        escapeCsv(l.stage),
        escapeCsv(stageLabel),
        escapeCsv(l.temperature),
        escapeCsv(l.score),
        escapeCsv(l.target_degree),
        escapeCsv(l.target_programme),
        escapeCsv(l.target_intake),
        escapeCsv(l.education_level),
        escapeCsv(l.last_result),
        escapeCsv(l.english_level),
        escapeCsv(l.funding_confirmed ? 'Yes' : 'No'),
        escapeCsv(l.parent_involved ? 'Yes' : 'No'),
        escapeCsv(l.has_passport ? 'Yes' : 'No'),
        escapeCsv(source?.name || 'Direct'),
        escapeCsv(source?.channel || ''),
        escapeCsv(owner?.full_name || 'Unassigned'),
        escapeCsv(owner?.email || ''),
        escapeCsv(l.first_contact_at || ''),
        escapeCsv(l.next_action_at || ''),
        escapeCsv(l.next_action_note || ''),
        escapeCsv(isOverdue ? 'Yes' : 'No'),
        escapeCsv(l.lost_reason_id || ''),
        escapeCsv(l.lost_note || ''),
        escapeCsv(l.created_at),
        escapeCsv(l.updated_at),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    // Prepend UTF-8 BOM (\uFEFF) for compatibility with Excel and Bangla characters
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    const scopeSlug = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const compSlug = (company.slug || 'crm').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.href = url;
    link.download = `${compSlug}_leads_${scopeSlug}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setHasRecentlyExported(true);
    setTimeout(() => setHasRecentlyExported(false), 2500);
  };

  const starterSqlScript = `-- ${company.name} Multi-Tenant Starter Database Schema & Analytics Views
-- Designed for Supabase / PostgreSQL (October 2026)

create type lead_stage as enum (
  'new','contacted','qualified','consultation_booked','consultation_done',
  'office_visit_booked','office_visit_done','paid','enrolled','lost','nurture'
);

-- View: v_daily_new_leads
create or replace view v_daily_new_leads as
select 
  l.source_id,
  s.name as source_name,
  count(*) as new_leads_count,
  count(*) filter (where l.temperature = 'hot') as hot_leads_count
from leads l
left join lead_sources s on s.id = l.source_id
where l.created_at >= (now() - interval '24 hours')
group by l.source_id, s.name;

-- View: v_sla_breaches (2 working hours SLA)
create or replace view v_sla_breaches as
select 
  l.id,
  l.full_name,
  l.phone_e164,
  l.owner_id,
  e.full_name as counsellor_name,
  l.created_at,
  extract(epoch from (now() - l.created_at))/3600 as hours_uncontacted
from leads l
join employees e on e.id = l.owner_id
where l.stage = 'new'
  and l.first_contact_at is null
  and l.created_at < (now() - interval '2 hours');

-- View: v_hot_attention (Escalations for Jahid)
create or replace view v_hot_attention as
select 
  l.id,
  l.full_name,
  l.temperature,
  l.stage,
  l.created_at,
  e.full_name as owner_name
from leads l
left join employees e on e.id = l.owner_id
where l.temperature = 'hot'
  and (
    (l.stage not in ('office_visit_booked','office_visit_done','paid','lost') and l.created_at < (now() - interval '3 days'))
    or (l.stage = 'office_visit_done' and l.updated_at < (now() - interval '7 days'))
    or (l.stage = 'lost')
  );`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(starterSqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Quick Export Action */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Automated Monitoring & Strategic Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized metrics for Grok Bot / Email delivery · Weekly scorecard · CSV reporting & PostgreSQL views
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick 1-Click Export CSV button accessible on every tab */}
          <button
            onClick={() => handleExportCsv(allPipelineLeads, 'pipeline_all')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg shadow-2xs transition-all cursor-pointer"
            title="Download full pipeline dataset in CSV format"
          >
            {hasRecentlyExported ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-200" />
                <span>CSV Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Pipeline CSV ({allPipelineLeads.length})</span>
              </>
            )}
          </button>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveReportTab('daily')}
              className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeReportTab === 'daily' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Brief
            </button>
            <button
              onClick={() => setActiveReportTab('weekly')}
              className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeReportTab === 'weekly' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Funnel & Scorecard
            </button>
            <button
              onClick={() => setActiveReportTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeReportTab === 'tasks' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Task Analytics (30D)</span>
            </button>
            <button
              onClick={() => setActiveReportTab('export')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeReportTab === 'export' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pipeline CSV Export</span>
            </button>
            <button
              onClick={() => setActiveReportTab('sql')}
              className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeReportTab === 'sql' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SQL Views
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Executive Summary Cards Row for Managers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Active Leads */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Active Leads
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
                {totalActiveLeads}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                / {allPipelineLeads.length} total
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{newActiveLeads} new inbound</span>
            <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
              <Flame className="w-3 h-3 text-rose-500 shrink-0" />
              <span>{hotActiveLeads} Hot</span>
            </span>
          </div>
        </div>

        {/* Card 2: Conversion Rate */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Conversion Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
                {conversionRate}%
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold text-[11px]">
                Target: 15%+
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Funnel Outcome</span>
            <span className="font-mono font-medium text-slate-700">
              {convertedLeadsCount} of {allPipelineLeads.length} enrolled
            </span>
          </div>
        </div>

        {/* Card 3: Total Payment Collected */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Payment Collected
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
                ৳{totalPaymentCollected.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Verified Revenue</span>
            <span className="font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
              {verifiedPaymentsCount} transactions
            </span>
          </div>
        </div>

        {/* Card 4: Office Visits Attended */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Office Visits Attended
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
                {attendedVisitsCount}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                / {visits.length} scheduled
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Key Conversion Driver</span>
            <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">
              {scheduledVisitsCount} upcoming
            </span>
          </div>
        </div>
      </div>

      {/* Tab 1: Daily Morning Report */}
      {activeReportTab === 'daily' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase text-slate-400">Scheduled 09:30 AM Brief</span>
              <h2 className="text-lg font-bold text-slate-900">
                {company.name} Daily Executive Snapshot
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-mono">Date: {new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono tabular-nums">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-sans text-slate-500">New Leads (24 Hours)</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{leadsYesterday.length}</div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-xs font-sans text-emerald-800">Verified Revenue</div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">
                {totalPaid.toLocaleString()} {company.currency_code}
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-sans text-blue-800">Confirmed Office Visits</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {visits.filter((v) => v.status === 'confirmed' || v.status === 'booked').length}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              Lead Inflow by Source & Channel
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {sources.map((s) => {
                const count = allPipelineLeads.filter((l) => l.source_id === s.id).length;
                return (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-50 border border-slate-100 rounded-md flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{s.name}</span>
                      <div className="text-[11px] text-slate-400 font-mono">Channel: {s.channel}</div>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{count} leads</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Funnel & Scorecard */}
      {activeReportTab === 'weekly' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Weekly Lead Pipeline Conversion Funnel
            </h2>
            <div className="space-y-3">
              {funnelStages.map((step) => {
                const maxCount = funnelStages[0].count || 1;
                const percentage = Math.round((step.count / maxCount) * 100);

                return (
                  <div key={step.stage} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800">{step.label}</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {step.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Task Completion by Priority Dashboard (Recharts Visualizations) */}
      {activeReportTab === 'tasks' && <TaskPriorityDashboard />}

      {/* Tab 4: Comprehensive CSV Pipeline Data Export Center */}
      {activeReportTab === 'export' && (
        <div className="space-y-6">
          {/* Main Export Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Export Pipeline Leads to CSV
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Generate RFC-4180 compliant CSV exports with complete lead profiles, qualification scores, next action deadlines, and counsellor allocations.
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleExportCsv(scopedLeads, exportScope)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer self-start sm:self-auto"
              >
                {hasRecentlyExported ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>File Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download CSV ({scopedLeads.length} leads)</span>
                  </>
                )}
              </button>
            </div>

            {/* Scope Selection Pills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Select Export Scope:</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  {
                    id: 'all',
                    title: 'All Leads',
                    desc: 'Complete database',
                    count: allPipelineLeads.length,
                    icon: Users,
                  },
                  {
                    id: 'open',
                    title: 'Open Pipeline',
                    desc: 'Active prospects',
                    count: allPipelineLeads.filter((l) => !['lost', 'enrolled', 'paid'].includes(l.stage)).length,
                    icon: Clock,
                  },
                  {
                    id: 'hot',
                    title: 'Hot Leads',
                    desc: 'Score 70+ urgency',
                    count: allPipelineLeads.filter((l) => l.temperature === 'hot' && l.stage !== 'lost').length,
                    icon: Flame,
                  },
                  {
                    id: 'paid',
                    title: 'Paid / Enrolled',
                    desc: 'Confirmed students',
                    count: allPipelineLeads.filter((l) => l.stage === 'paid' || l.stage === 'enrolled').length,
                    icon: DollarSign,
                  },
                  {
                    id: 'overdue',
                    title: 'Overdue Actions',
                    desc: 'Pending follow-ups',
                    count: allPipelineLeads.filter((l) => isNextActionOverdue(l)).length,
                    icon: AlertTriangle,
                  },
                ].map((s) => {
                  const Icon = s.icon;
                  const isSelected = exportScope === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setExportScope(s.id as any)}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`} />
                        <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                          {s.count}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 mt-2">{s.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Export Summary Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 text-[11px]">Columns Included</span>
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>33 Standardized CRM Data Fields</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 text-[11px]">Format & Character Encoding</span>
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>UTF-8 with BOM (Excel & Google Sheets ready)</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 text-[11px]">Recommended Use</span>
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Board packs, Intake modeling, Bi-weekly audits</span>
                </div>
              </div>
            </div>

            {/* Live Data Sample Preview Table */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-slate-500" />
                  <span>Data Preview ({scopedLeads.slice(0, 5).length} of {scopedLeads.length} leads in export)</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Showing top rows from export payload
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Phone (E.164)</th>
                      <th className="py-2.5 px-3">City</th>
                      <th className="py-2.5 px-3">Pipeline Stage</th>
                      <th className="py-2.5 px-3">Urgency</th>
                      <th className="py-2.5 px-3">Target Programme</th>
                      <th className="py-2.5 px-3">Assigned Owner</th>
                      <th className="py-2.5 px-3 text-right">Next Action Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                          No leads in this filter scope
                        </td>
                      </tr>
                    ) : (
                      scopedLeads.slice(0, 5).map((l) => {
                        const owner = employees.find((e) => e.id === l.owner_id);
                        const isOverdue = isNextActionOverdue(l);
                        return (
                          <tr key={l.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{l.full_name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{l.phone_e164 || l.phone_raw}</td>
                            <td className="py-2.5 px-3 text-slate-600">{l.city}</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">
                                {getStageLabel(l.stage)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                  l.temperature === 'hot'
                                    ? 'bg-rose-100 text-rose-800'
                                    : l.temperature === 'warm'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {l.temperature} ({l.score}pt)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 max-w-[160px] truncate">
                              {l.target_programme}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {owner?.full_name.split(' ')[0] || 'Unassigned'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                              <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                                {formatBdDateTime(l.next_action_at)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Download CTA Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-mono">
                Filename:{' '}
                <strong className="text-slate-800">
                  {(company.slug || 'crm').toLowerCase()}_leads_{exportScope}_{new Date().toISOString().slice(0, 10)}.csv
                </strong>
              </span>

              <button
                onClick={() => handleExportCsv(scopedLeads, exportScope)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Full CSV Export ({scopedLeads.length} rows)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: SQL Views Schema */}
      {activeReportTab === 'sql' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  PostgreSQL & Supabase Reporting Views
                </h2>
                <p className="text-xs text-slate-500">
                  Ready to deploy in your Supabase project for Grok Bot read-only report querying
                </p>
              </div>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL' : 'Copy SQL Script'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed max-h-[500px]">
            {starterSqlScript}
          </pre>
        </div>
      )}
    </div>
  );
};
