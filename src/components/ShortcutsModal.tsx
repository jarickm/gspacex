import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'N', desc: 'Create new task (focus quick add)' },
  { key: 'Q', desc: 'Create new queue / project' },
  { key: '/', desc: 'Search queues, tasks, notes, or tags' },
  { key: '1', desc: 'Switch to Queue List view' },
  { key: '2', desc: 'Switch to Kanban Board view' },
  { key: '3', desc: 'Switch to Calendar schedule view' },
  { key: '4', desc: 'Switch to Completed Tasks archive' },
  { key: 'T', desc: 'Quick jump to "Today" smart queue' },
  { key: 'R', desc: 'Sync & refresh from Google Workspace' },
  { key: 'Esc', desc: 'Close open modals or clear search' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">GQueues Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 divide-y divide-slate-100 text-xs">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">{s.desc}</span>
              <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md font-mono font-bold text-slate-800 shadow-2xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          Press <kbd className="font-mono font-bold">?</kbd> anytime to open this guide
        </div>
      </div>
    </div>
  );
};
