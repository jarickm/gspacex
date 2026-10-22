import React, { useState, useMemo } from 'react';
import type { GQueueTask, KanbanStatus, Priority, QueueList } from '../types/gqueues';
import { formatSecondsToHuman } from '../services/tasksApi';
import {
  Plus,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Paperclip,
  CheckSquare,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  Tag,
  Star,
  ShieldAlert,
  Link2,
  Flame,
} from 'lucide-react';

interface KanbanBoardProps {
  tasks: GQueueTask[];
  allTasks?: GQueueTask[];
  queues: QueueList[];
  currentQueue: QueueList | null;
  onSelectTask: (task: GQueueTask) => void;
  onUpdateTaskStatus: (task: GQueueTask, status: KanbanStatus) => Promise<void>;
  onQuickAddTask: (title: string, status: KanbanStatus) => Promise<void>;
  onToggleComplete: (task: GQueueTask) => Promise<void>;
  onEnterFocusMode?: (task: GQueueTask) => void;
}

const COLUMNS: Array<{ id: KanbanStatus; title: string; color: string; bg: string }> = [
  { id: 'todo', title: 'To Do', color: 'border-blue-500 text-blue-800', bg: 'bg-blue-50/50' },
  { id: 'in_progress', title: 'In Progress', color: 'border-amber-500 text-amber-800', bg: 'bg-amber-50/50' },
  { id: 'waiting', title: 'Waiting / Blocked', color: 'border-purple-500 text-purple-800', bg: 'bg-purple-50/50' },
  { id: 'done', title: 'Done', color: 'border-emerald-500 text-emerald-800', bg: 'bg-emerald-50/50' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  allTasks = [],
  queues,
  currentQueue,
  onSelectTask,
  onUpdateTaskStatus,
  onQuickAddTask,
  onToggleComplete,
  onEnterFocusMode,
}) => {
  const [columnInput, setColumnInput] = useState<Record<KanbanStatus, string>>({
    todo: '',
    in_progress: '',
    waiting: '',
    done: '',
  });
  const [isAddingInCol, setIsAddingInCol] = useState<KanbanStatus | null>(null);

  // Queue map
  const queueMap = useMemo(() => {
    const map = new Map<string, QueueList>();
    for (const q of queues) {
      map.set(q.id, q);
    }
    return map;
  }, [queues]);

  // Group tasks by kanban status
  const tasksByColumn = useMemo(() => {
    const map: Record<KanbanStatus, GQueueTask[]> = {
      todo: [],
      in_progress: [],
      waiting: [],
      done: [],
    };

    for (const t of tasks) {
      if (t.status === 'completed') {
        map.done.push(t);
      } else {
        const col = t.kanbanStatus || 'todo';
        map[col].push(t);
      }
    }

    return map;
  }, [tasks]);

  const handleAddSubmit = async (col: KanbanStatus, e: React.FormEvent) => {
    e.preventDefault();
    const title = (columnInput[col] || '').trim();
    if (!title) return;

    await onQuickAddTask(title, col);
    setColumnInput((prev) => ({ ...prev, [col]: '' }));
    setIsAddingInCol(null);
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'urgent':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">URGENT</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">HIGH</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">MED</span>;
      case 'low':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-600">LOW</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden">
      {/* Board Header */}
      <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Kanban Board</span>
            {currentQueue && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {currentQueue.title}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500">
            Visual project workflow • Move tasks across stages from To Do to Done
          </p>
        </div>
      </div>

      {/* Board Columns Container */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-4 items-start">
        {COLUMNS.map((col) => {
          const colTasks = tasksByColumn[col.id] || [];

          return (
            <div
              key={col.id}
              className="w-72 sm:w-80 flex-shrink-0 bg-slate-100 rounded-2xl border border-slate-200/90 flex flex-col max-h-full shadow-2xs overflow-hidden"
            >
              {/* Column Header */}
              <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.id === 'done' ? 'bg-emerald-500' : col.id === 'in_progress' ? 'bg-amber-500' : col.id === 'waiting' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">{col.title}</h3>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  onClick={() => setIsAddingInCol(isAddingInCol === col.id ? null : col.id)}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                  title="Add task in this column"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Add Form in Column */}
              {isAddingInCol === col.id && (
                <form onSubmit={(e) => handleAddSubmit(col.id, e)} className="p-2.5 bg-white border-b border-slate-200">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Task name... Press Enter"
                    value={columnInput[col.id] || ''}
                    onChange={(e) =>
                      setColumnInput((prev) => ({ ...prev, [col.id]: e.target.value }))
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingInCol(null)}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!columnInput[col.id]?.trim()}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              {/* Tasks List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No tasks in {col.title}
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const queue = queueMap.get(task.listId);
                    const isDone = task.status === 'completed';

                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className={`p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer group space-y-2 ${
                          isDone ? 'opacity-70 bg-slate-50/80' : ''
                        }`}
                      >
                        {/* Top row: Priority, Queue, Star & Focus */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getPriorityBadge(task.priority)}
                            {queue && (
                              <span
                                className="px-1.5 py-0.2 rounded font-medium truncate max-w-[120px]"
                                style={{
                                  backgroundColor: `${queue.color}15`,
                                  color: queue.color,
                                }}
                              >
                                {queue.title}
                              </span>
                            )}
                            {/* Dependency badge */}
                            {task.dependsOn && task.dependsOn.length > 0 && (() => {
                              const prereqList = (allTasks || tasks).filter((t) => task.dependsOn?.includes(t.id));
                              const blockedBy = prereqList.filter((t) => t.status !== 'completed');
                              const isBlocked = blockedBy.length > 0;
                              return (
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded font-bold border ${
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
                                    <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                                  ) : (
                                    <Link2 className="w-2.5 h-2.5 text-emerald-600" />
                                  )}
                                  <span>{isBlocked ? `Blocked (${blockedBy.length})` : `${task.dependsOn.length} deps`}</span>
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            {onEnterFocusMode && !isDone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEnterFocusMode(task);
                                }}
                                className="p-0.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                title="Enter Focus Mode"
                              >
                                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />
                              </button>
                            )}
                            {task.starred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                          </div>
                        </div>

                        {/* Title */}
                        <h4
                          className={`text-xs font-semibold text-slate-800 leading-snug group-hover:text-blue-700 ${
                            isDone ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {task.title}
                        </h4>

                        {/* Notes preview */}
                        {task.notes && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {task.notes}
                          </p>
                        )}

                        {/* Metadata row */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                          <div className="flex items-center gap-2 flex-wrap">
                            {task.due && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Calendar className="w-3 h-3 text-blue-500" />
                                {task.due.split('T')[0]}
                              </span>
                            )}
                            {task.totalTimeSpentSeconds > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] text-purple-700 bg-purple-50 border border-purple-200 px-1 py-0.2 rounded font-bold"
                                title={`Time logged: ${formatSecondsToHuman(task.totalTimeSpentSeconds)}`}
                              >
                                <Clock className="w-2.5 h-2.5 text-purple-600" />
                                <span>{formatSecondsToHuman(task.totalTimeSpentSeconds)}</span>
                              </span>
                            )}
                            {task.subtasks.length > 0 && (
                              <span className="flex items-center gap-0.5">
                                <CheckSquare className="w-3 h-3 text-slate-400" />
                                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                              </span>
                            )}
                            {task.driveAttachments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-emerald-600">
                                <Paperclip className="w-3 h-3" />
                                {task.driveAttachments.length}
                              </span>
                            )}
                            {task.calendarEventId && (
                              <span className="flex items-center gap-0.5 text-amber-600" title="Synced with Google Calendar">
                                <Calendar className="w-3 h-3" />
                              </span>
                            )}
                          </div>

                          {task.assignedContact && (
                            <span className="flex items-center gap-1 text-purple-700 font-medium bg-purple-50 px-1.5 py-0.2 rounded">
                              <UserCheck className="w-3 h-3" />
                              {task.assignedContact.name.split(' ')[0]}
                            </span>
                          )}
                        </div>

                        {/* Stage move buttons */}
                        <div
                          className="pt-1.5 flex items-center justify-between border-t border-slate-100 opacity-60 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {col.id !== 'todo' ? (
                            <button
                              type="button"
                              onClick={() => {
                                const prevCol =
                                  col.id === 'done'
                                    ? 'waiting'
                                    : col.id === 'waiting'
                                    ? 'in_progress'
                                    : 'todo';
                                onUpdateTaskStatus(task, prevCol as KanbanStatus);
                              }}
                              className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5 font-medium"
                            >
                              <ArrowLeft className="w-3 h-3" /> Back
                            </button>
                          ) : (
                            <span />
                          )}

                          {col.id !== 'done' ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nextCol =
                                  col.id === 'todo'
                                    ? 'in_progress'
                                    : col.id === 'in_progress'
                                    ? 'waiting'
                                    : 'done';
                                onUpdateTaskStatus(task, nextCol as KanbanStatus);
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-bold"
                            >
                              Next <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Finished
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
