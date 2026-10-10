import React, { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { Search, X, Copy, Check, CornerDownLeft } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import {
  searchAll,
  KIND_LABELS,
  KIND_PILL,
  KIND_SHORT,
  type SearchResult,
} from '../utils/search-rank';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectLead: (leadId: string) => void;
  onJumpToToday: () => void;
}

const EXAMPLES = [
  '0171… for a phone number',
  '"Farhan" for a student name',
  '"Hot" for a tag or keyword',
];

export const GlobalSearchPalette: React.FC<Props> = ({ open, onClose, onSelectLead, onJumpToToday }) => {
  const ctx = useCrm();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setToast(null);
      // focus the input on the next tick (after render)
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { groups, flat } = useMemo(() => {
    return searchAll(deferredQuery, {
      leads: ctx.leads,
      employees: ctx.employees,
      sources: ctx.sources,
      activities: ctx.activities,
      tasks: ctx.tasks,
      visits: ctx.visits,
      payments: ctx.payments,
      stageHistory: ctx.stageHistory,
      lostReasons: ctx.lostReasons,
    });
  }, [
    deferredQuery,
    ctx.leads,
    ctx.employees,
    ctx.sources,
    ctx.activities,
    ctx.tasks,
    ctx.visits,
    ctx.payments,
    ctx.stageHistory,
    ctx.lostReasons,
  ]);

  // Clamp active index when results change
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(Math.max(0, flat.length - 1));
  }, [flat.length, activeIndex]);

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setToast(`Copied: ${text}`);
      setTimeout(() => setToast(null), 1800);
    } catch {
      setToast('Could not copy to clipboard');
      setTimeout(() => setToast(null), 1800);
    }
  };

  const handleSelect = (r: SearchResult) => {
    if (r.kind === 'lead') {
      onSelectLead(r.id);
      onClose();
      return;
    }
    if (r.kind === 'task') {
      onJumpToToday();
      onClose();
      return;
    }
    // For everything else, copy a useful identifier to the clipboard so
    // the data is at least retrievable. Future iterations can wire to detail
    // views.
    const payload = r.payload as unknown as { id?: string | number };
    const text = payload?.id != null ? `${r.kind}:${payload.id}` : r.title;
    copyToClipboard(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const r = flat[activeIndex];
      if (r) handleSelect(r);
      return;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-active="true"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const totalAcrossGroups = groups.reduce((s, g) => s + g.totalMatches, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-12 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onMouseDown={(e) => {
        // close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-4.5 h-4.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            data-global-search-input="true"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search leads, tasks, team, sources, payments…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={flat[activeIndex] ? `search-result-${flat[activeIndex].kind}-${flat[activeIndex].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200 rounded">
            esc
          </kbd>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto"
        >
          {query.trim() === '' ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">What you can search</p>
              <ul className="mt-3 text-xs text-slate-500 space-y-1.5 max-w-sm mx-auto">
                {EXAMPLES.map((ex) => (
                  <li key={ex} className="font-mono">{ex}</li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-slate-400">
                {ctx.leads.length} leads · {ctx.tasks.length} tasks · {ctx.employees.length} team · {ctx.activities.length} activities
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No matches for "{query}"</p>
              <p className="text-xs text-slate-500 mt-1">Try a shorter query, a name, or a phone number.</p>
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <section key={group.kind} className="py-1.5">
                  <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 sticky top-0 bg-white/95 backdrop-blur z-10">
                    <span>{group.label}</span>
                    <span className="text-slate-300">·</span>
                    <span>{group.totalMatches} match{group.totalMatches === 1 ? '' : 'es'}</span>
                    {group.totalMatches > group.items.length && (
                      <span className="text-slate-300">·</span>
                    )}
                    {group.totalMatches > group.items.length && (
                      <span className="text-slate-400 normal-case font-normal">
                        showing {group.items.length}
                      </span>
                    )}
                  </div>
                  {group.items.map((r) => {
                    const globalIndex = flat.indexOf(r);
                    const isActive = globalIndex === activeIndex;
                    const id = `search-result-${r.kind}-${r.id}`;
                    return (
                      <button
                        key={id}
                        id={id}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        onClick={() => handleSelect(r)}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2 border-l-2 ${
                          isActive
                            ? 'border-blue-600 bg-blue-50/60'
                            : 'border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-12 text-center shrink-0 ${KIND_PILL[r.kind]}`}>
                          {KIND_SHORT[r.kind]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {r.title}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {r.subtitle}
                          </div>
                        </div>
                        {r.meta && (
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">
                            {r.meta}
                          </span>
                        )}
                        {isActive && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">↵</kbd>
              <span>open</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totalAcrossGroups > 0 && (
              <span className="text-slate-400">{totalAcrossGroups} total match{totalAcrossGroups === 1 ? '' : 'es'}</span>
            )}
            {toast && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Check className="w-3 h-3" />
                {toast}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
