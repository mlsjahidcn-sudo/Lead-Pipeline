import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { normalizeBdPhone, calculateLeadScore } from '../../utils/crm-logic';
import { POPULAR_TAG_SUGGESTIONS } from '../../utils/tags';
import { X, Pencil, AlertTriangle, CheckCircle2, Sparkles, Tag, Plus } from 'lucide-react';
import { Lead } from '../../types';

interface EditLeadModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
}

const EDUCATION_OPTIONS = ['HSC', 'A-Levels', 'Diploma', 'Bachelor', 'Master'];
const INTAKE_OPTIONS = ['March 2027', 'September 2027', 'March 2028'];

/** ISO string → value accepted by <input type="datetime-local"> in local time. */
const toLocalDateTimeInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const EditLeadModal: React.FC<EditLeadModalProps> = ({ lead, isOpen, onClose }) => {
  const { updateLead, sources } = useCrm();

  const [fullName, setFullName] = useState(lead.full_name);
  const [phoneRaw, setPhoneRaw] = useState(lead.phone_raw || lead.phone_e164);
  const [whatsappRaw, setWhatsappRaw] = useState(
    lead.whatsapp_e164 && lead.whatsapp_e164 !== lead.phone_e164 ? lead.whatsapp_e164 : ''
  );
  const [email, setEmail] = useState(lead.email);
  const [city, setCity] = useState(lead.city);
  const [sourceId, setSourceId] = useState(lead.source_id);
  const [educationLevel, setEducationLevel] = useState(lead.education_level);
  const [lastResult, setLastResult] = useState(lead.last_result);
  const [targetDegree, setTargetDegree] = useState(lead.target_degree);
  const [targetProgramme, setTargetProgramme] = useState(lead.target_programme);
  const [targetIntake, setTargetIntake] = useState(lead.target_intake);
  const [englishLevel, setEnglishLevel] = useState(lead.english_level);
  const [fundingConfirmed, setFundingConfirmed] = useState(lead.funding_confirmed);
  const [parentInvolved, setParentInvolved] = useState(lead.parent_involved);
  const [hasPassport, setHasPassport] = useState(lead.has_passport);
  const [tags, setTags] = useState<string[]>(Array.isArray(lead.tags) ? [...lead.tags] : []);
  const [customTagInput, setCustomTagInput] = useState('');
  const [nextActionAt, setNextActionAt] = useState(toLocalDateTimeInput(lead.next_action_at));
  const [nextActionNote, setNextActionNote] = useState(lead.next_action_note || '');

  if (!isOpen) return null;

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '');
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTags((prev) => [...prev, clean]);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(customTagInput);
    }
  };

  const phoneNorm = normalizeBdPhone(phoneRaw);
  const whatsappNorm = whatsappRaw ? normalizeBdPhone(whatsappRaw) : phoneNorm;

  // Score preview reflects the edited values (stage bonus stays as-is)
  const scorePreview = calculateLeadScore({
    ...lead,
    funding_confirmed: fundingConfirmed,
    parent_involved: parentInvolved,
    has_passport: hasPassport,
    target_intake: targetIntake,
    last_result: lastResult,
    english_level: englishLevel,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneRaw.trim()) return;
    if (!phoneNorm.isValidBd) return; // invalid phone blocks save (warning shown below)

    updateLead(lead.id, {
      full_name: fullName.trim(),
      phone_raw: phoneRaw.trim(),
      phone_e164: phoneNorm.e164 || lead.phone_e164,
      whatsapp_e164: whatsappNorm.e164 || phoneNorm.e164 || '',
      email: email.trim() ? email.trim().toLowerCase() : '',
      city: city.trim() || 'Dhaka',
      source_id: sourceId,
      education_level: educationLevel,
      last_result: lastResult,
      target_degree: targetDegree,
      target_programme: targetProgramme,
      target_intake: targetIntake,
      english_level: englishLevel,
      funding_confirmed: fundingConfirmed,
      parent_involved: parentInvolved,
      has_passport: hasPassport,
      tags,
      next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
      next_action_note: nextActionNote.trim(),
      score: scorePreview.score,
      temperature: scorePreview.temperature,
    });
    onClose();
  };

  // Preserve custom values (e.g. from CSV import) that aren't in the default lists
  const educationOptions = EDUCATION_OPTIONS.includes(educationLevel)
    ? EDUCATION_OPTIONS
    : [educationLevel, ...EDUCATION_OPTIONS];
  const intakeOptions = INTAKE_OPTIONS.includes(targetIntake)
    ? INTAKE_OPTIONS
    : [targetIntake, ...INTAKE_OPTIONS];

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Edit Lead Details</h2>
              <p className="text-[11px] text-slate-400">
                {lead.full_name} · ID: {lead.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City / Location
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Phone & WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Phone *</label>
                {phoneRaw && (
                  <span
                    className={`text-[11px] flex items-center gap-1 font-mono ${
                      phoneNorm.isValidBd ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {phoneNorm.isValidBd ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Valid BD ({phoneNorm.e164})
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Invalid BD number
                      </>
                    )}
                  </span>
                )}
              </div>
              <input
                type="tel"
                required
                value={phoneRaw}
                onChange={(e) => setPhoneRaw(e.target.value)}
                placeholder="e.g. 01711234567 or +8801711..."
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp (if different)
              </label>
              <input
                type="tel"
                value={whatsappRaw}
                onChange={(e) => setWhatsappRaw(e.target.value)}
                placeholder="Leave blank if same as phone"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lead Source
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.channel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Academic & China Goals */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Target Study Program</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Education Level
                </label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                >
                  {educationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Last GPA / CGPA
                </label>
                <input
                  type="text"
                  value={lastResult}
                  onChange={(e) => setLastResult(e.target.value)}
                  placeholder="e.g. GPA 5.00 or 3.75"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Target Intake
                </label>
                <select
                  value={targetIntake}
                  onChange={(e) => setTargetIntake(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                >
                  {intakeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Target Degree
                </label>
                <input
                  type="text"
                  value={targetDegree}
                  onChange={(e) => setTargetDegree(e.target.value)}
                  placeholder="e.g. MBBS, CSE, Civil Eng, MBA"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Target Programme
                </label>
                <input
                  type="text"
                  value={targetProgramme}
                  onChange={(e) => setTargetProgramme(e.target.value)}
                  placeholder="e.g. Clinical Medicine (English Medium)"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  English / Language Level
                </label>
                <input
                  type="text"
                  value={englishLevel}
                  onChange={(e) => setEnglishLevel(e.target.value)}
                  placeholder="e.g. IELTS 6.5, MOI English, Basic"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                />
              </div>
            </div>
          </div>

          {/* Qualification Checkboxes & Score Preview */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fundingConfirmed}
                  onChange={(e) => setFundingConfirmed(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="font-medium">Budget / Funding Confirmed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parentInvolved}
                  onChange={(e) => setParentInvolved(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="font-medium">Parent Involved</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPassport}
                  onChange={(e) => setHasPassport(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="font-medium">Has Valid Passport</span>
              </label>
            </div>

            <div className="shrink-0 flex items-center gap-2 text-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-slate-500">New Score:</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {scorePreview.score}/100
              </span>
              <span
                className={`font-semibold text-[11px] uppercase px-1.5 py-0.5 rounded ${
                  scorePreview.temperature === 'hot'
                    ? 'bg-rose-100 text-rose-800'
                    : scorePreview.temperature === 'warm'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {scorePreview.temperature}
              </span>
              {scorePreview.score !== lead.score && (
                <span className="text-[11px] text-blue-600 font-medium">
                  (was {lead.score})
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Custom Categorization Tags</span>
              </label>
              <span className="text-[11px] text-slate-400">Type & press Enter or comma to add</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="e.g. VIP Candidate, CSC Full Scholarship, Walk-in..."
                  className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddTag(customTagInput)}
                disabled={!customTagInput.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tag</span>
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Active Tags:</span>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-400 hover:text-blue-700 p-0.5 hover:bg-blue-100 rounded-full transition-colors cursor-pointer"
                      title={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Popular Suggestions */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1.5">
                Suggested Tags (Click to toggle):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_TAG_SUGGESTIONS.map((sug) => {
                  const isSelected = tags.includes(sug);
                  return (
                    <button
                      type="button"
                      key={sug}
                      onClick={() => (isSelected ? handleRemoveTag(sug) : handleAddTag(sug))}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50'
                      }`}
                    >
                      {isSelected ? `✓ ${sug}` : `+ ${sug}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Next Action */}
          <div className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Next Action (SLA)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Next Action Due
                </label>
                <input
                  type="datetime-local"
                  value={nextActionAt}
                  onChange={(e) => setNextActionAt(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Next Action Note
                </label>
                <input
                  type="text"
                  value={nextActionNote}
                  onChange={(e) => setNextActionNote(e.target.value)}
                  placeholder="e.g. Call back after father gets home"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Clearing the date removes the scheduled next action (marking Lost also clears it).
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!phoneNorm.isValidBd}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md shadow-xs transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
