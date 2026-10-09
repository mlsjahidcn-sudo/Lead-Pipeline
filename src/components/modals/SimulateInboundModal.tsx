import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Sparkles, Globe, Video, Megaphone, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { Lead } from '../../types';

interface SimulateInboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead: (lead: Lead) => void;
}

export const SimulateInboundModal: React.FC<SimulateInboundModalProps> = ({
  isOpen,
  onClose,
  onSelectLead,
}) => {
  const { simulateInboundLead, employees, company } = useCrm();
  const [createdLead, setCreatedLead] = useState<Lead | null>(null);

  if (!isOpen) return null;

  const handleSimulate = (channel: 'website_assessment' | 'webinar' | 'facebook_ads') => {
    const lead = simulateInboundLead(channel);
    setCreatedLead(lead);
  };

  const assignedCounsellor = createdLead
    ? employees.find((e) => e.id === createdLead.owner_id)
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Simulate Inbound Lead</h2>
              <p className="text-xs text-slate-500">Test live round-robin & SLA countdown clocks</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Select an inbound source below to trigger automatic Bangladesh phone normalisation, duplicate checking, round-robin counsellor assignment, lead scoring, and the 2-hour SLA response clock:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => handleSimulate('website_assessment')}
              className="flex items-center justify-between p-3.5 border border-slate-200 hover:border-blue-400 rounded-lg text-left hover:bg-blue-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                    {company.name} Online Assessment
                  </div>
                  <div className="text-[11px] text-slate-500">
                    High intent · Candidate completed profile assessment on {company.website.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </button>

            <button
              onClick={() => handleSimulate('webinar')}
              className="flex items-center justify-between p-3.5 border border-slate-200 hover:border-emerald-400 rounded-lg text-left hover:bg-emerald-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-md">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                    Weekly Webinar Attendee
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Warm/Hot group · Attended Friday Zoom session on Chinese Scholarships
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </button>

            <button
              onClick={() => handleSimulate('facebook_ads')}
              className="flex items-center justify-between p-3.5 border border-slate-200 hover:border-indigo-400 rounded-lg text-left hover:bg-indigo-50/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-md">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-700">
                    Meta Ads (Facebook & Instagram)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lead ad submission · March 2027 MBBS & Engineering campaign
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </button>
          </div>

          {/* Result Banner if just simulated */}
          {createdLead && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Simulated Inbound Created Successfully!</span>
              </div>
              <div className="text-xs text-emerald-800 space-y-1">
                <div>
                  Student: <strong className="font-semibold">{createdLead.full_name}</strong> ({createdLead.city})
                </div>
                <div>
                  Assigned Counsellor:{' '}
                  <strong className="font-semibold">{assignedCounsellor?.full_name}</strong> (Round-Robin)
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span>Score: <strong className="font-mono">{createdLead.score}/100</strong></span>
                  <span className="text-[11px] font-semibold uppercase px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded">
                    {createdLead.temperature}
                  </span>
                  <span>SLA Clock: <strong className="text-rose-700 font-mono">2h 00m active</strong></span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectLead(createdLead);
                  onClose();
                }}
                className="w-full mt-2 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-medium transition-colors text-center"
              >
                Open Lead Timeline & Call Now &rarr;
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
