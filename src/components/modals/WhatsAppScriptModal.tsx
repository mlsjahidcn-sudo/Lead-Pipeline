import React, { useState, useMemo } from 'react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { getScriptTemplates, getWhatsAppClickUrl } from '../../utils/scripts';
import { X, Send, Copy, Check, MessageSquare } from 'lucide-react';

interface WhatsAppScriptModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLoggedActivity?: () => void;
}

export const WhatsAppScriptModal: React.FC<WhatsAppScriptModalProps> = ({
  lead,
  isOpen,
  onClose,
  onLoggedActivity,
}) => {
  const { currentEmployee, logInteraction, company } = useCrm();
  const scriptTemplates = useMemo(() => getScriptTemplates(company), [company]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(scriptTemplates[0]?.id || 'first_contact_en');
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState('');

  if (!isOpen || !lead) return null;

  const currentTemplate = scriptTemplates.find((t) => t.id === selectedTemplateId) || scriptTemplates[0];

  const generatedText = currentTemplate.template({
    studentName: lead.full_name,
    counsellorName: currentEmployee.full_name,
    intake: lead.target_intake,
    subject: lead.target_degree,
  });

  const activeText = customText !== '' ? customText : generatedText;
  const targetPhone = lead.whatsapp_e164 || lead.phone_e164;
  const waUrl = getWhatsAppClickUrl(targetPhone, activeText);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      summary: `Sent WhatsApp script: "${currentTemplate.name}"`,
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
                  onClick={() => {
                    setSelectedTemplateId(tmpl.id);
                    setCustomText('');
                  }}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    selectedTemplateId === tmpl.id
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-400 uppercase">{tmpl.step}</div>
                  <div className="line-clamp-2 mt-0.5">{tmpl.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Purpose & Language Note */}
          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-100 flex items-center justify-between">
            <span>Goal: {currentTemplate.purpose}</span>
            <span className="font-mono text-[11px] uppercase text-slate-600">
              Lang: {currentTemplate.language === 'bn' ? 'বাংলা' : 'English'}
            </span>
          </div>

          {/* Message Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Message Preview (Editable)
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
