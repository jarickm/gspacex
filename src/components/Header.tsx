import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { ViewMode } from '../types/gqueues';
import {
  Search,
  Plus,
  RefreshCw,
  Calendar,
  ListTodo,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Download,
  Kanban,
  CheckCircle2,
  FileDown,
  Keyboard,
  ShieldCheck,
  BarChart3,
  Video,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onQuickAddTask: () => void;
  onNewQueue: () => void;
  onOpenInstallModal: () => void;
  isSyncing: boolean;
  onRefresh: () => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onToggleMobileSidebar: () => void;
  isMobileSidebarOpen: boolean;
  completedCount?: number;
  todayMeetingsCount?: number;
  onOpenExportModal?: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenMeetingChecker?: () => void;
  onOpenAIModal?: () => void;
  isSessionExpired?: boolean;
  onReconnect?: () => void;
  lastSyncTime?: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onSignOut,
  searchQuery,
  onSearchChange,
  onQuickAddTask,
  onNewQueue,
  onOpenInstallModal,
  isSyncing,
  onRefresh,
  currentView,
  onViewChange,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
  completedCount = 0,
  todayMeetingsCount = 0,
  onOpenExportModal,
  onOpenShortcutsModal,
  onOpenMeetingChecker,
  onOpenAIModal,
  isSessionExpired = false,
  onReconnect,
  lastSyncTime,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <>
      {/* Session Expired Alert Banner */}
      {isSessionExpired && onReconnect && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-3 sm:px-6 py-2 text-xs font-medium flex items-center justify-between shadow-xs sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-200" />
            <span>
              <strong>Google Workspace session expired:</strong> Tokens expire after 1 hour. You are currently viewing cached records.
            </span>
          </div>
          <button
            onClick={onReconnect}
            className="px-3 py-1 bg-white text-amber-900 hover:bg-amber-50 rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 ml-3 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconnect with 1-Click</span>
          </button>
        </div>
      )}

      <header className="h-16 bg-white border-b border-slate-200/90 px-3 md:px-6 flex items-center justify-between gap-2 sm:gap-3 sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile hamburger + App Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onViewChange('tasks')}
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
            GQ
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 tracking-tight text-base">GQueues</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                Workspace
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md mx-1 sm:mx-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search queues, tasks, notes, or #tags (Press /)..."
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-lg outline-none transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* View Switcher: 4 Modes: Queues, Kanban, Calendar, Completed */}
        <div className="hidden lg:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-xs font-medium text-slate-600">
          <button
            onClick={() => onViewChange('tasks')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              currentView === 'tasks'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'hover:text-slate-900'
            }`}
            title="Standard Queues list view"
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Queues</span>
          </button>

          <button
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              currentView === 'kanban'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'hover:text-slate-900'
            }`}
            title="Kanban status board (To Do, In Progress, Waiting, Done)"
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>

          <button
            onClick={() => onViewChange('calendar')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              currentView === 'calendar'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'hover:text-slate-900'
            }`}
            title="Calendar grid schedule view"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => onViewChange('completed')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              currentView === 'completed'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'hover:text-slate-900'
            }`}
            title="View all completed tasks across Workspace"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completed</span>
            {completedCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                {completedCount}
              </span>
            )}
          </button>

          {/* Recharts Analytics Dashboard View Tab */}
          <button
            onClick={() => onViewChange('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              currentView === 'dashboard'
                ? 'bg-white text-purple-700 shadow-xs font-semibold'
                : 'hover:text-slate-900'
            }`}
            title="Visual Task Charts & Productivity Analytics"
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            <span>Dashboard</span>
          </button>
        </div>

        {/* Check Google Workspace Meetings Button */}
        {onOpenMeetingChecker && (
          <button
            onClick={onOpenMeetingChecker}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/90 hover:bg-amber-100 text-amber-900 text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Check today's Google Calendar meetings (Philippine Standard Time, Manila GMT+8)"
          >
            <Video className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden md:inline">Check Meetings</span>
            <span className="hidden xl:inline text-[10px] text-amber-800 font-bold bg-amber-200/60 px-1 rounded">PHT</span>
            {todayMeetingsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-bold">
                {todayMeetingsCount}
              </span>
            )}
          </button>
        )}

        {/* Export action */}
        {onOpenExportModal && (
          <button
            onClick={onOpenExportModal}
            className="hidden sm:flex items-center gap-1 p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Export tasks (CSV, JSON, Print)"
          >
            <FileDown className="w-4 h-4" />
          </button>
        )}

        {/* Shortcuts button */}
        {onOpenShortcutsModal && (
          <button
            onClick={onOpenShortcutsModal}
            className="hidden xl:flex items-center gap-1 p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}

        {/* GQueues AI Companion Button */}
        {onOpenAIModal && (
          <button
            onClick={onOpenAIModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-indigo-900 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Open GQueues AI Companion (Smart task breakdown, daily briefing, meeting prep)"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span className="hidden sm:inline">AI Companion</span>
            <span className="sm:hidden">AI</span>
          </button>
        )}

        {/* Install App button (Prominent) */}
        <button
          onClick={onOpenInstallModal}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition-all active:scale-95"
          title="Install on Android, iOS, or Windows"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Install App</span>
        </button>

        {/* Sync Status Button */}
        <button
          onClick={onRefresh}
          disabled={isSyncing}
          title="Refresh & sync from Google Workspace"
          className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Quick Add Task Button */}
        <button
          onClick={onQuickAddTask}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Task</span>
        </button>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {user?.displayName ? user.displayName[0] : 'U'}
              </div>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.displayName || 'Google Workspace User'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Real Google Tasks & Calendar Sync</span>
                </div>
              </div>

              {/* View Switchers for mobile/tablet */}
              <div className="lg:hidden py-1 border-b border-slate-100">
                <p className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch View
                </p>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onViewChange('tasks');
                  }}
                  className={`w-full text-left px-4 py-1.5 text-xs flex items-center gap-2 ${
                    currentView === 'tasks' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>Queues List</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onViewChange('kanban');
                  }}
                  className={`w-full text-left px-4 py-1.5 text-xs flex items-center gap-2 ${
                    currentView === 'kanban' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Kanban Board</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onViewChange('calendar');
                  }}
                  className={`w-full text-left px-4 py-1.5 text-xs flex items-center gap-2 ${
                    currentView === 'calendar' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar Schedule</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onViewChange('completed');
                  }}
                  className={`w-full text-left px-4 py-1.5 text-xs flex items-center gap-2 ${
                    currentView === 'completed' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Completed Tasks ({completedCount})</span>
                </button>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onNewQueue();
                  }}
                  className="w-full text-left px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Create New Queue</span>
                </button>
                {onOpenExportModal && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenExportModal();
                    }}
                    className="w-full text-left px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export Tasks (CSV/JSON)</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenInstallModal();
                  }}
                  className="w-full text-left px-4 py-1.5 text-xs text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 flex items-center gap-2 font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Install App (APK/iOS/Win)</span>
                </button>
                {onOpenShortcutsModal && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenShortcutsModal();
                    }}
                    className="w-full text-left px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                    <span>Keyboard Shortcuts (?)</span>
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSignOut();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  </>
);
};
