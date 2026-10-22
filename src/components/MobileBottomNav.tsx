import React from 'react';
import type { ViewMode, SmartQueueType } from '../types/gqueues';
import {
  ListTodo,
  Calendar,
  Plus,
  Kanban,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentView: ViewMode;
  activeSmartQueue: SmartQueueType | null;
  onSelectView: (view: ViewMode) => void;
  onOpenQueuesDrawer: () => void;
  onSelectToday: () => void;
  onQuickAddTask: () => void;
  onOpenInstallModal: () => void;
  todayCount: number;
  completedCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenQueuesDrawer,
  onQuickAddTask,
  completedCount = 0,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-30 px-2 flex items-center justify-around shadow-lg">
      {/* 1. All Queues List */}
      <button
        onClick={() => {
          onSelectView('tasks');
          onOpenQueuesDrawer();
        }}
        className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition-all w-14 ${
          currentView === 'tasks' ? 'text-blue-600 font-bold' : 'text-slate-600 hover:text-blue-600'
        }`}
      >
        <ListTodo className="w-5 h-5" />
        <span className="text-[10px]">Queues</span>
      </button>

      {/* 2. Kanban Board */}
      <button
        onClick={() => onSelectView('kanban')}
        className={`flex flex-col items-center justify-center gap-1 w-14 transition-all ${
          currentView === 'kanban' ? 'text-blue-600 font-bold' : 'text-slate-600 hover:text-blue-600'
        }`}
      >
        <Kanban className="w-5 h-5" />
        <span className="text-[10px]">Kanban</span>
      </button>

      {/* 3. Central FAB: + Add Task */}
      <button
        onClick={onQuickAddTask}
        className="w-12 h-12 -mt-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-90 transition-all cursor-pointer"
        aria-label="Add task"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* 4. Calendar View */}
      <button
        onClick={() => onSelectView('calendar')}
        className={`flex flex-col items-center justify-center gap-1 w-14 transition-all ${
          currentView === 'calendar' ? 'text-blue-600 font-bold' : 'text-slate-600 hover:text-blue-600'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span className="text-[10px]">Calendar</span>
      </button>

      {/* 5. Dashboard Charts */}
      <button
        onClick={() => onSelectView('dashboard')}
        className={`flex flex-col items-center justify-center gap-1 w-14 transition-all ${
          currentView === 'dashboard' ? 'text-purple-700 font-bold' : 'text-slate-600 hover:text-purple-600'
        }`}
      >
        <BarChart3 className="w-5 h-5 text-purple-600" />
        <span className="text-[10px]">Charts</span>
      </button>

      {/* 6. Completed Tasks */}
      <button
        onClick={() => onSelectView('completed')}
        className={`flex flex-col items-center justify-center gap-1 relative w-14 transition-all ${
          currentView === 'completed'
            ? 'text-emerald-700 font-bold'
            : 'text-slate-600 hover:text-emerald-600'
        }`}
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <span className="text-[10px]">Done</span>
        {completedCount > 0 && (
          <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
            {completedCount > 99 ? '99+' : completedCount}
          </span>
        )}
      </button>
    </nav>
  );
};
