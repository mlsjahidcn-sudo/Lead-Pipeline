import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, Check, AlertTriangle, ChevronRight, ChevronLeft, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import {
  parseFile,
  guessMapping,
  isFalsy,
  isTruthy,
  REQUIRED_FIELDS,
  type FieldName,
  type ImportRow,
  type ParsedFile,
} from '../../utils/import-parser';
import { Lead } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead?: (leadId: string) => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'result';

interface RowError {
  row: number;
  reason: string;
}

const SUPPORTED_FIELDS: FieldName[] = [
  'full_name',
  'phone_raw',
  'whatsapp_e164',
  'email',
  'city',
  'country',
  'source_id',
  'education_level',
  'last_result',
  'target_degree',
  'target_programme',
  'target_intake',
  'english_level',
  'funding_confirmed',
  'parent_involved',
  'has_passport',
  'tags',
  'notes',
];

const FIELD_LABEL: Record<FieldName, string> = {
  full_name: 'Full name',
  phone_raw: 'Phone',
  whatsapp_e164: 'WhatsApp',
  email: 'Email',
  city: 'City',
  country: 'Country',
  source_id: 'Source',
  education_level: 'Education level',
  last_result: 'Academic result',
  target_degree: 'Target degree',
  target_programme: 'Target programme',
  target_intake: 'Target intake',
  english_level: 'English proficiency',
  funding_confirmed: 'Funding confirmed',
  parent_involved: 'Parent involved',
  has_passport: 'Has passport',
  tags: 'Tags',
  notes: 'Notes',
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PREVIEW_ROWS = 20;
const MAX_ROWS = 500;

const ALLOWED_INTAKES = new Set([
  'March 2027',
  'September 2027',
  'March 2028',
  'September 2028',
  'March 2029',
  'September 2029',
]);
const ALLOWED_COUNTRIES = new Set(['BD', 'IN', 'PK', 'NP', 'OTHER']);

export const ImportLeadsModal: React.FC<Props> = ({ isOpen, onClose, onSelectLead }) => {
  const { sources, employees, bulkImportLeads, company } = useCrm();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<FieldName, string>>>({});
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: RowError[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setFileName(null);
      setParsed(null);
      setParseError(null);
      setMapping({});
      setImporting(false);
      setResult(null);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Escape to close (only when not importing)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, importing, onClose]);

  // Source resolution: the column may carry the source *name* (e.g. "Webinar")
  // or a UUID. Build a lookup once.
  const sourceByIdOrName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sources) {
      map.set(s.id, s.id);
      map.set(s.name.toLowerCase(), s.id);
    }
    return map;
  }, [sources]);

  const resolveSource = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return sourceByIdOrName.get(trimmed) ?? sourceByIdOrName.get(trimmed.toLowerCase()) ?? null;
  };

  const handleFiles = async (file: File) => {
    setParseError(null);
    if (file.size > MAX_FILE_BYTES) {
      setParseError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
      return;
    }
    setFileName(file.name);
    try {
      const result = await parseFile(file);
      if (result.totalRows === 0) {
        setParseError('The file contains no data rows.');
        return;
      }
      if (result.totalRows > MAX_ROWS) {
        setParseError(`Too many rows (${result.totalRows}). Max ${MAX_ROWS} per import.`);
        return;
      }
      setParsed(result);
      setMapping(guessMapping(result.headers));
      setStep('mapping');
    } catch (err) {
      setParseError((err as Error).message);
      setParsed(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFiles(file);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFiles(file);
  };

  const mappedRows = useMemo<Partial<Lead>[]>(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const out: Partial<Lead> = {};
      (Object.keys(mapping) as FieldName[]).forEach((field) => {
        const header = mapping[field];
        if (!header) return;
        const v = row[header] ?? '';
        if (v === '') return;
        switch (field) {
          case 'full_name':
          case 'phone_raw':
          case 'whatsapp_e164':
          case 'email':
          case 'city':
          case 'education_level':
          case 'last_result':
          case 'target_degree':
          case 'target_programme':
          case 'target_intake':
          case 'english_level':
            (out as Record<string, string>)[field] = v;
            break;
          case 'country':
            if (ALLOWED_COUNTRIES.has(v.toUpperCase())) out.country = v.toUpperCase();
            else (out as Record<string, string>)[field] = v;
            break;
          case 'funding_confirmed':
            if (isTruthy(v)) out.funding_confirmed = true;
            else if (isFalsy(v)) out.funding_confirmed = false;
            break;
          case 'parent_involved':
            if (isTruthy(v)) out.parent_involved = true;
            else if (isFalsy(v)) out.parent_involved = false;
            break;
          case 'has_passport':
            if (isTruthy(v)) out.has_passport = true;
            else if (isFalsy(v)) out.has_passport = false;
            break;
          case 'tags':
            out.tags = v
              .split(/[,;|]/)
              .map((t) => t.trim())
              .filter(Boolean);
            break;
          case 'source_id': {
            const resolved = resolveSource(v);
            if (resolved) out.source_id = resolved;
            break;
          }
          case 'notes':
            // not persisted on Lead — keep in `next_action_note` as a hint
            out.next_action_note = v;
            break;
        }
      });
      return out;
    });
  }, [parsed, mapping, resolveSource]);

  const validation = useMemo<{ valid: Partial<Lead>[]; errors: RowError[] }>(() => {
    if (!parsed) return { valid: [], errors: [] };
    const valid: Partial<Lead>[] = [];
    const errors: RowError[] = [];
    mappedRows.forEach((row, idx) => {
      const rowNum = idx + 2; // 1 is header
      const name = (row.full_name ?? '').toString().trim();
      const phone = (row.phone_raw ?? '').toString().trim();
      if (!name) {
        errors.push({ row: rowNum, reason: 'full_name is required' });
        return;
      }
      if (!phone) {
        errors.push({ row: rowNum, reason: 'phone_raw is required' });
        return;
      }
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ row: rowNum, reason: `invalid email "${row.email}"` });
        return;
      }
      if (row.target_intake && !ALLOWED_INTAKES.has(row.target_intake)) {
        // not fatal — let it through; server will store as-is
      }
      valid.push(row);
    });
    return { valid, errors };
  }, [parsed, mappedRows]);

  const canAdvanceFromMapping = (): boolean => {
    return REQUIRED_FIELDS.every((f) => Boolean(mapping[f] && (parsed?.headers ?? []).includes(mapping[f]!)));
  };

  const handleImport = async () => {
    if (!validation.valid.length) return;
    setImporting(true);
    try {
      const res = await bulkImportLeads(validation.valid);
      const failed: RowError[] = [
        ...validation.errors,
        ...res.failed.filter((f) => f.row >= 0).map((f) => ({ row: f.row, reason: f.error })),
      ];
      setResult({ inserted: res.inserted, failed });
      setStep('result');
    } catch (err) {
      setResult({ inserted: 0, failed: [{ row: -1, reason: (err as Error).message }] });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">Import leads</h2>
            <p className="text-xs text-slate-500">Bring in leads from a CSV or Excel file. Up to {MAX_ROWS} rows.</p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Stepper */}
        <nav className="px-5 py-3 border-b border-slate-200 flex items-center gap-2 text-xs shrink-0">
          {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, idx) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center gap-1.5 ${
                  step === s ? 'text-blue-700 font-semibold' :
                  ['upload', 'mapping', 'preview', 'result'].indexOf(step) > idx ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === s ? 'bg-blue-600 text-white' :
                  ['upload', 'mapping', 'preview', 'result'].indexOf(step) > idx ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {idx + 1}
                </div>
                <span className="capitalize">{s}</span>
              </div>
              {idx < 3 && <ChevronRight className="w-3 h-3 text-slate-300" />}
            </React.Fragment>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <Upload className="w-10 h-10 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">Drop a CSV, XLS, or XLSX file here</p>
              <p className="text-xs text-slate-500">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md"
              >
                Choose file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={onPick}
                className="hidden"
              />
              {parseError && (
                <div className="mt-3 px-3 py-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
                  {parseError}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-2 text-center max-w-md">
                Required columns: <span className="font-mono">full_name</span> and <span className="font-mono">phone</span>. Optional: email, city, country, source, education_level, last_result, target_*, english_level, funding_confirmed, parent_involved, has_passport, tags, notes.
              </p>
            </div>
          )}

          {step === 'mapping' && parsed && (
            <div>
              <div className="mb-3 text-sm text-slate-600 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{fileName}</span>
                <span className="text-slate-400">·</span>
                <span>{parsed.totalRows} rows · {parsed.headers.length} columns</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold w-1/2">CRM field</th>
                      <th className="text-left px-3 py-2 font-semibold">Source column</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SUPPORTED_FIELDS.map((field) => {
                      const isRequired = (REQUIRED_FIELDS as readonly string[]).includes(field);
                      const value = mapping[field] ?? '';
                      return (
                        <tr key={field}>
                          <td className="px-3 py-2">
                            <span className={isRequired ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                              {FIELD_LABEL[field]}
                            </span>
                            {isRequired && <span className="ml-1.5 text-[10px] font-bold text-rose-600">REQUIRED</span>}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={value}
                              onChange={(e) => {
                                const v = e.target.value;
                                setMapping((m) => ({ ...m, [field]: v || undefined }));
                              }}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                            >
                              <option value="">(ignore)</option>
                              {parsed.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'preview' && parsed && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-emerald-700">{validation.valid.length}</span> ready to import
                  {validation.errors.length > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-rose-700">{validation.errors.length}</span> invalid
                    </>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={(e) => setSkipInvalid(e.target.checked)}
                    className="rounded"
                  />
                  Skip invalid rows
                </label>
              </div>
              {validation.errors.length > 0 && skipInvalid === false && (
                <div className="mb-3 p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
                  Disable "Skip invalid rows" to import anyway — invalid rows will be reported.
                </div>
              )}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold w-8">#</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Name</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Phone</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Source</th>
                      <th className="px-2 py-1.5 text-left font-semibold">City</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.rows.slice(0, PREVIEW_ROWS).map((row, idx) => {
                      const mapped = mappedRows[idx];
                      const error = validation.errors.find((e) => e.row === idx + 2);
                      const sourceName = mapped?.source_id ? sources.find((s) => s.id === mapped.source_id)?.name : null;
                      return (
                        <tr key={idx} className={error ? 'bg-rose-50/40' : ''}>
                          <td className="px-2 py-1.5 text-slate-400 font-mono">{idx + 2}</td>
                          <td className="px-2 py-1.5 text-slate-800 font-medium">{(mapped?.full_name as string) ?? '—'}</td>
                          <td className="px-2 py-1.5 text-slate-600 font-mono">{(mapped?.phone_raw as string) ?? '—'}</td>
                          <td className="px-2 py-1.5 text-slate-600">{sourceName ?? '—'}</td>
                          <td className="px-2 py-1.5 text-slate-600">{(mapped?.city as string) ?? '—'}</td>
                          <td className="px-2 py-1.5">
                            {error ? (
                              <span className="inline-flex items-center gap-1 text-rose-700">
                                <AlertTriangle className="w-3 h-3" />
                                {error.reason}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <Check className="w-3 h-3" />
                                ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parsed.totalRows > PREVIEW_ROWS && (
                  <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200">
                    and {parsed.totalRows - PREVIEW_ROWS} more row{parsed.totalRows - PREVIEW_ROWS === 1 ? '' : 's'} not shown
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="text-center py-6">
              <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                result.inserted > 0 ? 'bg-emerald-100' : 'bg-rose-100'
              }`}>
                {result.inserted > 0 ? (
                  <Check className="w-7 h-7 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-7 h-7 text-rose-600" />
                )}
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-900">
                {result.inserted > 0 ? 'Import complete' : 'Import failed'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {result.inserted} of {(result.inserted + result.failed.filter((f) => f.row > 0).length)} row{result.inserted + result.failed.filter((f) => f.row > 0).length === 1 ? '' : 's'} imported into {company.name}.
              </p>
              {result.failed.length > 0 && (
                <div className="mt-4 mx-auto max-w-md text-left border border-rose-200 bg-rose-50/60 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="text-xs font-semibold text-rose-800 mb-1.5">{result.failed.length} problem{result.failed.length === 1 ? '' : 's'}:</div>
                  {result.failed.slice(0, 50).map((f, i) => (
                    <div key={i} className="text-xs text-rose-700 py-0.5">
                      {f.row > 0 ? <span className="font-mono text-rose-500">row {f.row}</span> : <span className="text-rose-500">batch</span>}
                      {' '}— {f.reason}
                    </div>
                  ))}
                  {result.failed.length > 50 && <div className="text-[11px] text-rose-500 mt-1">… and {result.failed.length - 50} more</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} disabled={importing} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50">Cancel</button>
          )}
          {step === 'mapping' && (
            <>
              <button
                onClick={() => { setStep('upload'); setParsed(null); setFileName(null); }}
                disabled={importing}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!canAdvanceFromMapping()}
                className="inline-flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md disabled:opacity-40"
              >
                Next: Preview <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('mapping')}
                disabled={importing}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (skipInvalid && validation.valid.length === 0)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md disabled:opacity-40"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {importing ? 'Importing…' : `Import ${skipInvalid ? validation.valid.length : parsed?.totalRows ?? 0} leads`}
              </button>
            </>
          )}
          {step === 'result' && (
            <>
              <span className="text-xs text-slate-500">Done</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md"
              >
                Close
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};
