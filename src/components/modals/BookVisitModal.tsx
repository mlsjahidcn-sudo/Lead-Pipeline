import React, { useState } from 'react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { Calendar, X, MapPin } from 'lucide-react';
import { SICA_OFFICE_ADDRESS } from '../../utils/scripts';

interface BookVisitModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BookVisitModal: React.FC<BookVisitModalProps> = ({ lead, isOpen, onClose }) => {
  const { bookOfficeVisit, employees } = useCrm();

  const [date, setDate] = useState(() => {
    // Default tomorrow at 15:00
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setHours(15, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [durationMin, setDurationMin] = useState(45);
  const [mode, setMode] = useState<'office' | 'video'>('office');
  const [attendees, setAttendees] = useState('Student + Father');
  const [counsellorId, setCounsellorId] = useState(lead?.owner_id || employees[0]?.id || '');
  const [notes, setNotes] = useState('Advised student to bring original HSC/Bachelor transcripts & passport');

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    bookOfficeVisit({
      leadId: lead.id,
      scheduledAt: new Date(date).toISOString(),
      durationMin,
      mode,
      attendees,
      counsellorId: counsellorId || lead.owner_id,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Book Office Visit</h2>
              <p className="text-xs text-slate-500">For {lead.full_name} · Primary Conversion Goal</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">SICA Dhaka Office:</span> {SICA_OFFICE_ADDRESS}
              <p className="text-blue-700 mt-0.5 text-[11px]">
                Always invite parents/guardians to attend. Visits convert; chat alone rarely does.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meeting Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'office' | 'video')}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white"
              >
                <option value="office">In-Person (Gulshan-1 Office)</option>
                <option value="video">Online Video Consultation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (Minutes)
              </label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white"
              >
                <option value={30}>30 mins</option>
                <option value={45}>45 mins (Standard)</option>
                <option value={60}>60 mins (Family / Complex)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date & Time Slot *
            </label>
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Attendees (e.g. Student + Father/Mother) *
            </label>
            <input
              type="text"
              required
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="e.g. Student + Father"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Counsellor
            </label>
            <select
              value={counsellorId}
              onChange={(e) => setCounsellorId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.title})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Preparation Notes / Checklist
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-md"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
            >
              Confirm Visit & Advance Stage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
