import React, { useMemo, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead } from '../../types';
import { calculateSlaInfo, formatBdDateTime, isNextActionOverdue } from '../../utils/crm-logic';
import {
  Users,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface ManagerViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  onSelectLead,
  onOpenWhatsAppScript,
}) => {
  const {
    leads,
    employees,
    tasks,
    visits,
    sources,
    toggleCounsellorAcceptingLeads,
    reassignLead,
  } = useCrm();

  const [reassignModalLead, setReassignModalLead] = useState<Lead | null>(null);
  const [selectedTargetOwner, setSelectedTargetOwner] = useState(employees[0]?.id || '');

  // Row-render lookups as Maps (avoid leads.find / employees.find per row)
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // 1. SLA Breaches: Uncontacted leads where 2h SLA elapsed
  const slaBreaches = leads.filter((lead) => {
    if (lead.stage !== 'new' || lead.first_contact_at || lead.duplicate_of) return false;
    const sla = calculateSlaInfo(lead.created_at, lead.first_contact_at);
    return sla.status === 'breached';
  });

  // 2. Visits Today & Tomorrow
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const upcomingVisits = visits.filter(
    (v) => v.scheduled_at.startsWith(todayStr) || v.scheduled_at.startsWith(tomorrowStr)
  );

  // 3. Counsellor Performance & Capacity Matrix
  const counsellorMatrix = employees
    .filter((e) => e.role === 'counsellor')
    .map((c) => {
      const assignedLeads = leads.filter((l) => l.owner_id === c.id && !l.duplicate_of);
      const openLeads = assignedLeads.filter((l) => !['lost', 'enrolled', 'paid'].includes(l.stage));
      const counsellorTasks = tasks.filter((t) => t.assigned_to === c.id);
      const overdueTasks = counsellorTasks.filter(
        (t) => t.status === 'open' && new Date(t.due_at).getTime() < now.getTime()
      );
      const visitsDone = visits.filter((v) => v.counsellor_id === c.id && v.status === 'attended');
      const paidStudents = assignedLeads.filter((l) => l.stage === 'paid');

      return {
        counsellor: c,
        totalLeads: assignedLeads.length,
        openLeads: openLeads.length,
        overdueTasksCount: overdueTasks.length,
        visitsAttended: visitsDone.length,
        paidCount: paidStudents.length,
      };
    });

  // 4. Source Breakdown
  const sourceStats = sources.map((s) => {
    const matching = leads.filter((l) => l.source_id === s.id && !l.duplicate_of);
    const visitsCount = matching.filter(
      (l) => l.stage === 'office_visit_booked' || l.stage === 'office_visit_done' || l.stage === 'paid'
    ).length;
    const paidCount = matching.filter((l) => l.stage === 'paid').length;
    return {
      source: s,
      leadsCount: matching.length,
      visitsCount,
      paidCount,
      conversionRate: matching.length > 0 ? ((paidCount / matching.length) * 100).toFixed(1) : '0',
    };
  });

  const handleConfirmReassign = () => {
    if (!reassignModalLead || !selectedTargetOwner) return;
    reassignLead(reassignModalLead.id, selectedTargetOwner);
    setReassignModalLead(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Partner Office Manager Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor 2-hour SLA response times, counsellor capacity, and overdue follow-up bottlenecks
          </p>
        </div>
      </div>

      {/* SLA Breaches (High Alert Banner if any) */}
      <div className="bg-white rounded-xl border border-rose-200 overflow-hidden shadow-2xs">
        <div className="p-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Active SLA Breaches ({slaBreaches.length}) — First Contact Overdue (&gt;2 Hours)</span>
          </div>
          <span className="text-[11px] text-rose-700 font-medium">Escalate or Reassign Immediately</span>
        </div>

        <div className="divide-y divide-slate-100">
          {slaBreaches.length === 0 ? (
            <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50/30 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Zero SLA breaches! All inbound leads contacted within the 2-hour target.</span>
            </div>
          ) : (
            slaBreaches.map((lead) => {
              const owner = employees.find((e) => e.id === lead.owner_id);
              const sla = calculateSlaInfo(lead.created_at, lead.first_contact_at);

              return (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{lead.full_name}</span>
                      <span className="font-mono text-xs text-slate-500">{lead.phone_e164}</span>
                      <span className="text-[11px] text-slate-400">· {lead.city}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span>Assigned to: <strong className="text-slate-800">{owner?.full_name}</strong></span>
                      <span className="text-rose-700 font-mono font-semibold">
                        SLA Overdue: {sla.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setReassignModalLead(lead)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                    >
                      Reassign
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWhatsAppScript(lead)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                    >
                      WhatsApp Lead
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Counsellor Capacity & Overdue Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Counsellor Team Performance & Round-Robin Capacity</span>
          </div>
          <span className="text-[11px] text-slate-400">Pause round-robin if staff on leave</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Counsellor</th>
                <th className="py-3 px-3">Round-Robin Status</th>
                <th className="py-3 px-3">Active Pipeline</th>
                <th className="py-3 px-3">Overdue Follow-ups</th>
                <th className="py-3 px-3">Visits Attended</th>
                <th className="py-3 px-4 text-right">Paid Conversions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counsellorMatrix.map((item) => (
                <tr key={item.counsellor.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.counsellor.full_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {item.counsellor.email}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleCounsellorAcceptingLeads(item.counsellor.id)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        item.counsellor.accepts_new_leads
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {item.counsellor.accepts_new_leads ? 'Accepting Leads (Active)' : 'Paused (On Leave)'}
                    </button>
                  </td>

                  <td className="py-3 px-3 font-mono tabular-nums">
                    <span className="font-bold text-slate-800">{item.openLeads}</span> open / {item.totalLeads} total
                  </td>

                  <td className="py-3 px-3 font-mono tabular-nums">
                    <span
                      className={`font-semibold ${
                        item.overdueTasksCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {item.overdueTasksCount} overdue
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono tabular-nums font-medium text-slate-800">
                    {item.visitsAttended}
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                    {item.paidCount} students
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Upcoming Visits & Lead Source Effectiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visits Today and Tomorrow */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Office Visits Today & Tomorrow ({upcomingVisits.length})</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 p-2">
            {upcomingVisits.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No office visits scheduled for today or tomorrow.
              </div>
            ) : (
              upcomingVisits.map((vis) => {
                const lead = leadById.get(vis.lead_id);
                const counsellor = employeeById.get(vis.counsellor_id);
                if (!lead) return null;

                return (
                  <div
                    key={vis.id}
                    onClick={() => onSelectLead(lead)}
                    className="p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900">{lead.full_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {counsellor?.full_name} · Attendees: {vis.attendees}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-xs font-semibold text-blue-700">
                        {formatBdDateTime(vis.scheduled_at)}
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-slate-600">
                        {vis.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lead Source Conversion Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Channel Conversion Rates</span>
            </div>
            <span className="text-[11px] text-slate-400">Visits & Paid conversions</span>
          </div>

          <div className="p-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-medium text-[11px] border-b border-slate-100 pb-2">
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Leads</th>
                  <th className="pb-2">Visits</th>
                  <th className="pb-2 text-right">Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {sourceStats.map((stat) => (
                  <tr key={stat.source.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-sans font-medium text-slate-800">
                      {stat.source.name}
                    </td>
                    <td className="py-2.5 text-slate-600">{stat.leadsCount}</td>
                    <td className="py-2.5 text-slate-600">{stat.visitsCount}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-700">
                      {stat.conversionRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Quick Reassignment */}
      {reassignModalLead && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full shadow-xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Reassign Student Lead</h3>
            <p className="text-xs text-slate-600">
              Reassign <strong className="text-slate-900">{reassignModalLead.full_name}</strong> to a different counsellor to prevent SLA breaches.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Counsellor Owner
              </label>
              <select
                value={selectedTargetOwner}
                onChange={(e) => setSelectedTargetOwner(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white font-medium"
              >
                {employees
                  .filter((e) => e.role === 'counsellor' && e.id !== reassignModalLead.owner_id)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} {e.accepts_new_leads ? '' : '(Paused)'}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReassignModalLead(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
