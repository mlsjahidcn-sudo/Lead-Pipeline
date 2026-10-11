import { Lead } from '../types';

export interface DuplicatePair {
  a: Lead; // older lead (earlier created_at) — suggested survivor
  b: Lead;
  matchField: 'phone' | 'whatsapp' | 'email';
}

/**
 * Exact-match duplicate detection across the non-archived lead set:
 * phone_e164 / whatsapp_e164 / lowercase email. Index-based single pass —
 * same matching semantics as checkDuplicateLead, but pairwise for review.
 */
export function findDuplicatePairs(allLeads: Lead[]): DuplicatePair[] {
  const byPhone = new Map<string, Lead[]>();
  const byWhatsapp = new Map<string, Lead[]>();
  const byEmail = new Map<string, Lead[]>();
  const push = (map: Map<string, Lead[]>, key: string | undefined | null, lead: Lead) => {
    const k = (key || '').trim().toLowerCase();
    if (!k) return;
    const list = map.get(k);
    if (list) list.push(lead);
    else map.set(k, [lead]);
  };

  for (const l of allLeads) {
    if (l.duplicate_of) continue;
    push(byPhone, l.phone_e164, l);
    push(byWhatsapp, l.whatsapp_e164, l);
    push(byEmail, l.email, l);
  }

  const seenPairs = new Set<string>();
  const pairs: DuplicatePair[] = [];
  const addPairs = (map: Map<string, Lead[]>, field: DuplicatePair['matchField']) => {
    for (const list of map.values()) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [x, y] = [list[i], list[j]];
          const key = x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`;
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          const olderFirst =
            new Date(x.created_at).getTime() <= new Date(y.created_at).getTime() ? [x, y] : [y, x];
          pairs.push({ a: olderFirst[0], b: olderFirst[1], matchField: field });
        }
      }
    }
  };
  addPairs(byPhone, 'phone');
  addPairs(byWhatsapp, 'whatsapp');
  addPairs(byEmail, 'email');
  return pairs;
}
