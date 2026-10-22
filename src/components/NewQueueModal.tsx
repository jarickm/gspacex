import React, { useState, useEffect } from 'react';
import type { QueueList } from '../types/gqueues';
import { FolderPlus, X, Check } from 'lucide-react';

interface NewQueueModalProps {
  isOpen: boolean;
  initialQueue?: QueueList | null;
  defaultCategory?: string;
  existingCategories: string[];
  onClose: () => void;
  onSave: (title: string, category: string, color: string) => Promise<void>;
}

const COLOR_OPTIONS = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Indigo', hex: '#4f46e5' },
];

export const NewQueueModal: React.FC<NewQueueModalProps> = ({
  isOpen,
  initialQueue,
  defaultCategory = 'My Queues',
  existingCategories,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [color, setColor] = useState('#2563eb');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialQueue) {
      setTitle(initialQueue.title);
      setCategory(initialQueue.category || defaultCategory);
      setColor(initialQueue.color || '#2563eb');
      setIsCustomCategory(false);
    } else {
      setTitle('');
      setCategory(defaultCategory);
      setColor('#2563eb');
      setIsCustomCategory(false);
    }
  }, [initialQueue, defaultCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalCategory = isCustomCategory ? customCategory.trim() || 'My Queues' : category;

    setIsSaving(true);
    try {
      await onSave(title.trim(), finalCategory, color);
      onClose();
    } catch (err) {
      console.error('Failed to save queue:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {initialQueue ? 'Edit Queue' : 'Create New Queue'}
              </h3>
              <p className="text-xs text-slate-500">Syncs directly with Google Tasks cloud list</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Queue Title */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Queue Name</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Strategy, Client Deliverables, Operations"
              className="w-full px-3 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none transition-all"
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Category / Folder</label>
              <button
                type="button"
                onClick={() => setIsCustomCategory(!isCustomCategory)}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                {isCustomCategory ? 'Choose existing' : '+ New Category'}
              </button>
            </div>

            {isCustomCategory ? (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter new category name (e.g. Marketing, Personal)"
                className="w-full px-3 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none transition-all"
              />
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none"
              >
                <option value="My Queues">My Queues</option>
                {existingCategories
                  .filter((c) => c !== 'My Queues')
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Color Tag */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Accent Color</label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => {
                const isSelected = color === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                    title={c.name}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
            >
              {isSaving ? 'Saving...' : initialQueue ? 'Save Changes' : 'Create Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
