import React, { useState } from 'react';
import type { GQueueTask, QueueList } from '../types/gqueues';
import { Download, FileText, Code, Printer, X, Check } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: GQueueTask[];
  queues: QueueList[];
  currentQueue: QueueList | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  queues,
  currentQueue,
}) => {
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'print'>('csv');
  const [isExported, setIsExported] = useState(false);

  if (!isOpen) return null;

  const targetTasks =
    exportScope === 'current' && currentQueue
      ? tasks.filter((t) => t.listId === currentQueue.id)
      : tasks;

  const handleExport = () => {
    if (exportFormat === 'csv') {
      const headers = ['Title', 'Status', 'Due Date', 'Priority', 'Tags', 'Notes', 'Subtasks'];
      const rows = targetTasks.map((t) => [
        `"${t.title.replace(/"/g, '""')}"`,
        `"${t.status}"`,
        `"${t.due || ''}"`,
        `"${t.priority}"`,
        `"${t.tags.join(', ')}"`,
        `"${t.notes.replace(/"/g, '""')}"`,
        `"${t.subtasks.map((s) => `${s.completed ? '[x]' : '[ ]'} ${s.title}`).join(' | ')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GQueues-Export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'json') {
      const json = JSON.stringify(targetTasks, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GQueues-Export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'print') {
      window.print();
    }

    setIsExported(true);
    setTimeout(() => {
      setIsExported(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Export Queue & Tasks</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Scope */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Export Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('current')}
                disabled={!currentQueue}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  exportScope === 'current'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <p className="font-semibold truncate">{currentQueue?.title || 'Current Queue'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {targetTasks.length} tasks
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  exportScope === 'all'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <p className="font-semibold">All Queues</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {tasks.length} total tasks
                </p>
              </button>
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Export Format</label>
            <div className="space-y-1.5">
              <div
                onClick={() => setExportFormat('csv')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  exportFormat === 'csv' ? 'border-blue-500 bg-blue-50/60 text-blue-900' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="font-semibold">CSV Spreadsheet (.csv)</p>
                    <p className="text-[10px] text-slate-500">For Google Sheets, Excel, or reporting</p>
                  </div>
                </div>
                {exportFormat === 'csv' && <Check className="w-4 h-4 text-blue-600" />}
              </div>

              <div
                onClick={() => setExportFormat('json')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  exportFormat === 'json' ? 'border-blue-500 bg-blue-50/60 text-blue-900' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="font-semibold">JSON Data (.json)</p>
                    <p className="text-[10px] text-slate-500">Full structured backup with metadata</p>
                  </div>
                </div>
                {exportFormat === 'json' && <Check className="w-4 h-4 text-blue-600" />}
              </div>

              <div
                onClick={() => setExportFormat('print')}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  exportFormat === 'print' ? 'border-blue-500 bg-blue-50/60 text-blue-900' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-slate-600" />
                  <div>
                    <p className="font-semibold">Printable List / PDF</p>
                    <p className="text-[10px] text-slate-500">Print or Save as PDF via browser</p>
                  </div>
                </div>
                {exportFormat === 'print' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5"
          >
            {isExported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isExported ? 'Exported!' : 'Export Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
