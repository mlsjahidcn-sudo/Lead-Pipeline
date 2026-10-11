/**
 * Named filter presets, persisted per device in localStorage. A "view" is
 * the full filter/search (plus sort, for the inbox) state of a surface.
 */

export type SavedViewSurface = 'inbox' | 'kanban';

export interface SavedView {
  id: string;
  name: string;
  surface: SavedViewSurface;
  payload: Record<string, unknown>;
  createdAt: string;
}

const STORAGE_KEY = 'mhr_saved_views';

const genId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC4122 v4 fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function loadSavedViews(surface: SavedViewSurface): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as SavedView[];
    return all.filter((v) => v && v.surface === surface && typeof v.name === 'string');
  } catch {
    return [];
  }
}

export function persistSavedView(view: Omit<SavedView, 'id' | 'createdAt'> & { id?: string }): SavedView {
  const full: SavedView = {
    id: view.id ?? genId(),
    createdAt: new Date().toISOString(),
    ...view,
  };
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedView[];
    } catch {
      return [];
    }
  })();
  all.push(full);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full / private mode — view just won't persist */
  }
  return full;
}

export function deleteSavedView(id: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedView[];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((v) => v.id !== id)));
  } catch {
    /* nothing to clean up */
  }
}
