import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { normalizeBdPhone, calculateLeadScore, checkDuplicateLead } from '../../utils/crm-logic';
import { X, AlertTriangle, CheckCircle2, UserPlus, Sparkles, Tag, Plus } from 'lucide-react';
import { Lead } from '../../types';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead?: (lead: Lead) => void;
}

const POPULAR_TAG_SUGGESTIONS = [
  'MBBS',
  'Engineering',
  'CSC Scholarship',
  'High Value',
  'Self-Funded',
  'Parent VIP',
  'March Intake',
  'September Intake',
  'IELTS 6.5+',
  'Walk-in',
  'Webinar Lead',
];

export const NewLeadModal: React.FC<NewLeadModalProps> = ({ isOpen, onClose, onSelectLead }) => {
  const { createLead, sources, employees, leads, currentEmployee } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  const [fullName, setFullName] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [whatsappRaw, setWhatsappRaw] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Dhaka');
  const [sourceId, setSourceId] = useState(sources[0]?.id || 'src-assessment');
  const [ownerId, setOwnerId] = useState('');
  const [educationLevel, setEducationLevel] = useState('HSC');
  const [lastResult, setLastResult] = useState('GPA 5.00');
  const [targetDegree, setTargetDegree] = useState('MBBS');
  const [targetProgramme, setTargetProgramme] = useState('Clinical Medicine (English Medium)');
  const [targetIntake, setTargetIntake] = useState('March 2027');
  const [englishLevel, setEnglishLevel] = useState('Medium of Instruction');
  const [fundingConfirmed, setFundingConfirmed] = useState(true);
  const [parentInvolved, setParentInvolved] = useState(true);
  const [hasPassport, setHasPassport] = useState(false);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>(['MBBS', 'High Value']);
  const [customTagInput, setCustomTagInput] = useState('');

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

  // Real-time phone normalisation check
  const phoneNorm = normalizeBdPhone(phoneRaw);
  const whatsappNorm = whatsappRaw ? normalizeBdPhone(whatsappRaw) : phoneNorm;

  // Duplicate check
  const dupCheck = checkDuplicateLead(
    {
      phone: phoneNorm.e164 || undefined,
      whatsapp: whatsappNorm.e164 || undefined,
      email: email || undefined,
    },
    leads
  );

  // Score preview
  const scorePreview = calculateLeadScore({
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

    const res = createLead({
      full_name: fullName.trim(),
      phone_raw: phoneRaw.trim(),
      whatsapp_e164: whatsappNorm.e164 || undefined,
      email: email.trim() || undefined,
      city,
      country: 'BD',
      source_id: sourceId,
      owner_id: ownerId || undefined,
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
      next_action_note: notes || 'First call & WhatsApp attempt (2h SLA)',
    });

    if (res.isDuplicate && res.matchedLead && onSelectLead) {
      onSelectLead(res.matchedLead);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Capture New Student Lead</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Duplicate Detection Banner */}
          {dupCheck.isDuplicate && dupCheck.matchedLead && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-semibold">
                  Duplicate Match Detected on {dupCheck.matchField?.toUpperCase()}:
                </p>
                <p>
                  Found existing lead: <span className="font-medium">{dupCheck.matchedLead.full_name}</span> (Stage:{' '}
                  {dupCheck.matchedLead.stage.toUpperCase()}).
                </p>
                <p className="text-amber-800">
                  Submitting will automatically attach a re-enquiry activity and keep the lead history intact without creating duplicate rows.
                </p>
                {onSelectLead && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectLead(dupCheck.matchedLead!);
                      onClose();
                    }}
                    className="inline-block mt-1 font-medium underline text-amber-900 hover:text-amber-950"
                  >
                    View existing lead record &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

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
                placeholder="e.g. Mahir Faisal"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City / Location in Bangladesh
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Dhaka (Uttara), Chittagong, Sylhet"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Bangladesh Phone Normalisation Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Phone (Local or +880) *
                </label>
                {phoneNorm.isValidBd && (
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> Valid BD ({phoneNorm.e164})
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
              <p className="text-[11px] text-slate-400 mt-1">
                Auto-cleans to E.164 (+8801[3-9]XXXXXXXX)
              </p>
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
                placeholder="student@example.com"
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
            <h3 className="text-xs font-bold text-slate-800">Academic & China Target</h3>
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
                  <option value="HSC">HSC (Bangla / English Version)</option>
                  <option value="A-Levels">A-Levels (Cambridge / Edexcel)</option>
                  <option value="Diploma">Polytechnic Diploma</option>
                  <option value="Bachelor">Bachelor Degree</option>
                  <option value="Master">Master Degree</option>
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
                  <option value="March 2027">March 2027 (Spring Intake - Urgent)</option>
                  <option value="September 2027">September 2027 (Fall Intake)</option>
                  <option value="March 2028">March 2028</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <span className="font-medium">Budget / Funding Confirmed (+20)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parentInvolved}
                  onChange={(e) => setParentInvolved(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="font-medium">Parent Involved (+15)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPassport}
                  onChange={(e) => setHasPassport(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="font-medium">Has Valid Passport (+10)</span>
              </label>
            </div>

            <div className="shrink-0 flex items-center gap-2 text-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-slate-500">Predicted Score:</span>
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
            </div>
          </div>

          {/* Custom Tags for Categorization */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Custom Categorization Tags</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Type & press Enter or comma to add
              </span>
            </div>

            {/* Input & Add button */}
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

            {/* Selected Tags list */}
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

          {/* Owner Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign Counsellor
              </label>
              {isManagerOrAdmin ? (
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white"
                >
                  <option value="">Auto Round-Robin (Oldest Assigned First)</option>
                  {employees
                    .filter((e) => e.role === 'counsellor' && e.is_active)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} {e.accepts_new_leads ? '' : '(Paused)'}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-600">
                  Assigned to you ({currentEmployee.full_name})
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Next Action Note
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Call within 2h SLA, offer webinar"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md"
              />
            </div>
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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors"
            >
              Create Lead & Start SLA Clock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
