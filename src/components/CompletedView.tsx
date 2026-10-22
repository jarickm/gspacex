import React, { useState, useMemo } from 'react';
import type { GQueueTask, QueueList } from '../types/gqueues';
import {
  CheckCircle2,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  Calendar,
  Tag,
  ArrowUpDown,
  Download,
  Folder,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface CompletedViewProps {
  tasks: GQueueTask[];
  queues: QueueList[];
  onUncompleteTask: (task: GQueueTask) => Promise<void>;
  onDeleteTask: (task: GQueueTask) => void;
  onSelectTask: (task: GQueueTask) => void;
  onClearAllCompleted: () => void;
}

export const CompletedView: React.FC<CompletedViewProps> = ({
  tasks,
  queues,
  onUncompleteTask,
  onDeleteTask,
  onSelectTask,
  onClearAllCompleted,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'completedDate' | 'title' | 'queue'>('completedDate');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Filter only completed tasks
  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'completed');
  }, [tasks]);

  // Queue lookup helper
  const queueMap = useMemo(() => {
    const map = new Map<string, QueueList>();
    for (const q of queues) {
      map.set(q.id, q);
    }
    return map;
  }, [queues]);

  // Filtered completed tasks
  const filteredCompleted = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    return completedTasks.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNotes = t.notes.toLowerCase().includes(q);
        const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchNotes && !matchTags) return false;
      }

      // Queue filter
      if (selectedQueueFilter !== 'all' && t.listId !== selectedQueueFilter) {
        return false;
      }

      // Time filter
      const completedTime = t.completed || t.completedAt || t.updated;
      if (timeFilter === 'today') {
        if (!completedTime || !completedTime.startsWith(todayStr)) return false;
      } else if (timeFilter === 'week') {
        if (!completedTime || completedTime < sevenDaysAgo) return false;
      } else if (timeFilter === 'month') {
        if (!completedTime || completedTime < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [completedTasks, searchQuery, selectedQueueFilter, timeFilter]);

  // Sort
  const sortedTasks = useMemo(() => {
    return [...filteredCompleted].sort((a, b) => {
      if (sortBy === 'completedDate') {
        const timeA = a.completed || a.completedAt || a.updated || '';
        const timeB = b.completed || b.completedAt || b.updated || '';
        return timeB.localeCompare(timeA); // Most recent first
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'queue') {
        const qA = queueMap.get(a.listId)?.title || '';
        const qB = queueMap.get(b.listId)?.title || '';
        return qA.localeCompare(qB);
      }
      return 0;
    });
  }, [filteredCompleted, sortBy, queueMap]);

  // Group by date bucket
  const groupedTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const groups: Record<string, GQueueTask[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 Days': [],
      Earlier: [],
    };

    for (const t of sortedTasks) {
      const dateStr = (t.completed || t.completedAt || t.updated || '').split('T')[0];
      if (dateStr === today) {
        groups.Today.push(t);
      } else if (dateStr === yesterdayStr) {
        groups.Yesterday.push(t);
      } else if (dateStr >= sevenDaysAgo) {
        groups['Last 7 Days'].push(t);
      } else {
        groups.Earlier.push(t);
      }
    }

    return groups;
  }, [sortedTasks]);

  // Stats
  const completedTodayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return completedTasks.filter((t) => (t.completed || t.completedAt || t.updated || '').startsWith(today)).length;
  }, [completedTasks]);

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.size === sortedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(sortedTasks.map((t) => t.id)));
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Title', 'Queue', 'Completed Date', 'Priority', 'Tags', 'Notes'];
    const rows = sortedTasks.map((t) => {
      const q = queueMap.get(t.listId)?.title || 'Queue';
      const cDate = t.completed || t.completedAt || t.updated || '';
      return [
        `"${t.title.replace(/"/g, '""')}"`,
        `"${q.replace(/"/g, '""')}"`,
        `"${cDate}"`,
        `"${t.priority}"`,
        `"${t.tags.join(', ')}"`,
        `"${t.notes.replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Completed-Tasks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Banner / Stats */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">All Completed Tasks</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {completedTasks.length} Done
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Complete history of completed tasks across all Google Workspace queues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={completedTasks.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all disabled:opacity-40"
              title="Export completed tasks to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {completedTasks.length > 0 && (
              <button
                onClick={onClearAllCompleted}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI stats chips */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="font-bold text-slate-900">{completedTodayCount}</span> completed today
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="font-bold text-slate-900">{completedTasks.length}</span> total completed
          </div>
          <span className="text-slate-300">•</span>
          <div className="text-slate-500">Stored in real Google Tasks cloud</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="px-6 py-3 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search completed tasks or #tags..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Queue selector */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedQueueFilter}
              onChange={(e) => setSelectedQueueFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="all">All Queues</option>
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="all">Any Date</option>
              <option value="today">Completed Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="completedDate">Recent First</option>
              <option value="title">By Title</option>
              <option value="queue">By Queue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List grouped by time bucket */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {sortedTasks.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No completed tasks found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedQueueFilter !== 'all' || timeFilter !== 'all'
                ? 'No completed tasks matched your current filter.'
                : 'Tasks marked as completed in your queues will appear here with full history and restore options.'}
            </p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([groupTitle, taskGroup]) => {
            if (taskGroup.length === 0) return null;

            return (
              <div key={groupTitle} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{groupTitle}</span>
                    <span className="text-[10px] font-normal text-slate-400">({taskGroup.length})</span>
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {taskGroup.map((task) => {
                    const queue = queueMap.get(task.listId);
                    const completedDateFormatted = (task.completed || task.completedAt || task.updated)
                      ? new Date(task.completed || task.completedAt || task.updated).toLocaleString()
                      : 'Completed';

                    return (
                      <div
                        key={task.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                      >
                        {/* Left Checkbox / Uncomplete */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => onUncompleteTask(task)}
                            className="text-emerald-600 hover:text-blue-600 p-0.5 rounded-full transition-colors flex-shrink-0"
                            title="Click to restore / uncomplete task"
                          >
                            <CheckCircle2 className="w-5 h-5 fill-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform" />
                          </button>

                          <div
                            onClick={() => onSelectTask(task)}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-semibold text-slate-500 line-through truncate">
                                {task.title}
                              </span>

                              {/* Queue Badge */}
                              {queue && (
                                <span
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                                  style={{
                                    backgroundColor: `${queue.color}15`,
                                    color: queue.color,
                                    border: `1px solid ${queue.color}30`,
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: queue.color }}
                                  />
                                  <span>{queue.title}</span>
                                </span>
                              )}

                              {/* Subtasks summary */}
                              {task.subtasks.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.2 rounded">
                                  {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                                </span>
                              )}

                              {/* Tags */}
                              {task.tags.map((tg) => (
                                <span
                                  key={tg}
                                  className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-medium"
                                >
                                  #{tg}
                                </span>
                              ))}
                            </div>

                            {task.notes && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-lg">
                                {task.notes}
                              </p>
                            )}

                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                              <span>Finished: {completedDateFormatted}</span>
                              {task.due && <span>• Due was: {task.due.split('T')[0]}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Right Quick Actions: Restore & Permanent Delete */}
                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onUncompleteTask(task)}
                            className="px-2.5 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors flex items-center gap-1"
                            title="Restore this task to active queue"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span className="hidden sm:inline">Restore</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteTask(task)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
