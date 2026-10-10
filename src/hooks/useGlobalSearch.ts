// Global keybinding + open/close state for the search command palette.
// Mounted once at the App level so the keybinding works from any view.

import { useCallback, useEffect, useState } from 'react';

export interface GlobalSearchController {
  open: boolean;
  setOpen: (next: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export function useGlobalSearch(): GlobalSearchController {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K (mac) / Ctrl+K (win/linux) toggles. Skip when the user is typing
      // in a normal input/textarea/contenteditable — the inline search inputs
      // inside the palette use a regular input so we DO want to capture
      // there too. We only suppress when there's a focused editable that
      // ISN'T the palette's own search input.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        // don't preventDefault if focus is in a textarea (some users want to
        // keep browser default for insert-mode apps); otherwise prevent to
        // suppress the browser's URL-bar focus on Chrome
        if (!isEditable(e.target) || (e.target as HTMLElement)?.getAttribute('data-global-search-input') === 'true') {
          e.preventDefault();
          togglePalette();
        } else {
          // in a normal input outside the palette — still allow toggle
          e.preventDefault();
          togglePalette();
        }
        return;
      }
      // Escape closes the palette; ignore if it's already closed and the
      // user pressed Escape inside another input (let the other input handle it)
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closePalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, togglePalette, closePalette]);

  return { open, setOpen, openPalette, closePalette, togglePalette };
}
