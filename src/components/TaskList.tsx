import React, { useState, useMemo } from 'react';
import type {
  GQueueTask,
  QueueList,
  SmartQueueType,
  Priority,
} from '../types/gqueues';
import {
  CheckCircle2,
  Circle,
  Star,
  Calendar,
  Clock,
  Tag,
  Paperclip,
  CheckSquare,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Kanban,
  ExternalLink,
  UserCheck,
  CheckCheck,
  Repeat,
  Timer,
  Layers,
  Sparkles,
  RotateCcw,
  Flame,
  Link2,
  ShieldAlert,
} from 'lucide-react';
import { formatSecondsToHuman } from '../services/tasksApi';
import { aiParseNaturalTask } from '../services/aiApi';

interface TaskListProps {
  currentQueue: QueueList | null;
  smartQueueType: SmartQueueType | null;
  tasks: GQueueTask[];
  allTasks?: GQueueTask[];
  allQueues: QueueList[];
  searchQuery: string;
  selectedTag: string | null;
  onToggleComplete: (task: GQueueTask) => Promise<void>;
  onToggleStar: (task: GQueueTask) => Promise<void>;
  onQuickAddTask: (title: string, due?: string, priority?: Priority) => Promise<void>;
  onSelectTask: (task: GQueueTask) => void;
  onDeleteTask: (task: GQueueTask) => void;
  onClearCompleted?: () => void;
  onEditQueue?: (queue: QueueList) => void;
  onToggleSubtask: (task: GQueueTask, subtaskId: string) => Promise<void>;
  onAddSubtask: (task: GQueueTask, subtaskTitle: string) => Promise<void>;
  onUpdatePriority?: (task: GQueueTask, priority: Priority) => Promise<void>;
  onUpdateDueDate?: (task: GQueueTask, due?: string) => Promise<void>;
  onBatchComplete?: (tasks: GQueueTask[]) => Promise<void>;
  onBatchDelete?: (tasks: GQueueTask[]) => void;
  onOpenCompletedView?: () => void;
  onOpenKanbanView?: () => void;
  onEnterFocusMode?: (task: GQueueTask) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  currentQueue,
  smartQueueType,
  tasks,
  allTasks = [],
  allQueues,
  searchQuery,
  selectedTag,
  onToggleComplete,
  onToggleStar,
  onQuickAddTask,
  onSelectTask,
  onDeleteTask,
  onClearCompleted,
  onEditQueue,
  onToggleSubtask,
  onAddSubtask,
  onUpdatePriority,
  onUpdateDueDate,
  onBatchComplete,
  onBatchDelete,
  onOpenCompletedView,
  onOpenKanbanView,
  onEnterFocusMode,
}) => {
  // Quick Add input state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDue, setQuickDue] = useState('');
  const [quickPriority, setQuickPriority] = useState<Priority>('none');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  // Sorting and filtering
  const [sortBy, setSortBy] = useState<'due' | 'priority' | 'title' | 'updated'>('due');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [showCompletedSection, setShowCompletedSection] = useState(false);

  // Batch selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Inline expanded subtasks state
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [inlineSubtaskInput, setInlineSubtaskInput] = useState<Record<string, string>>({});

  const toggleSubtasksExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || isSubmittingQuick) return;

    setIsSubmittingQuick(true);
    try {
      await onQuickAddTask(quickTitle.trim(), quickDue || undefined, quickPriority);
      setQuickTitle('');
      setQuickDue('');
      setQuickPriority('none');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiParseMessage, setAiParseMessage] = useState<string | null>(null);

  const handleAISmartAdd = async () => {
    if (!quickTitle.trim() || isParsingAI) return;
    setIsParsingAI(true);
    setAiParseMessage(null);
    try {
      const parsed = await aiParseNaturalTask(quickTitle);
      if (parsed.title) setQuickTitle(parsed.title);
      if (parsed.dueDate) setQuickDue(parsed.dueDate);
      if (parsed.priority && parsed.priority !== 'none') setQuickPriority(parsed.priority);
      setAiParseMessage('✨ Smart fields applied!');
      setTimeout(() => setAiParseMessage(null), 3500);
    } catch (err: any) {
      console.error('AI smart add parse failed:', err);
      setAiParseMessage(`⚠️ ${err.message || 'Could not parse fields'}`);
      setTimeout(() => setAiParseMessage(null), 4000);
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleInlineAddSubtask = async (task: GQueueTask, e: React.FormEvent) => {
    e.preventDefault();
    const val = (inlineSubtaskInput[task.id] || '').trim();
    if (!val) return;
    await onAddSubtask(task, val);
    setInlineSubtaskInput((prev) => ({ ...prev, [task.id]: '' }));
  };

  // Cycle priority on click
  const cyclePriority = (task: GQueueTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdatePriority) return;
    const order: Priority[] = ['none', 'low', 'medium', 'high', 'urgent'];
    const curIdx = order.indexOf(task.priority || 'none');
    const nextPriority = order[(curIdx + 1) % order.length];
    onUpdatePriority(task, nextPriority);
  };

  // Priority ranking for sorting
  const priorityRank: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
    none: 0,
  };

  // Filter tasks based on search, tags, priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNotes = t.notes.toLowerCase().includes(q);
        const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchNotes && !matchTags) return false;
      }

      // Tag filter
      if (selectedTag) {
        if (!t.tags.includes(selectedTag)) return false;
      }

      // Priority filter
      if (filterPriority !== 'all') {
        if (t.priority !== filterPriority) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedTag, filterPriority]);

  // Separate active and completed tasks
  const activeTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status !== 'completed');
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === 'completed');
  }, [filteredTasks]);

  // Sort tasks
  const sortedActiveTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      if (sortBy === 'due') {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return sortOrder === 'asc' ? a.due.localeCompare(b.due) : b.due.localeCompare(a.due);
      }
      if (sortBy === 'priority') {
        const diff = priorityRank[b.priority] - priorityRank[a.priority];
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortBy === 'title') {
        return sortOrder === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      }
      return sortOrder === 'asc'
        ? (a.updated || '').localeCompare(b.updated || '')
        : (b.updated || '').localeCompare(a.updated || '');
    });
  }, [activeTasks, sortBy, sortOrder]);

  // Multi-select helpers
  const toggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.size === activeTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(activeTasks.map((t) => t.id)));
    }
  };

  const selectedTasksList = useMemo(() => {
    return activeTasks.filter((t) => selectedTaskIds.has(t.id));
  }, [activeTasks, selectedTaskIds]);

  // Helper for due date display
  const getDueStatus = (dueStr?: string) => {
    if (!dueStr) return null;
    const today = new Date().toISOString().split('T')[0];
    const target = dueStr.split('T')[0];

    if (target < today) {
      return { label: `Overdue (${target})`, isOverdue: true, isToday: false };
    }
    if (target === today) {
      return { label: 'Due Today', isOverdue: false, isToday: true };
    }
    return { label: `Due ${target}`, isOverdue: false, isToday: false };
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'urgent':
        return (
          <span
            onClick={(e) => cyclePriority(p as any, e)}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer transition-colors shadow-2xs"
            title="Urgent Priority (Click to change)"
          >
            🔴 URGENT
          </span>
        );
      case 'high':
        return (
          <span
            onClick={(e) => cyclePriority(p as any, e)}
            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer transition-colors"
            title="High Priority (Click to change)"
          >
            🟠 HIGH
          </span>
        );
      case 'medium':
        return (
          <span
            onClick={(e) => cyclePriority(p as any, e)}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors"
            title="Medium Priority (Click to change)"
          >
            🔵 MED
          </span>
        );
      case 'low':
        return (
          <span
            onClick={(e) => cyclePriority(p as any, e)}
            className="px-2 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
            title="Low Priority (Click to change)"
          >
            ⚪ LOW
          </span>
        );
      default:
        return (
          <span
            onClick={(e) => cyclePriority(p as any, e)}
            className="text-[10px] text-slate-300 hover:text-slate-500 cursor-pointer p-0.5"
            title="Set Priority"
          >
            + Priority
          </span>
        );
    }
  };

  // Header Title calculation
  const headerTitle = useMemo(() => {
    if (currentQueue) return currentQueue.title;
    if (smartQueueType) {
      switch (smartQueueType) {
        case 'today':
          return 'Due Today';
        case 'overdue':
          return 'Overdue Tasks';
        case 'upcoming':
          return 'Upcoming (7 Days)';
        case 'starred':
          return 'Starred & Urgent';
        case 'all':
          return 'All Active Tasks';
        case 'completed':
          return 'Completed Tasks';
      }
    }
    return 'My Tasks';
  }, [currentQueue, smartQueueType]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/60 overflow-hidden relative">
      {/* Queue View Top Toolbar */}
      <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Title and Category info */}
        <div className="flex items-center gap-3">
          {currentQueue?.color && (
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-2xs flex-shrink-0"
              style={{ backgroundColor: currentQueue.color }}
            />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {headerTitle}
              </h2>
              {currentQueue?.category && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {currentQueue.category}
                </span>
              )}
              {selectedTag && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> #{selectedTag}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>
                {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
              </span>
              <span>•</span>
              <span className="text-emerald-600 font-medium">
                {completedTasks.length} completed
              </span>
              {currentQueue && onEditQueue && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => onEditQueue(currentQueue)}
                    className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Queue
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* View Shortcuts & Actions */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Quick Kanban shortcut */}
          {onOpenKanbanView && (
            <button
              onClick={onOpenKanbanView}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
              title="Switch to Kanban Board view"
            >
              <Kanban className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Kanban Board</span>
            </button>
          )}

          {/* Quick Completed View shortcut */}
          {onOpenCompletedView && (
            <button
              onClick={onOpenCompletedView}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition-colors"
              title="Open full completed tasks archive"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Completed ({completedTasks.length})</span>
            </button>
          )}

          {/* Priority filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">⚪ Low</option>
            </select>
          </div>

          {/* Sort Menu */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="due">Sort by Due Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="title">Sort by Title</option>
              <option value="updated">Sort by Updated</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-1 text-slate-500 hover:text-slate-800 font-bold"
              title="Toggle asc/desc"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {completedTasks.length > 0 && onClearCompleted && (
            <button
              onClick={onClearCompleted}
              className="text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 font-medium"
              title="Clear completed tasks in this queue"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Quick Add Bar */}
        <form
          onSubmit={handleQuickAddSubmit}
          className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex flex-wrap items-center gap-2"
        >
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Plus className="w-5 h-5 text-slate-400 ml-1 flex-shrink-0" />
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Add a task (e.g. 'Finalize budget spreadsheet'). Press Enter to save..."
              className="w-full text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400 font-medium text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Due Date */}
            <input
              type="date"
              value={quickDue}
              onChange={(e) => setQuickDue(e.target.value)}
              title="Set Due Date"
              className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-600 cursor-pointer"
            />

            {/* Quick Priority */}
            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as Priority)}
              className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-600 cursor-pointer"
            >
              <option value="none">Priority</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">⚪ Low</option>
            </select>

            {/* AI Smart Parse Button */}
            <button
              type="button"
              onClick={handleAISmartAdd}
              disabled={!quickTitle.trim() || isParsingAI}
              className="px-2.5 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-indigo-200 text-indigo-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              title="Parse natural language with Gemini AI (e.g. 'Submit report next Friday urgent')"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isParsingAI ? 'Parsing...' : 'AI Parse'}</span>
            </button>

            <button
              type="submit"
              disabled={!quickTitle.trim() || isSubmittingQuick}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              {isSubmittingQuick ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        {/* AI Parse Feedback Notification */}
        {aiParseMessage && (
          <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-900 flex items-center justify-between shadow-2xs animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              {aiParseMessage}
            </span>
            <button
              type="button"
              onClick={() => setAiParseMessage(null)}
              className="text-indigo-400 hover:text-indigo-700 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Tasks List */}
        <div className="space-y-2">
          {sortedActiveTasks.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">All caught up!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {filterPriority !== 'all' || selectedTag
                  ? 'No tasks match your current priority or tag filter.'
                  : 'No active tasks in this queue. Type in the bar above to add a new task directly to Google Tasks.'}
              </p>
            </div>
          ) : (
            sortedActiveTasks.map((task) => {
              const dueInfo = getDueStatus(task.due);
              const subtasksDone = task.subtasks.filter((s) => s.completed).length;
              const hasSubtasks = task.subtasks.length > 0;
              const subtaskPct = hasSubtasks ? Math.round((subtasksDone / task.subtasks.length) * 100) : 0;
              const isSubExpanded = !!expandedSubtasks[task.id];
              const isSelected = selectedTaskIds.has(task.id);

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl border transition-all group overflow-hidden ${
                    isSelected
                      ? 'border-blue-400 ring-2 ring-blue-100 shadow-xs'
                      : 'border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div
                    onClick={() => onSelectTask(task)}
                    className="p-3.5 flex items-start justify-between gap-3 cursor-pointer"
                  >
                    {/* Left: Complete Checkbox + Star + Select */}
                    <div className="flex items-center gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      {/* Batch selector */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectTask(task.id, e as any)}
                        className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity"
                        title="Select for batch action"
                      />

                      {/* Complete Checkbox */}
                      <button
                        type="button"
                        onClick={() => onToggleComplete(task)}
                        className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5 rounded-full"
                        title="Mark task completed"
                      >
                        <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-500" />
                      </button>

                      {/* Star Flag */}
                      <button
                        type="button"
                        onClick={() => onToggleStar(task)}
                        className="p-0.5 text-slate-300 hover:text-amber-500 transition-colors"
                        title="Star / Favorite"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            task.starred
                              ? 'text-amber-500 fill-amber-400'
                              : 'text-slate-300 hover:text-amber-400'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Middle: Title, Subtask summary, Due badge, Tags */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                          {task.title}
                        </span>

                        {/* Priority Badge */}
                        <div onClick={(e) => cyclePriority(task, e)}>
                          {getPriorityBadge(task.priority)}
                        </div>

                        {/* Due Date Badge */}
                        {dueInfo && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              dueInfo.isOverdue
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : dueInfo.isToday
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{dueInfo.label}</span>
                          </span>
                        )}

                        {/* Time estimate */}
                        {task.timeEstimate && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                            <Timer className="w-3 h-3 text-slate-400" />
                            <span>{task.timeEstimate}</span>
                          </span>
                        )}

                        {/* Recurring badge */}
                        {task.recurring && task.recurring !== 'none' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-medium capitalize">
                            <Repeat className="w-3 h-3" />
                            <span>{task.recurring}</span>
                          </span>
                        )}

                        {/* Assigned Contact */}
                        {task.assignedContact && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium"
                            title={`Assigned to ${task.assignedContact.name} (${task.assignedContact.email})`}
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>{task.assignedContact.name}</span>
                            {task.assignedContact.email.toLowerCase().includes('coolaire') && (
                              <span className="text-[9px] text-indigo-800 font-bold bg-indigo-100/80 px-1 rounded">
                                Coolaire
                              </span>
                            )}
                          </span>
                        )}

                        {/* Drive Attachments summary */}
                        {task.driveAttachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                            <Paperclip className="w-3 h-3" />
                            <span>{task.driveAttachments.length}</span>
                          </span>
                        )}

                        {/* Calendar Sync indicator with Assignee reflection */}
                        {task.calendarEventId && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold"
                            title={
                              task.assignedContact
                                ? `Synced to Google Calendar & invited ${task.assignedContact.name} (${task.assignedContact.email})`
                                : 'Synced to Google Calendar'
                            }
                          >
                            <Calendar className="w-3 h-3 text-amber-600" />
                            <span>
                              {task.assignedContact
                                ? `On ${task.assignedContact.name.split(' ')[0]}’s Cal`
                                : 'On Cal'}
                            </span>
                          </span>
                        )}

                        {/* Task Dependency / Blocked indicator */}
                        {task.dependsOn && task.dependsOn.length > 0 && (() => {
                          const prereqList = (allTasks || tasks).filter((t) => task.dependsOn?.includes(t.id));
                          const blockedBy = prereqList.filter((t) => t.status !== 'completed');
                          const isBlocked = blockedBy.length > 0;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold border transition-colors ${
                                isBlocked
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                              title={
                                isBlocked
                                  ? `Blocked by ${blockedBy.length} task(s): ${blockedBy.map((t) => t.title).join(', ')}`
                                  : `All ${task.dependsOn.length} prerequisites completed!`
                              }
                            >
                              {isBlocked ? (
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                              ) : (
                                <Link2 className="w-3 h-3 text-emerald-600" />
                              )}
                              <span>{isBlocked ? `Blocked (${blockedBy.length})` : `${task.dependsOn.length} deps`}</span>
                            </span>
                          );
                        })()}

                        {/* Total time spent badge */}
                        {task.totalTimeSpentSeconds > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-bold"
                            title={`Time logged: ${formatSecondsToHuman(task.totalTimeSpentSeconds)}`}
                          >
                            <Clock className="w-3 h-3 text-purple-600" />
                            <span>{formatSecondsToHuman(task.totalTimeSpentSeconds)}</span>
                          </span>
                        )}
                      </div>

                      {/* Notes snippet */}
                      {task.notes && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {task.notes}
                        </p>
                      )}

                      {/* Bottom row: Subtasks progress bar and Tags */}
                      <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                        {/* Subtasks Progress */}
                        {hasSubtasks ? (
                          <button
                            type="button"
                            onClick={(e) => toggleSubtasksExpand(task.id, e)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            <span>
                              {subtasksDone}/{task.subtasks.length} subtasks ({subtaskPct}%)
                            </span>
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-1">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${subtaskPct}%` }}
                              />
                            </div>
                            {isSubExpanded ? (
                              <ChevronDown className="w-3 h-3 ml-0.5" />
                            ) : (
                              <ChevronRight className="w-3 h-3 ml-0.5" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => toggleSubtasksExpand(task.id, e)}
                            className="text-[10px] text-slate-400 hover:text-blue-600 inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add subtasks
                          </button>
                        )}

                        {/* Tags */}
                        {task.tags.map((tg) => (
                          <span
                            key={tg}
                            className="text-[10px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div
                      className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onEnterFocusMode && (
                        <button
                          type="button"
                          onClick={() => onEnterFocusMode(task)}
                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Enter Focus Mode"
                        >
                          <Flame className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onSelectTask(task)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit full task details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete task from Google Tasks"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Expanded Subtasks Section */}
                  {isSubExpanded && (
                    <div className="bg-slate-50/90 border-t border-slate-100 p-3 space-y-2">
                      <div className="space-y-1.5 pl-4 sm:pl-7">
                        {task.subtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 text-xs text-slate-700"
                          >
                            <button
                              type="button"
                              onClick={() => onToggleSubtask(task, sub.id)}
                              className="text-slate-400 hover:text-emerald-600 transition-colors"
                            >
                              {sub.completed ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </button>
                            <span
                              className={
                                sub.completed ? 'line-through text-slate-400' : 'text-slate-800'
                              }
                            >
                              {sub.title}
                            </span>
                          </div>
                        ))}

                        {/* Inline subtask quick add */}
                        <form
                          onSubmit={(e) => handleInlineAddSubtask(task, e)}
                          className="flex items-center gap-2 pt-1"
                        >
                          <input
                            type="text"
                            placeholder="Add subtask step..."
                            value={inlineSubtaskInput[task.id] || ''}
                            onChange={(e) =>
                              setInlineSubtaskInput((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 w-60"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium"
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Completed Tasks Accordion */}
        {completedTasks.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowCompletedSection(!showCompletedSection)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                {showCompletedSection ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span>Completed Tasks in this Queue ({completedTasks.length})</span>
              </button>

              {onOpenCompletedView && (
                <button
                  onClick={onOpenCompletedView}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Open Full Archive</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {showCompletedSection && (
              <div className="space-y-1.5 opacity-90 animate-in fade-in duration-150">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-white/80 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleComplete(task)}
                        className="text-emerald-600 hover:text-blue-600 p-0.5 transition-colors"
                        title="Click to restore / uncomplete task"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </button>
                      <span className="line-through text-slate-500 truncate font-medium">
                        {task.title}
                      </span>
                      {task.completed && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          ({new Date(task.completed).toLocaleDateString()})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleComplete(task)}
                        className="px-2 py-0.5 text-[11px] text-blue-600 bg-blue-50 hover:bg-blue-100 rounded font-medium flex items-center gap-1"
                        title="Restore this task"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1 text-slate-300 hover:text-red-500 rounded"
                        title="Delete completed task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Batch Actions Toolbar (when tasks are selected) */}
      {selectedTaskIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 border border-slate-700">
          <span className="font-bold text-blue-300">
            {selectedTaskIds.size} selected
          </span>
          <span className="text-slate-600">|</span>

          {onBatchComplete && (
            <button
              onClick={async () => {
                await onBatchComplete(selectedTasksList);
                setSelectedTaskIds(new Set());
              }}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark Done</span>
            </button>
          )}

          {onBatchDelete && (
            <button
              onClick={() => {
                onBatchDelete(selectedTasksList);
                setSelectedTaskIds(new Set());
              }}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}

          <button
            onClick={() => setSelectedTaskIds(new Set())}
            className="text-slate-400 hover:text-slate-200 ml-2 cursor-pointer"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
};
