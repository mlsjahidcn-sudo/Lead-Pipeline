/**
 * Shared tag helpers: popular-tag suggestions (used by both the create and
 * edit lead forms) and the display filter that hides system/import-metadata
 * tags from compact surfaces like the inbox table.
 */

export const POPULAR_TAG_SUGGESTIONS = [
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

/**
 * Tags that are sheet/import plumbing rather than human categorization
 * (e.g. "import:mhr-google-sheets-leads", "source-lead-id:CN-0250",
 * "sheet-stage:Documents Pending", "priority:high", "needs-name").
 * Hidden in table/card display; still editable in the lead form.
 */
const SYSTEM_TAG_PREFIXES = [
  'import:',
  'source-lead-id:',
  'source-',
  'sheet-',
  'priority:',
  'needs-',
  'imported-',
];

export const isSystemTag = (tag: string): boolean =>
  SYSTEM_TAG_PREFIXES.some((p) => tag.toLowerCase().startsWith(p));

export const getDisplayTags = (tags: string[] | undefined): string[] =>
  Array.isArray(tags) ? tags.filter((t) => !isSystemTag(t)) : [];
