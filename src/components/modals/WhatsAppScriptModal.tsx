import React, { useState, useMemo } from 'react';
import { Lead, QuickReplyTemplate } from '../../types';
import { useCrm } from '../../context/CrmContext';
import {
  getScriptTemplates,
  getWhatsAppClickUrl,
  renderQuickReply,
  DEFAULT_OFFICE_ADDRESS,
  DEFAULT_GOOGLE_MAPS_LINK,
  DEFAULT_WEBINAR_LINK,
  DEFAULT_SCHOLARSHIP_GUIDE,
} from '../../utils/scripts';
import { X, Send, Copy, Check, MessageSquare, Pencil, RotateCcw, Save } from 'lucide-react';

interface WhatsAppScriptModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLoggedActivity?: () => void;
}

const PLACEHOLDER_TOKENS = [
  'studentName',
  'counsellorName',
  'companyName',
  'shortName',
  'address',
  'mapsLink',
  'webinarLink',
  'guideLink',
  'intake',
  'subject',
  'visitDate',
  'visitTime',
] as const;

export const WhatsAppScriptModal: React.FC<WhatsAppScriptModalProps> = ({
  lead,
  isOpen,
  onClose,
  onLoggedActivity,
}) => {
  const { currentEmployee, logInteraction, company, quickReplies, saveQuickReply } = useCrm();
  const isManagerOrAdmin = currentEmployee.role === 'admin' || currentEmployee.role === 'manager';

  // Code defaults (branded with the company profile) overlaid by saved rows.
  const defaults = useMemo(() => getScriptTemplates(company), [company]);
  const savedById = useMemo(() => new Map(quickReplies.map((t) => [t.id, t])), [quickReplies]);
  const scriptTemplates = useMemo(() => {
    const merged = defaults.map((d) => savedById.get(d.id) ?? d);
    const extra = quickReplies.filter((t) => !defaults.some((d) => d.id === t.id));
    return [...merged, ...extra];
  }, [defaults, savedById, quickReplies]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(scriptTemplates[0]?.id || 'first_contact_en');
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState('');
  // Template editing (admin/manager): edits the saved template body, not the
  // per-lead rendered message.
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<QuickReplyTemplate | null>(null);

  if (!isOpen || !lead) return null;

  const currentTemplate = scriptTemplates.find((t) => t.id === selectedTemplateId) || scriptTemplates[0];
  const isSavedVersion = !!currentTemplate && savedById.has(currentTemplate.id);

  const params = {
    studentName: lead.full_name,
    counsellorName: currentEmployee.full_name,
    companyName: company.name || 'MHR Education',
    shortName: company.short_name || company.name || 'MHR Education',
    address: company.office_address || DEFAULT_OFFICE_ADDRESS,
    mapsLink: company.google_maps_link || DEFAULT_GOOGLE_MAPS_LINK,
    webinarLink: company.webinar_link || DEFAULT_WEBINAR_LINK,
    guideLink: company.guide_link || DEFAULT_SCHOLARSHIP_GUIDE,
    intake: lead.target_intake,
    subject: lead.target_degree,
    visitDate: 'tomorrow',
    visitTime: '3:00 PM',
  };

  const generatedText = currentTemplate ? renderQuickReply(currentTemplate.body, params) : '';
  const activeText = customText !== '' ? customText : generatedText;
  const targetPhone = lead.whatsapp_e164 || lead.phone_e164;
  const waUrl = getWhatsAppClickUrl(targetPhone, activeText);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = () => {
    if (!currentTemplate) return;
    setDraft({ ...currentTemplate });
    setEditMode(true);
    setCustomText('');
  };

  const handleSaveTemplate = () => {
    if (!draft || !draft.name.trim() || !draft.body.trim()) return;
    saveQuickReply({ ...draft, name: draft.name.trim(), body: draft.body.trim() });
    setEditMode(false);
    setDraft(null);
    setCustomText('');
  };

  const handleResetToDefault = () => {
    const def = defaults.find((d) => d.id === selectedTemplateId);
    if (def) setDraft({ ...def });
  };

  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setCustomText('');
    setEditMode(false);
    setDraft(null);
  };

  const handleOpenWhatsAppAndLog = () => {
    // Open wa.me in new tab
    window.open(waUrl, '_blank');

    // Automatically log activity as WhatsApp message sent
    const defaultNextAction = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    logInteraction({
      leadId: lead.id,
      activityType: 'whatsapp',
      direction: 'outbound',
      outcome: 'replied',
      summary: `Sent WhatsApp script: "${currentTemplate?.name ?? 'custom'}"`,
      nextActionAt: defaultNextAction,
      nextActionNote: 'Wait for WhatsApp reply & follow up',
    });

    if (onLoggedActivity) onLoggedActivity();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">WhatsApp Quick Script</h2>
              <p className="text-xs text-slate-500">
                To: {lead.full_name} · <span className="font-mono">{targetPhone}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Script Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scriptTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => selectTemplate(tmpl.id)}
                  className={`relative text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    selectedTemplateId === tmpl.id
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-400 uppercase">{tmpl.step}</div>
                  <div className="line-clamp-2 mt-0.5">{tmpl.name}</div>
                  {savedById.has(tmpl.id) && (
                    <span className="absolute top-1 right-1 text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-emerald-600 text-white">
                      Saved
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose, Language & Edit controls */}
          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-100 flex items-center justify-between gap-2">
            <span className="truncate">
              Goal: {currentTemplate?.purpose}
              {isSavedVersion && <span className="text-emerald-700 font-medium"> · customized</span>}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[11px] uppercase text-slate-600">
                Lang: {currentTemplate?.language === 'bn' ? 'বাংলা' : 'English'}
              </span>
              {isManagerOrAdmin && !editMode && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5"
                  title="Edit this template for the whole team (saved to the database)"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit template</span>
                </button>
              )}
            </div>
          </div>

          {/* Template editor (admin/manager) */}
          {editMode && draft ? (
            <div className="space-y-2 border border-emerald-200 rounded-lg bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-900">
                  Editing template (applies to the whole team)
                </span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                  title="Load the default wording back into the editor"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Load default</span>
                </button>
              </div>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Template name"
                className="w-full text-xs p-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-white"
              />
              <input
                type="text"
                value={draft.purpose}
                onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                placeholder="Purpose / goal (shown above the message)"
                className="w-full text-xs p-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-white"
              />
              <textarea
                rows={7}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Message body — use {{studentName}}, {{counsellorName}}, {{intake}} etc."
                className="w-full text-xs p-3 font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-white text-slate-800 leading-relaxed"
              />
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Placeholders:{' '}
                {PLACEHOLDER_TOKENS.map((tok) => (
                  <code key={tok} className="mx-0.5 px-1 bg-white border border-slate-200 rounded text-slate-700">
                    {`{{${tok}}}`}
                  </code>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setDraft(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!draft.name.trim() || !draft.body.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save template</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Message Textarea (per-send edit; does not change the saved template) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Message Preview (editable for this send)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={activeText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full text-xs p-3 font-sans border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-white text-slate-800 leading-relaxed"
                />
              </div>
            </>
          )}

          {/* Target URL Preview */}
          <div className="text-[11px] font-mono text-slate-400 truncate">
            Target URL: wa.me/{targetPhone.replace(/[^0-9]/g, '')}?text=...
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
            >
              Copy Script
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsAppAndLog}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch WhatsApp & Log</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
