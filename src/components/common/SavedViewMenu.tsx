import React, { useState } from 'react';
import { Bookmark, X, Check } from 'lucide-react';
import { SavedView } from '../../utils/saved-views';

interface SavedViewMenuProps {
  label?: string;
  views: SavedView[];
  onSave: (name: string) => void;
  onApply: (view: SavedView) => void;
  onDelete: (id: string) => void;
}

/** Dropdown for named filter presets — shared by the Inbox toolbar and the
 *  Kanban filter bar. Saving snapshots the caller's current filter state. */
export const SavedViewMenu: React.FC<SavedViewMenuProps> = ({
  label = 'Views',
  views,
  onSave,
  onApply,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = () => {
    const name = nameInput.trim();
    if (!name) return;
    onSave(name);
    setNameInput('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
          open
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
        }`}
        title="Saved filter views"
      >
        <Bookmark className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{label}</span>
        {views.length > 0 && (
          <span className={`text-[10px] font-bold px-1 rounded-full ${open ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
            {views.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-60 space-y-2">
            {/* Save current */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="Name this view…"
                className="flex-1 min-w-0 text-xs px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!nameInput.trim()}
                className="px-2 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded transition-colors cursor-pointer shrink-0"
              >
                {justSaved ? <Check className="w-3 h-3" /> : 'Save'}
              </button>
            </div>

            {/* Saved list */}
            {views.length === 0 ? (
              <p className="text-[11px] text-slate-400 px-1 py-1">
                No saved views yet — set filters and save them here.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                {views.map((v) => (
                  <div key={v.id} className="flex items-center gap-1 group py-1">
                    <button
                      type="button"
                      onClick={() => {
                        onApply(v);
                        setOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left px-1.5 py-1 rounded text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer truncate"
                      title={`Apply view "${v.name}"`}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v.id)}
                      className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                      title={`Delete view "${v.name}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
