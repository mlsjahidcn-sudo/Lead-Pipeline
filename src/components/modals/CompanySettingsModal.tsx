import React, { useState, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { CompanyProfile } from '../../types';
import {
  Building2,
  X,
  Check,
  Globe,
  MapPin,
  Mail,
  Phone,
  DollarSign,
  ShieldCheck,
  Palette,
  Sparkles,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  Briefcase,
  Layers,
} from 'lucide-react';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCENT_COLORS = [
  { id: 'blue', label: 'Cobalt Blue', bg: 'bg-blue-600', ring: 'ring-blue-500', text: 'text-blue-600' },
  { id: 'indigo', label: 'Royal Indigo', bg: 'bg-indigo-600', ring: 'ring-indigo-500', text: 'text-indigo-600' },
  { id: 'emerald', label: 'Emerald Green', bg: 'bg-emerald-600', ring: 'ring-emerald-500', text: 'text-emerald-600' },
  { id: 'violet', label: 'Violet Purple', bg: 'bg-violet-600', ring: 'ring-violet-500', text: 'text-violet-600' },
  { id: 'rose', label: 'Rose Pink', bg: 'bg-rose-600', ring: 'ring-rose-500', text: 'text-rose-600' },
  { id: 'amber', label: 'Amber Gold', bg: 'bg-amber-600', ring: 'ring-amber-500', text: 'text-amber-600' },
];

const INDUSTRIES = [
  'Education Consulting & Study Abroad',
  'B2B Enterprise Software & Tech Sales',
  'Immigration & Global Visa Advisory',
  'Financial Advisory & Wealth Management',
  'Real Estate & Commercial Leasing',
  'Professional Services & Consulting',
  'Healthcare & Medical Placements',
  'Other / Custom Enterprise',
];

const CURRENCIES = [
  { code: 'BDT', symbol: '৳', label: 'BDT (৳) - Bangladeshi Taka' },
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD ($) - Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', label: 'AUD ($) - Australian Dollar' },
  { code: 'SGD', symbol: 'SG$', label: 'SGD ($) - Singapore Dollar' },
  { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee' },
  { code: 'AED', symbol: 'AED', label: 'AED (د.إ) - UAE Dirham' },
];

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({ isOpen, onClose }) => {
  const { company, updateCompany, companyPresets, switchCompanyPreset, createCompanyProfile } = useCrm();

  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'communications' | 'financials' | 'presets'>('profile');
  const [formData, setFormData] = useState<CompanyProfile>(company);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Sync form with context when company changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(company);
      setIsCreatingNew(false);
      setSaveSuccess(false);
    }
  }, [isOpen, company]);

  if (!isOpen) return null;

  const handleChange = (field: keyof CompanyProfile, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreatingNew) {
      const { id, ...rest } = formData;
      createCompanyProfile({
        ...rest,
        name: formData.name.trim() || 'My Company',
        slug: (formData.name || 'company').toLowerCase().replace(/[^a-z0-9]/g, '_'),
      });
      setIsCreatingNew(false);
    } else {
      updateCompany(formData);
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  const handleSelectPreset = (presetId: string) => {
    switchCompanyPreset(presetId);
    const found = companyPresets.find((p) => p.id === presetId);
    if (found) {
      setFormData(found);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1200);
  };

  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setFormData({
      id: '',
      name: '',
      short_name: '',
      slug: '',
      tagline: '',
      industry: 'Education Consulting & Study Abroad',
      accent_color: 'blue',
      currency_code: 'USD',
      currency_symbol: '$',
      phone: '+1 (555) 000-1234',
      email: 'admissions@yourcompany.com',
      website: 'https://yourcompany.com',
      office_address: 'Main Office Address, Suite 100',
      google_maps_link: 'https://maps.google.com',
      webinar_link: 'https://yourcompany.com/webinar',
      guide_link: 'https://yourcompany.com/guide',
      receipt_prefix: 'INV',
      portal_subdomain: 'app.omnileadscrm.io',
      plan_tier: 'professional',
      seat_count: 20,
      executive_sponsor: 'Operations Director',
    });
    setActiveTab('profile');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold text-lg shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  {isCreatingNew ? 'Add New Company Profile' : 'Company & Organization Settings'}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full bg-blue-500/30 text-blue-300 font-semibold border border-blue-400/20">
                  SaaS Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                White-label your CRM with custom company branding, address, currency & WhatsApp templates
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tenant Preset Switcher Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Select Tenant / Preset:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {companyPresets.map((preset) => {
              const isCurrent = company.id === preset.id && !isCreatingNew;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {isCurrent && <Check className="w-3 h-3 text-white" />}
                  <span>{preset.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleStartCreateNew}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1 ${
                isCreatingNew
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-white border border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Company</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto">
          {[
            { id: 'profile', label: 'Company Identity', icon: Building2 },
            { id: 'branding', label: 'Branding & Theme', icon: Palette },
            { id: 'communications', label: 'Contact & Links', icon: Phone },
            { id: 'financials', label: 'Currency & Billing', icon: DollarSign },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave}>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            {/* TAB 1: Profile & Identity */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Organization Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g. Apex Global Admissions"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Short Name / Brand Display
                    </label>
                    <input
                      type="text"
                      value={formData.short_name}
                      onChange={(e) => handleChange('short_name', e.target.value)}
                      placeholder="e.g. Apex"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tagline / Business Focus
                  </label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => handleChange('tagline', e.target.value)}
                    placeholder="e.g. International Student Placements & Academic Scholarships"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Industry Sector
                    </label>
                    <select
                      value={formData.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Custom SaaS Subdomain
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={formData.portal_subdomain}
                        onChange={(e) => handleChange('portal_subdomain', e.target.value)}
                        placeholder="yourcompany.omnileadscrm.io"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Executive Sponsor / Oversight Director
                  </label>
                  <input
                    type="text"
                    value={formData.executive_sponsor}
                    onChange={(e) => handleChange('executive_sponsor', e.target.value)}
                    placeholder="e.g. Jahid Hasan (Academic Director)"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This person will be designated for the Executive Oversight briefs & morning audits.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: Branding & Theme */}
            {activeTab === 'branding' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Brand Accent Theme
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ACCENT_COLORS.map((color) => {
                      const isSelected = formData.accent_color === color.id;
                      return (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => handleChange('accent_color', color.id)}
                          className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                            isSelected
                              ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg ${color.bg} shadow-xs shrink-0 flex items-center justify-center text-white`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-800">{color.label}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{color.id} tone</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Brand Wordmark Preview */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Live Navigation Brand Preview</span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {formData.name ? formData.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-sm">
                          {formData.name || 'Company Name'}
                        </span>
                        <span className="text-blue-600 font-semibold text-xs ml-1.5">SaaS CRM</span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formData.portal_subdomain || 'company.omnileadscrm.io'}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      {formData.plan_tier ? `${formData.plan_tier.toUpperCase()} TIER` : 'PRO'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Contact, Locations & Links */}
            {activeTab === 'communications' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Contact Email
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="admissions@yourcompany.com"
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Phone Hotline
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="+880 1711-002233"
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Headquarters / Office Physical Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <textarea
                      rows={2}
                      required
                      value={formData.office_address}
                      onChange={(e) => handleChange('office_address', e.target.value)}
                      placeholder="e.g. Level 4, Navana Tower, Gulshan-1, Dhaka-1212, Bangladesh"
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    This physical address is automatically inserted into office visit invitations and WhatsApp templates.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Maps Pin URL
                  </label>
                  <input
                    type="url"
                    value={formData.google_maps_link}
                    onChange={(e) => handleChange('google_maps_link', e.target.value)}
                    placeholder="https://maps.google.com/?q=Office"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Website URL
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Live Webinar / Discovery Link
                    </label>
                    <input
                      type="url"
                      value={formData.webinar_link}
                      onChange={(e) => handleChange('webinar_link', e.target.value)}
                      placeholder="https://yourcompany.com/webinar"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Guide / Brochure Link
                  </label>
                  <input
                    type="url"
                    value={formData.guide_link}
                    onChange={(e) => handleChange('guide_link', e.target.value)}
                    placeholder="https://yourcompany.com/scholarship-guide"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* TAB 4: Currency & Financials */}
            {activeTab === 'financials' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Currency
                    </label>
                    <select
                      value={formData.currency_code}
                      onChange={(e) => {
                        const selected = CURRENCIES.find((c) => c.code === e.target.value);
                        if (selected) {
                          handleChange('currency_code', selected.code);
                          handleChange('currency_symbol', selected.symbol);
                        }
                      }}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      value={formData.currency_symbol}
                      onChange={(e) => handleChange('currency_symbol', e.target.value)}
                      placeholder="e.g. ৳ or $"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Receipt Prefix
                    </label>
                    <input
                      type="text"
                      value={formData.receipt_prefix}
                      onChange={(e) => handleChange('receipt_prefix', e.target.value.toUpperCase())}
                      placeholder="e.g. APX-REC or INV"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Receipt numbers will be generated as {formData.receipt_prefix || 'REC'}-2026-XXXX.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SaaS Subscription Plan
                    </label>
                    <select
                      value={formData.plan_tier}
                      onChange={(e) => handleChange('plan_tier', e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white capitalize"
                    >
                      <option value="starter">Starter Plan (5 Counsellor Seats)</option>
                      <option value="professional">Professional Plan (20 Counsellor Seats)</option>
                      <option value="enterprise">Enterprise Plan (Unlimited Seats & Branches)</option>
                    </select>
                  </div>
                </div>

                {/* Example preview */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Sample Financial Formatting:</div>
                    <div className="text-[11px] text-emerald-800">
                      Sample verified payment deposit: <strong>50,000 {formData.currency_code}</strong> ({formData.currency_symbol}50,000)
                    </div>
                  </div>
                  <span className="font-mono px-2 py-1 bg-white rounded-md border border-emerald-200 text-emerald-800 font-bold">
                    {formData.receipt_prefix}-2026-0042
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {saveSuccess ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  <span>Company profile saved successfully!</span>
                </span>
              ) : (
                <span>All changes apply instantly across pipeline, visits & WhatsApp scripts</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isCreatingNew ? 'Create & Switch Company' : 'Save Company Info'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
