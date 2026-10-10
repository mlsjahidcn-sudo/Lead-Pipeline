// Browser-side parser for CSV and XLS/XLSX import files, plus a heuristic
// header-to-field mapper. Used by the ImportLeadsModal.

export type ImportRow = Record<string, string>;

export interface ParsedFile {
  rows: ImportRow[];
  headers: string[];
  totalRows: number;
}

const SUPPORTED_FIELDS = [
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
] as const;

export const REQUIRED_FIELDS = ['full_name', 'phone_raw'] as const;
export type FieldName = (typeof SUPPORTED_FIELDS)[number];

/**
 * Heuristic synonym dictionary. Order in each array matters — earlier
 * entries match more aggressively.
 */
const SYNONYMS: Record<FieldName, string[]> = {
  full_name: ['full name', 'fullname', 'name', 'student name', 'student', 'lead name', 'candidate', 'applicant'],
  phone_raw: ['phone', 'phone number', 'mobile', 'mobile number', 'mobile no', 'contact number', 'telephone', 'phone_raw'],
  whatsapp_e164: ['whatsapp', 'whatsapp number', 'whatsapp no', 'wa', 'whatsapp_e164'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  city: ['city', 'location', 'town', 'city of residence'],
  country: ['country', 'country code'],
  source_id: ['source', 'source name', 'source channel', 'channel', 'lead source'],
  education_level: ['education', 'education level', 'qualification', 'highest education'],
  last_result: ['last result', 'result', 'gpa', 'grade', 'score', 'academic result'],
  target_degree: ['target degree', 'degree', 'programme type', 'degree level'],
  target_programme: ['target programme', 'programme', 'program', 'course', 'subject', 'major'],
  target_intake: ['target intake', 'intake', 'semester', 'start date'],
  english_level: ['english', 'english level', 'english proficiency', 'ielts', 'toefl'],
  funding_confirmed: ['funding', 'funding confirmed', 'budget confirmed', 'has budget', 'budget'],
  parent_involved: ['parent involved', 'parent', 'guardian', 'parents'],
  has_passport: ['passport', 'has passport', 'passport available'],
  tags: ['tags', 'labels', 'categories'],
  notes: ['notes', 'comment', 'comments', 'next action', 'remark'],
};

const norm = (s: string): string => s.trim().toLowerCase().replace(/[\s\-]+/g, '_');

/**
 * Parse a quoted CSV record. Handles double-quoted fields with escaped
 * quotes (""), embedded commas, and CR/LF line endings. Returns the row
 * plus the index just past the closing newline.
 */
function parseCsvLine(text: string, start: number): { row: string[]; next: number } {
  const row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      // consume optional \r\n as one
      if (c === '\r' && text[i + 1] === '\n') i += 2;
      else i++;
      row.push(field);
      return { row, next: i };
    }
    field += c;
    i++;
  }
  row.push(field);
  return { row, next: text.length };
}

function parseCsv(text: string): { headers: string[]; rows: ImportRow[] } {
  // strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (!text.trim()) return { headers: [], rows: [] };
  const { row: headers, next } = parseCsvLine(text, 0);
  const rows: ImportRow[] = [];
  let cursor = next;
  while (cursor < text.length) {
    if (text[cursor] === '\n' || text[cursor] === '\r') {
      cursor++;
      continue;
    }
    const { row, next: end } = parseCsvLine(text, cursor);
    cursor = end;
    // skip empty trailing line
    if (row.length === 1 && row[0] === '') continue;
    const obj: ImportRow = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] ?? '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

async function parseXlsx(file: File): Promise<{ headers: string[]; rows: ImportRow[] }> {
  // Dynamic import keeps xlsx out of the main bundle — only loaded when
  // the user actually opens the import modal.
  const xlsx: typeof import('xlsx') = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = xlsx.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };
  const grid: unknown[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!grid.length) return { headers: [], rows: [] };
  const headers = (grid[0] as unknown[]).map((h) => String(h ?? '').trim());
  const rows: ImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] as unknown[];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    const obj: ImportRow = {};
    headers.forEach((h, idx) => {
      const v = row[idx];
      if (v == null) obj[h] = '';
      else if (v instanceof Date) obj[h] = v.toISOString().slice(0, 10);
      else obj[h] = String(v).trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || file.type === 'text/csv') {
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    return { headers, rows, totalRows: rows.length };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { headers, rows } = await parseXlsx(file);
    return { headers, rows, totalRows: rows.length };
  }
  throw new Error(`Unsupported file type: ${file.name}. Use .csv, .xlsx, or .xls.`);
}

/**
 * Heuristically map a list of headers to known fields. Each header is
 * claimed at most once; the first matching synonym wins.
 */
export function guessMapping(headers: string[]): Partial<Record<FieldName, string>> {
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  const result: Partial<Record<FieldName, string>> = {};
  const used = new Set<string>();

  for (const field of SUPPORTED_FIELDS) {
    const syns = SYNONYMS[field];
    for (const s of syns) {
      const match = normHeaders.find((h) => !used.has(h.raw) && h.n === norm(s));
      if (match) {
        result[field] = match.raw;
        used.add(match.raw);
        break;
      }
    }
  }
  return result;
}

/** True if a cell value should be treated as a boolean true. */
export function isTruthy(v: string | undefined | null): boolean {
  if (!v) return false;
  const s = v.toLowerCase().trim();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1' || s === 't';
}

export function isFalsy(v: string | undefined | null): boolean {
  if (!v) return true;
  const s = v.toLowerCase().trim();
  return s === 'false' || s === 'no' || s === 'n' || s === '0' || s === 'f';
}
