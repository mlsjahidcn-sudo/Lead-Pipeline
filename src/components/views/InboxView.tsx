import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, LeadStage, LeadTemperature } from '../../types';
import {
  calculateSlaInfo,
  formatBdDateTime,
  isNextActionOverdue,
  getStageLabel,
} from '../../utils/crm-logic';
import { getLeadLastContacted, calculateDaysDormant } from '../../utils/automated-scheduling';
import {
  Search,
  Filter,
  Phone,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
  Download,
  Users,
  Sparkles,
  Gauge,
  Star,
  X,
} from 'lucide-react';

interface InboxViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onOpenNewLead: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  onSelectLead,
  onOpenWhatsAppScript,
  onOpenNewLead,
}) => {
  const { leads, activities, employees, sources, updateLead, currentEmployee, getLeadScoreWeight, company } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterTemp, setFilterTemp] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterWeight, setFilterWeight] = useState<string>('all');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'hot' | 'overdue' | 'open' | 'paid'>('all');

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    // Exclude archived duplicates
    if (lead.duplicate_of) return false;

    // Search query (name, phone number, current pipeline status, city, programme)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = lead.full_name.toLowerCase().includes(q);
      const matchPhone =
        (lead.phone_raw || '').toLowerCase().includes(q) ||
        (lead.phone_e164 || '').toLowerCase().includes(q) ||
        (lead.whatsapp_e164 || '').toLowerCase().includes(q);
      const stageLabel = getStageLabel(lead.stage).toLowerCase();
      const stageRaw = lead.stage.toLowerCase();
      const stageSpaced = lead.stage.replace(/_/g, ' ').toLowerCase();
      const matchStatus = stageLabel.includes(q) || stageRaw.includes(q) || stageSpaced.includes(q);
      const matchCity = lead.city.toLowerCase().includes(q);
      const matchProg =
        lead.target_programme.toLowerCase().includes(q) ||
        lead.target_degree.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchStatus && !matchCity && !matchProg) return false;
    }

    // Tab filtering
    if (activeTab === 'new' && lead.stage !== 'new') return false;
    if (activeTab === 'hot' && lead.temperature !== 'hot') return false;
    if (activeTab === 'overdue' && !isNextActionOverdue(lead)) return false;
    if (activeTab === 'open' && ['lost', 'enrolled', 'paid'].includes(lead.stage)) return false;
    if (activeTab === 'paid' && lead.stage !== 'paid') return false;

    // Overdue toggle
    if (filterOverdueOnly && !isNextActionOverdue(lead)) return false;

    // Dropdown filters
    if (filterOwner !== 'all' && lead.owner_id !== filterOwner) return false;
    if (filterSource !== 'all' && lead.source_id !== filterSource) return false;
    if (filterTemp !== 'all' && lead.temperature !== filterTemp) return false;
    if (filterStage !== 'all' && lead.stage !== filterStage) return false;

    // Lead score weight filter (1-10)
    if (filterWeight !== 'all') {
      const w = lead.score_weight || getLeadScoreWeight(lead).weight;
      if (filterWeight === 'high' && w < 8) return false;
      if (filterWeight === 'medium' && (w < 5 || w > 7)) return false;
      if (filterWeight === 'low' && w > 4) return false;
    }

    return true;
  });

  // Export CSV helper
  const handleExportCsv = () => {
    const headers = [
      'Name',
      'Phone',
      'Email',
      'City',
      'Stage',
      'Score Weight (1-10)',
      'Temperature',
      'Qualification Score (0-100)',
      'Profile Completion %',
      'Activity Count',
      'Target Degree',
      'Target Intake',
      'Owner',
      'Next Action Due',
      'Created At',
    ];
    const rows = filteredLeads.map((l) => {
      const owner = employees.find((e) => e.id === l.owner_id);
      const wResult = getLeadScoreWeight(l);
      return [
        `"${l.full_name}"`,
        `"${l.phone_e164 || l.phone_raw}"`,
        `"${l.email || ''}"`,
        `"${l.city}"`,
        `"${l.stage}"`,
        wResult.weight,
        `"${l.temperature}"`,
        l.score,
        `${wResult.profileCompletionPercentage}%`,
        wResult.activityCount,
        `"${l.target_degree}"`,
        `"${l.target_intake}"`,
        `"${owner?.full_name || 'Unassigned'}"`,
        `"${l.next_action_at || ''}"`,
        `"${l.created_at}"`,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const compSlug = (company.slug || 'crm').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `${compSlug}_leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Metrics summary
  const totalOpen = leads.filter((l) => !['lost', 'enrolled', 'paid'].includes(l.stage)).length;
  const totalHot = leads.filter((l) => l.temperature === 'hot' && l.stage !== 'lost').length;
  const totalOverdue = leads.filter((l) => isNextActionOverdue(l)).length;
  const totalNew = leads.filter((l) => l.stage === 'new').length;

  return (
    <div className="space-y-4">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Lead Inbox & Contact Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rule: 2-hour SLA for first contact · No open lead without next action date
          </p>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
            <span className="text-slate-500">New Queue:</span>
            <span className="font-mono font-bold text-blue-600 tabular-nums">{totalNew}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-md">
            <span className="text-rose-700">Hot Leads:</span>
            <span className="font-mono font-bold text-rose-700 tabular-nums">{totalHot}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md">
            <span className="text-amber-800">Overdue:</span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">{totalOverdue}</span>
          </div>

          <button
            onClick={handleExportCsv}
            title="Download CSV report"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs (Interactive Segmented Controls) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'all', label: `All (${leads.length})` },
            { id: 'new', label: `New Inbound (${totalNew})` },
            { id: 'hot', label: `Hot (${totalHot})` },
            { id: 'overdue', label: `Overdue Action (${totalOverdue})` },
            { id: 'open', label: `Open Pipeline (${totalOpen})` },
            { id: 'paid', label: `Paid / Converted` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone (+880...), or pipeline status..."
            className="w-full text-xs pl-8 pr-8 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-400 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
              title="Clear search query"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80">
        <div className="flex items-center gap-1 text-slate-600 font-semibold">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span>Filters:</span>
        </div>

        {/* Pipeline Stage filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Status:</span>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="all">All Pipeline Statuses</option>
            <option value="new">New Inbound</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="consultation_booked">Consultation Booked</option>
            <option value="consultation_done">Consultation Done</option>
            <option value="office_visit_booked">Office Visit Booked</option>
            <option value="office_visit_done">Office Visit Done</option>
            <option value="paid">Paid Student</option>
            <option value="enrolled">Enrolled</option>
            <option value="lost">Lost / Closed</option>
            <option value="nurture">Nurture</option>
          </select>
        </div>

        {/* Owner filter (managers/admins only — counsellor data is already self-scoped) */}
        {isManagerOrAdmin && (
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Owner:</span>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Counsellors</option>
              {employees
                .filter((e) => e.role === 'counsellor' || e.role === 'manager')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.role})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Source filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Source:</span>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="all">All Lead Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Urgency:</span>
          <select
            value={filterTemp}
            onChange={(e) => setFilterTemp(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="all">All Temperatures</option>
            <option value="hot">Hot (Score 70+)</option>
            <option value="warm">Warm (Score 40–69)</option>
            <option value="cold">Cold (&lt;40)</option>
          </select>
        </div>

        {/* Lead Score Weight filter (1-10) */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Weight:</span>
          <select
            value={filterWeight}
            onChange={(e) => setFilterWeight(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-indigo-900 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="all">All Weights (1-10)</option>
            <option value="high">High Priority (8–10)</option>
            <option value="medium">Medium Priority (5–7)</option>
            <option value="low">Low Priority (1–4)</option>
          </select>
        </div>

        {/* Result summary and clear button */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            Showing <strong className="text-slate-900">{filteredLeads.length}</strong> of {leads.length}
          </span>

          {(filterOwner !== 'all' ||
            filterSource !== 'all' ||
            filterTemp !== 'all' ||
            filterStage !== 'all' ||
            filterWeight !== 'all' ||
            searchQuery !== '') && (
            <button
              onClick={() => {
                setFilterOwner('all');
                setFilterSource('all');
                setFilterTemp('all');
                setFilterStage('all');
                setFilterWeight('all');
                setSearchQuery('');
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main High-Density Leads Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Student & Location</th>
                <th className="py-3 px-3">Contact & Quick Script</th>
                <th className="py-3 px-3">Target in China</th>
                <th className="py-3 px-3">Owner</th>
                <th className="py-3 px-3">Stage</th>
                <th className="py-3 px-3">Score Weight (1-10)</th>
                <th className="py-3 px-3">First Contact SLA</th>
                <th className="py-3 px-4 text-right">Next Action Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="font-medium text-slate-700">No student leads found matching filters.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try resetting your search query or add a new lead.
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        onClick={onOpenNewLead}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
                      >
                        + Create Lead
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const owner = employees.find((e) => e.id === lead.owner_id);
                  const source = sources.find((s) => s.id === lead.source_id);
                  const sla = calculateSlaInfo(lead.created_at, lead.first_contact_at);
                  const isOverdue = isNextActionOverdue(lead);

                  const { lastContactedAt } = getLeadLastContacted(lead, activities);
                  const daysDormant = calculateDaysDormant(lastContactedAt);
                  const isDormant = daysDormant >= 3 && !['lost', 'enrolled'].includes(lead.stage);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* 1. Student Name & Location */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {lead.full_name}
                          </span>
                          {isDormant && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                              title={`No contact for ${Math.floor(daysDormant)} days - automated follow-up suggested`}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                              {Math.floor(daysDormant)}d idle
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{lead.city}</span>
                          <span className="mx-1">·</span>
                          <span className="text-slate-400">{source?.name || 'Direct'}</span>
                        </div>
                      </td>

                      {/* 2. Contact & Quick Script */}
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${lead.phone_e164}`}
                            title={`Call ${lead.phone_e164}`}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => onOpenWhatsAppScript(lead)}
                            title="Open WhatsApp Script"
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-medium text-[11px] transition-colors"
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-1">
                          {lead.phone_e164 || lead.phone_raw}
                        </div>
                      </td>

                      {/* 3. Target in China */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 line-clamp-1">
                          {lead.target_degree}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {lead.target_intake}
                        </div>
                      </td>

                      {/* 4. Owner */}
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700">
                          {owner?.full_name || 'Unassigned'}
                        </span>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                          {owner?.role}
                        </div>
                      </td>

                      {/* 5. Stage */}
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.stage}
                          onChange={(e) => updateLead(lead.id, { stage: e.target.value as LeadStage })}
                          className="text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 cursor-pointer"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="consultation_booked">Consultation Booked</option>
                          <option value="consultation_done">Consultation Done</option>
                          <option value="office_visit_booked">Visit Booked</option>
                          <option value="office_visit_done">Visit Done</option>
                          <option value="paid">Paid</option>
                          <option value="lost">Lost</option>
                          <option value="nurture">Nurture</option>
                        </select>
                      </td>

                      {/* 6. Lead Score Weight (1-10) & Factors Breakdown */}
                      <td className="py-3 px-3">
                        {(() => {
                          const wResult = getLeadScoreWeight(lead);
                          const isHigh = wResult.weight >= 8;
                          const isMed = wResult.weight >= 5 && wResult.weight <= 7;
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Lead Score Weight (1-10) Badge */}
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border tabular-nums shadow-2xs ${
                                    isHigh
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : isMed
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                  title={`Lead Weight: ${wResult.weight}/10 (${wResult.exactWeight} raw score)\n• Activity Frequency: ${wResult.activityScore}/3.5 (${wResult.activityCount} acts logged)\n• Lead Source: ${wResult.sourceScore}/3.0 (${wResult.sourceName})\n• Profile Completion: ${wResult.profileScore}/3.5 (${wResult.profileCompletionPercentage}% complete)`}
                                >
                                  <Gauge className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>Score {wResult.weight}/10</span>
                                </span>

                                <span
                                  className={`text-[9px] uppercase font-bold px-1 py-0.2 rounded-xs ${
                                    lead.temperature === 'hot'
                                      ? 'bg-rose-100 text-rose-800'
                                      : lead.temperature === 'warm'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {lead.temperature}
                                </span>
                              </div>

                              {/* Breakdown Micro-metrics */}
                              <div
                                className="text-[10px] text-slate-500 font-mono flex items-center gap-1 tabular-nums"
                                title={`Activity: ${wResult.activityScore}/3.5 | Source: ${wResult.sourceScore}/3.0 | Profile: ${wResult.profileScore}/3.5`}
                              >
                                <span className="text-slate-600 font-sans">Prof {wResult.profileCompletionPercentage}%</span>
                                <span className="text-slate-300">·</span>
                                <span>{wResult.activityCount} acts</span>
                                <span className="text-slate-300">·</span>
                                <span className="text-slate-400">{lead.score}pt</span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 7. First Contact SLA */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                            sla.status === 'within_sla'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : sla.status === 'warning'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {sla.label}
                        </span>
                      </td>

                      {/* 8. Next Action Due */}
                      <td className="py-3 px-4 text-right">
                        <div
                          className={`font-mono text-xs ${
                            isOverdue
                              ? 'text-rose-600 font-bold flex items-center gap-1 justify-end'
                              : 'text-slate-700'
                          }`}
                        >
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                          <span>{formatBdDateTime(lead.next_action_at)}</span>
                        </div>
                        {lead.next_action_note && (
                          <div className="text-[11px] text-slate-400 truncate max-w-48 ml-auto mt-0.5">
                            {lead.next_action_note}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
