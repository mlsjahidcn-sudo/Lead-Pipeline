import React from 'react';
import { Upload } from 'lucide-react';

interface Props {
  onClick: () => void;
  title?: string;
}

export const ImportButton: React.FC<Props> = ({ onClick, title = 'Import leads from CSV / XLSX' }) => (
  <button
    onClick={onClick}
    title={title}
    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md transition-colors"
  >
    <Upload className="w-3.5 h-3.5" />
    <span>Import</span>
  </button>
);
