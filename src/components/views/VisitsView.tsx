import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, VisitStatus } from '../../types';
import { formatBdDateTime } from '../../utils/crm-logic';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  MessageSquare,
  Users,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

interface VisitsViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenWhatsAppScript: (lead: Lead) => void;
  onOpenBookVisit: (lead: Lead) => void;
}

export const VisitsView: React.FC<VisitsViewProps> = ({
  onSelectLead,
  onOpenWhatsAppScript,
}) => {
  const { visits, leads, employees, updateVisitStatus, company } = useCrm();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredVisits = visits.filter((v) => {
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  // Metrics
  const bookedCount = visits.filter((v) => v.status === 'booked').length;
  const confirmedCount = visits.filter((v) => v.status === 'confirmed').length;
  const attendedCount = visits.filter((v) => v.status === 'attended').length;
  const noShowCount = visits.filter((v) => v.status === 'no_show').length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            {company.name} Office Visit Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Core conversion principle: Visits convert; chats rarely do · Confirm visits day before by 18:00
          </p>
        </div>

        {/* Location & Map Pin */}
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <span className="font-semibold text-slate-800">Office:</span> {company.office_address}
          </div>
          <a
            href={company.google_maps_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 ml-1 shrink-0 flex items-center gap-0.5 font-medium underline"
          >
            <span>Pin</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3 rounded-lg">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Booked Upcoming</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
            {bookedCount}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <div className="text-[11px] font-semibold text-blue-800 uppercase">Confirmed with Parents</div>
          <div className="text-xl font-bold font-mono text-blue-900 mt-0.5 tabular-nums">
            {confirmedCount}
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase">Attended & Consulted</div>
          <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5 tabular-nums">
            {attendedCount}
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg">
          <div className="text-[11px] font-semibold text-rose-800 uppercase">No-Show Recovery</div>
          <div className="text-xl font-bold font-mono text-rose-900 mt-0.5 tabular-nums">
            {noShowCount}
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
        <span className="text-slate-500 font-medium ml-1">Filter Status:</span>
        {['all', 'booked', 'confirmed', 'attended', 'no_show'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
              filterStatus === st
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st.replace('_', '-')}
          </button>
        ))}
      </div>

      {/* Visits Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Student & Contact</th>
                <th className="py-3 px-3">Attendees (Parents)</th>
                <th className="py-3 px-3">Counsellor</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions & Outcomes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No office visits found under this filter.
                  </td>
                </tr>
              ) : (
                filteredVisits.map((vis) => {
                  const lead = leads.find((l) => l.id === vis.lead_id);
                  const counsellor = employees.find((e) => e.id === vis.counsellor_id);
                  if (!lead) return null;

                  return (
                    <tr
                      key={vis.id}
                      onClick={() => onSelectLead(lead)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 font-mono">
                          {formatBdDateTime(vis.scheduled_at)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Duration: {vis.duration_min} mins
                        </div>
                      </td>

                      {/* Student */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 hover:text-blue-600">
                          {lead.full_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {lead.phone_e164 || lead.phone_raw}
                        </div>
                      </td>

                      {/* Attendees */}
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-800">{vis.attendees}</span>
                        {lead.parent_involved && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Parent Attending
                          </div>
                        )}
                      </td>

                      {/* Counsellor */}
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700">
                          {counsellor?.full_name || 'Unassigned'}
                        </span>
                      </td>

                      {/* Mode */}
                      <td className="py-3 px-3">
                        <span className="capitalize font-medium text-slate-600">{vis.mode}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block text-[11px] uppercase font-semibold px-2 py-0.5 rounded ${
                            vis.status === 'confirmed'
                              ? 'bg-blue-100 text-blue-800'
                              : vis.status === 'attended'
                              ? 'bg-emerald-100 text-emerald-800'
                              : vis.status === 'no_show'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {vis.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send WhatsApp Reminder */}
                          <button
                            type="button"
                            onClick={() => onOpenWhatsAppScript(lead)}
                            title="Send WhatsApp Reminder Script"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Status Modifiers */}
                          {vis.status === 'booked' && (
                            <button
                              type="button"
                              onClick={() => updateVisitStatus(vis.id, 'confirmed')}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold"
                            >
                              Confirm
                            </button>
                          )}

                          {vis.status !== 'attended' && vis.status !== 'no_show' && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateVisitStatus(vis.id, 'attended')}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold"
                              >
                                Attended
                              </button>
                              <button
                                type="button"
                                onClick={() => updateVisitStatus(vis.id, 'no_show')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[11px] font-semibold"
                              >
                                No-Show
                              </button>
                            </>
                          )}
                        </div>
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
