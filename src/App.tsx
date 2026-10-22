import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  auth,
  isTokenExpired,
  onSessionExpired,
  notifySessionExpired,
} from './services/firebase';
import type {
  QueueList,
  GQueueTask,
  SmartQueueType,
  GoogleContact,
  GoogleCalendarEvent,
  DriveAttachment,
  Priority,
  ViewMode,
  KanbanStatus,
} from './types/gqueues';
import {
  fetchTaskLists,
  createTaskList,
  updateTaskList,
  deleteTaskList,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  clearCompletedTasks,
  computeNextRecurringDueDate,
} from './services/tasksApi';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  fetchTodayMeetings,
} from './services/calendarApi';
import { fetchContacts } from './services/peopleApi';
import type { CalendarMeeting, AppNotification } from './types/gqueues';
import {
  getManilaTodayDateString,
  getManilaDateString,
} from './utils/timezone';

import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarView } from './components/CalendarView';
import { CompletedView } from './components/CompletedView';
import { DashboardView } from './components/DashboardView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { FocusModeModal } from './components/FocusModeModal';
import { MeetingCheckerModal } from './components/MeetingCheckerModal';
import { ToastNotificationSystem, playNotificationChime } from './components/ToastNotificationSystem';
import { DrivePickerModal } from './components/DrivePickerModal';
import { NewQueueModal } from './components/NewQueueModal';
import { ConfirmModal } from './components/ConfirmModal';
import { InstallModal } from './components/InstallModal';
import { ExportModal } from './components/ExportModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AIAssistantModal } from './components/AIAssistantModal';

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App data states (hydrated from localStorage cache for instant zero-delay render)
  const [queues, setQueues] = useState<QueueList[]>(() => {
    try {
      const saved = localStorage.getItem('gqueues_local_queues');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeQueueId, setActiveQueueId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gqueues_local_active_queue_id') || null;
    } catch {
      return null;
    }
  });

  const [activeSmartQueue, setActiveSmartQueue] = useState<SmartQueueType | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [allTasksCache, setAllTasksCache] = useState<Record<string, GQueueTask[]>>(() => {
    try {
      const saved = localStorage.getItem('gqueues_local_tasks_cache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [tasks, setTasks] = useState<GQueueTask[]>(() => {
    try {
      const savedQ = localStorage.getItem('gqueues_local_active_queue_id');
      const savedTasks = localStorage.getItem('gqueues_local_tasks_cache');
      if (savedQ && savedTasks) {
        const parsed = JSON.parse(savedTasks);
        if (parsed[savedQ]) return parsed[savedQ];
      }
    } catch {}
    return [];
  });

  const [contacts, setContacts] = useState<GoogleContact[]>(() => {
    try {
      const saved = localStorage.getItem('gqueues_local_contacts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('gqueues_local_calendar');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('gqueues_last_sync_time');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Meetings & Notifications states
  const [isMeetingCheckerOpen, setIsMeetingCheckerOpen] = useState(false);
  const [todayMeetings, setTodayMeetings] = useState<CalendarMeeting[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Focus Mode state
  const [focusModeTask, setFocusModeTask] = useState<GQueueTask | null>(null);

  // UI state
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<ViewMode>('tasks');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Modals state
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<GQueueTask | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [queueModalTarget, setQueueModalTarget] = useState<QueueList | null>(null);
  const [queueModalDefaultCat, setQueueModalDefaultCat] = useState<string>('My Queues');

  // Confirmation Modal state for Workspace Destructive operations
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const newNotif: AppNotification = {
      ...notif,
      id,
      timestamp: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 7)]);
    playNotificationChime();
  }, []);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setIsAuthChecking(false);
        if (isTokenExpired()) {
          setIsSessionExpired(true);
        }
      },
      () => {
        setUser(null);
        setToken(null);
        setIsAuthChecking(false);
      }
    );

    const unsubSession = onSessionExpired(() => {
      setToken(null);
      setIsSessionExpired(true);
    });

    return () => {
      unsubscribe();
      unsubSession();
    };
  }, []);

  // Handle Google Workspace Sign-In
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user as User);
        setToken(res.accessToken);
        setIsSessionExpired(false);
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups or open the app in a new window.'
        );
        return;
      }
      setAuthError(err?.message || 'Failed to sign in with Google Workspace');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Reconnect Google Workspace Session (1-Click session refresh without signing out)
  const handleReconnect = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        setUser(res.user as User);
        setToken(res.accessToken);
        setIsSessionExpired(false);
        addNotification({
          title: 'Workspace Reconnected',
          message: 'Your Google Workspace connection is active. Refreshing records...',
          type: 'success',
        });
        loadInitialWorkspaceData(res.accessToken);
      }
    } catch (err: any) {
      console.error('Reconnect failed:', err);
      addNotification({
        title: 'Reconnect Error',
        message: err.message || 'Please sign in again to refresh your token.',
        type: 'warning',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setQueues([]);
    setTasks([]);
    setAllTasksCache({});
    setContacts([]);
    setCalendarEvents([]);
    setIsSessionExpired(false);
    try {
      localStorage.removeItem('gqueues_local_queues');
      localStorage.removeItem('gqueues_local_active_queue_id');
      localStorage.removeItem('gqueues_local_tasks_cache');
      localStorage.removeItem('gqueues_local_calendar');
      localStorage.removeItem('gqueues_local_contacts');
      localStorage.removeItem('gqueues_last_sync_time');
    } catch {}
  };

  // Load Queues, Contacts, and Calendar events from Google APIs with localStorage caching
  const loadInitialWorkspaceData = useCallback(async (accessToken: string) => {
    setIsSyncing(true);
    try {
      // 1. Fetch Task Lists (Queues)
      let fetchedQueues = await fetchTaskLists(accessToken);
      if (fetchedQueues.length === 0) {
        const defaultQ = await createTaskList(accessToken, 'Work Projects', 'Work');
        fetchedQueues = [defaultQ];
      }

      setQueues(fetchedQueues);
      try {
        localStorage.setItem('gqueues_local_queues', JSON.stringify(fetchedQueues));
      } catch {}

      const targetQueueId =
        activeQueueId && fetchedQueues.some((q) => q.id === activeQueueId)
          ? activeQueueId
          : fetchedQueues[0].id;

      setActiveQueueId(targetQueueId);
      try {
        localStorage.setItem('gqueues_local_active_queue_id', targetQueueId);
      } catch {}

      // 2. Fetch Tasks for the active queue
      const initialTasks = await fetchTasks(accessToken, targetQueueId);
      setTasks(initialTasks);
      setAllTasksCache((prev) => {
        const updated = { ...prev, [targetQueueId]: initialTasks };
        try {
          localStorage.setItem('gqueues_local_tasks_cache', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 3. Fetch Google Contacts & Workspace Organization Directory (in background)
      const userEmail = auth.currentUser?.email || user?.email || '';
      const domain = userEmail.includes('@') ? userEmail.split('@')[1] : 'coolaireconsolidated.com';
      fetchContacts(accessToken, domain)
        .then((c) => {
          setContacts(c);
          try {
            localStorage.setItem('gqueues_local_contacts', JSON.stringify(c));
          } catch {}
        })
        .catch(console.warn);

      // 4. Fetch Google Calendar events & today meetings (in background)
      const now = new Date();
      const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const nextMonth = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
      fetchCalendarEvents(accessToken, pastMonth, nextMonth)
        .then((evts) => {
          setCalendarEvents(evts);
          try {
            localStorage.setItem('gqueues_local_calendar', JSON.stringify(evts));
          } catch {}
        })
        .catch(console.warn);

      fetchTodayMeetings(accessToken)
        .then(setTodayMeetings)
        .catch(console.warn);

      // 5. Preload tasks from other queues for Smart Queues calculation
      for (const q of fetchedQueues) {
        if (q.id !== targetQueueId) {
          fetchTasks(accessToken, q.id)
            .then((otherTasks) => {
              setAllTasksCache((prev) => {
                const updated = { ...prev, [q.id]: otherTasks };
                try {
                  localStorage.setItem('gqueues_local_tasks_cache', JSON.stringify(updated));
                } catch {}
                return updated;
              });
            })
            .catch(console.warn);
        }
      }

      setLastSyncTime(Date.now());
      try {
        localStorage.setItem('gqueues_last_sync_time', String(Date.now()));
      } catch {}
      setIsSessionExpired(false);
    } catch (err: any) {
      console.error('Failed to load Google Workspace data:', err);
      if (err?.message?.includes('401') || isTokenExpired()) {
        setToken(null);
        setIsSessionExpired(true);
        notifySessionExpired();
      }
    } finally {
      setIsSyncing(false);
    }
  }, [activeQueueId, user?.email]);

  // Trigger loading when token is set and session is active
  useEffect(() => {
    if (token && !isSessionExpired) {
      if (isTokenExpired()) {
        setToken(null);
        setIsSessionExpired(true);
      } else {
        loadInitialWorkspaceData(token);
      }
    }
  }, [token, isSessionExpired, loadInitialWorkspaceData]);

  // Foreground re-validation & auto-refresh on focus or visibilitychange
  useEffect(() => {
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible' && token && !isSessionExpired) {
        if (isTokenExpired()) {
          setToken(null);
          setIsSessionExpired(true);
        } else {
          loadInitialWorkspaceData(token);
        }
      }
    };

    document.addEventListener('visibilitychange', handleRevalidate);
    window.addEventListener('focus', handleRevalidate);

    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      if (token && !isSessionExpired && document.visibilityState === 'visible') {
        if (isTokenExpired()) {
          setToken(null);
          setIsSessionExpired(true);
        } else {
          loadInitialWorkspaceData(token);
        }
      }
    }, 120000);

    return () => {
      document.removeEventListener('visibilitychange', handleRevalidate);
      window.removeEventListener('focus', handleRevalidate);
      clearInterval(interval);
    };
  }, [token, loadInitialWorkspaceData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === '?') {
        setIsShortcutsModalOpen((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const el = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
        if (el) el.focus();
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleOpenNewQueueModal();
      } else if (e.key === '/') {
        e.preventDefault();
        const searchEl = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchEl) searchEl.focus();
      } else if (e.key === '1') {
        setCurrentView('tasks');
      } else if (e.key === '2') {
        setCurrentView('kanban');
      } else if (e.key === '3') {
        setCurrentView('calendar');
      } else if (e.key === '4') {
        setCurrentView('completed');
      } else if (e.key === 't' || e.key === 'T') {
        handleSelectSmartQueue('today');
      } else if (e.key === 'r' || e.key === 'R') {
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load tasks when active queue changes
  const handleSelectQueue = async (queueId: string) => {
    setActiveQueueId(queueId);
    setActiveSmartQueue(null);
    if (currentView === 'completed') {
      setCurrentView('tasks');
    }
    if (!token) return;

    // Use cache if available first, then refresh
    if (allTasksCache[queueId]) {
      setTasks(allTasksCache[queueId]);
    } else {
      setIsSyncing(true);
    }

    try {
      const freshTasks = await fetchTasks(token, queueId);
      setTasks(freshTasks);
      setAllTasksCache((prev) => ({ ...prev, [queueId]: freshTasks }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Smart Queue selection
  const handleSelectSmartQueue = (smart: SmartQueueType) => {
    if (smart === 'completed') {
      setCurrentView('completed');
      setActiveSmartQueue(null);
      return;
    }
    if (currentView === 'completed') {
      setCurrentView('tasks');
    }
    setActiveSmartQueue(smart);
    setActiveQueueId(null);
  };

  // Compile all tasks across all queues
  const allTasksCombined = useMemo(() => {
    const list: GQueueTask[] = [];
    const seen = new Set<string>();
    for (const qId of Object.keys(allTasksCache)) {
      for (const t of allTasksCache[qId]) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          list.push(t);
        }
      }
    }
    return list;
  }, [allTasksCache]);

  // Calculate Smart Queue counts (using Philippines Manila time)
  const smartCounts = useMemo(() => {
    const today = getManilaTodayDateString();
    const nowMs = Date.now();
    const sevenDaysLater = getManilaDateString(new Date(nowMs + 7 * 24 * 60 * 60 * 1000));

    let todayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let starredCount = 0;
    let allActiveCount = 0;
    let completedCount = 0;
    let todayCompleted = 0;

    for (const t of allTasksCombined) {
      if (t.status === 'completed') {
        completedCount++;
        const finishedDate = getManilaDateString(t.completed || t.completedAt || t.updated || '');
        if (finishedDate === today) {
          todayCompleted++;
        }
        continue;
      }

      allActiveCount++;

      if (t.starred || t.priority === 'urgent' || t.priority === 'high') {
        starredCount++;
      }

      if (t.due) {
        const dueDate = getManilaDateString(t.due);
        if (dueDate === today) {
          todayCount++;
        } else if (dueDate < today) {
          overdueCount++;
        } else if (dueDate <= sevenDaysLater) {
          upcomingCount++;
        }
      }
    }

    return {
      today: todayCount,
      overdue: overdueCount,
      upcoming: upcomingCount,
      starred: starredCount,
      all: allActiveCount,
      completed: completedCount,
      todayCompleted,
    };
  }, [allTasksCombined]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of allTasksCombined) {
      for (const tag of t.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet);
  }, [allTasksCombined]);

  // Determine current active tasks to render (in Philippines Manila time)
  const tasksToRender = useMemo(() => {
    if (activeSmartQueue) {
      const today = getManilaTodayDateString();
      const sevenDaysLater = getManilaDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

      switch (activeSmartQueue) {
        case 'today':
          return allTasksCombined.filter(
            (t) => t.status !== 'completed' && t.due && getManilaDateString(t.due) === today
          );
        case 'overdue':
          return allTasksCombined.filter(
            (t) => t.status !== 'completed' && t.due && getManilaDateString(t.due) < today
          );
        case 'upcoming':
          return allTasksCombined.filter(
            (t) =>
              t.status !== 'completed' &&
              t.due &&
              getManilaDateString(t.due) >= today &&
              getManilaDateString(t.due) <= sevenDaysLater
          );
        case 'starred':
          return allTasksCombined.filter(
            (t) => t.status !== 'completed' && (t.starred || t.priority === 'urgent')
          );
        case 'all':
          return allTasksCombined.filter((t) => t.status !== 'completed');
        case 'completed':
          return allTasksCombined.filter((t) => t.status === 'completed');
      }
    }
    return tasks;
  }, [activeSmartQueue, allTasksCombined, tasks]);

  // Active queue object
  const currentQueue = useMemo(() => {
    return queues.find((q) => q.id === activeQueueId) || null;
  }, [queues, activeQueueId]);

  // Refresh handler
  const handleRefresh = async () => {
    if (!token) return;
    if (isTokenExpired()) {
      setIsSessionExpired(true);
      return;
    }
    await loadInitialWorkspaceData(token);
    addNotification({
      title: 'Workspace Refreshed',
      message: 'All tasks, queues, and calendar events are up to date.',
      type: 'success',
    });
  };

  // --- Task CRUD operations ---

  // Quick Add Task
  const handleQuickAddTask = async (
    title: string,
    due?: string,
    priority: Priority = 'none'
  ) => {
    const targetQueueId = activeQueueId || queues[0]?.id;
    if (!token || !targetQueueId) return;

    try {
      const created = await createTask(token, targetQueueId, {
        title,
        due,
        priority,
      });

      // Update state
      setTasks((prev) => [created, ...prev]);
      setAllTasksCache((prev) => ({
        ...prev,
        [targetQueueId]: [created, ...(prev[targetQueueId] || [])],
      }));
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Quick Add Kanban Task in specific column
  const handleQuickAddKanbanTask = async (title: string, status: KanbanStatus) => {
    const targetQueueId = activeQueueId || queues[0]?.id;
    if (!token || !targetQueueId) return;

    try {
      const isDone = status === 'done';
      const created = await createTask(token, targetQueueId, {
        title,
        status: isDone ? 'completed' : 'needsAction',
        kanbanStatus: status,
      });

      setTasks((prev) => [created, ...prev]);
      setAllTasksCache((prev) => ({
        ...prev,
        [targetQueueId]: [created, ...(prev[targetQueueId] || [])],
      }));
    } catch (err) {
      console.error('Failed to add kanban task:', err);
    }
  };

  // Meeting Checker handler
  const handleCheckMeetings = useCallback(async () => {
    if (!token) return;
    setIsLoadingMeetings(true);
    try {
      const freshMeetings = await fetchTodayMeetings(token);
      setTodayMeetings(freshMeetings);
      setIsMeetingCheckerOpen(true);
      if (freshMeetings.length > 0) {
        addNotification({
          title: `Schedule Checked (${freshMeetings.length} meetings)`,
          message: `You have ${freshMeetings.length} meeting(s) today in Philippine Standard Time (PHT).`,
          type: 'meeting',
          meetingLink: freshMeetings[0].hangoutLink,
        });
      } else {
        addNotification({
          title: 'Schedule All Clear (Manila Time)',
          message: 'No Google Calendar meetings found for today in Philippine Standard Time (PHT).',
          type: 'info',
        });
      }
    } catch (err: any) {
      console.warn('Meeting check failed:', err);
      setIsMeetingCheckerOpen(true);
    } finally {
      setIsLoadingMeetings(false);
    }
  }, [token, addNotification]);

  // Calendar Event CRUD handlers for interactive Calendar View
  const handleSaveCalendarEvent = async (eventData: {
    id?: string;
    summary: string;
    description?: string;
    dueDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
    addGoogleMeet?: boolean;
  }) => {
    if (!token) return;
    try {
      if (eventData.id) {
        const updated = await updateCalendarEvent(token, eventData.id, eventData);
        setCalendarEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
        );
        addNotification({
          title: 'Meeting Updated',
          message: `"${updated.summary}" updated on Google Calendar.`,
          type: 'success',
          meetingLink: updated.hangoutLink,
        });
      } else {
        const created = await createCalendarEvent(token, eventData);
        setCalendarEvents((prev) => [...prev, created]);
        addNotification({
          title: 'Meeting Scheduled',
          message: `"${created.summary}" added to Google Calendar.`,
          type: 'success',
          meetingLink: created.hangoutLink,
        });
      }
      fetchTodayMeetings(token).then(setTodayMeetings).catch(console.warn);
    } catch (err: any) {
      console.error('Failed to save calendar event:', err);
      addNotification({
        title: 'Calendar Error',
        message: err.message || 'Failed to save event to Google Calendar',
        type: 'warning',
      });
    }
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    if (!token) return;
    try {
      await deleteCalendarEvent(token, eventId);
      setCalendarEvents((prev) => prev.filter((e) => e.id !== eventId));
      setTodayMeetings((prev) => prev.filter((m) => m.id !== eventId));
      addNotification({
        title: 'Meeting Deleted',
        message: 'The meeting was removed from Google Calendar.',
        type: 'info',
      });
    } catch (err: any) {
      console.error('Failed to delete calendar event:', err);
      addNotification({
        title: 'Delete Failed',
        message: err.message || 'Failed to delete calendar event',
        type: 'warning',
      });
    }
  };

  const handleConvertEventToTask = async (event: GoogleCalendarEvent) => {
    const targetQueueId = activeQueueId || queues[0]?.id;
    if (!targetQueueId || !token) return;
    const taskTitle = event.summary.replace(/^\[GQueues\]\s*/i, '');
    const dateStr = event.start.dateTime
      ? event.start.dateTime.split('T')[0]
      : event.start.date || undefined;

    const notes = [
      event.description || '',
      event.hangoutLink ? `Google Meet: ${event.hangoutLink}` : '',
      event.location ? `Location: ${event.location}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const created = await createTask(token, targetQueueId, {
        title: `Prep: ${taskTitle}`,
        notes,
        due: dateStr,
        priority: 'medium',
      });
      setTasks((prev) => [created, ...prev]);
      setAllTasksCache((prev) => ({
        ...prev,
        [targetQueueId]: [created, ...(prev[targetQueueId] || [])],
      }));
      addNotification({
        title: 'Task Created from Meeting',
        message: `Task "Prep: ${taskTitle}" added to your queue.`,
        type: 'success',
        taskId: created.id,
      });
    } catch (err) {
      console.error('Failed to convert event to task:', err);
    }
  };

  // Productivity Time Logging
  const handleLogTimeSpent = async (taskId: string, seconds: number, note?: string) => {
    const targetTask = allTasksCombined.find((t) => t.id === taskId);
    if (!targetTask || !token) return;

    const newLog = {
      id: 'log-' + Date.now(),
      seconds,
      timestamp: new Date().toISOString(),
      note: note || 'Work session',
    };
    const nextLogs = [newLog, ...(targetTask.timeLogs || [])];
    const nextTotal = (targetTask.totalTimeSpentSeconds || 0) + seconds;

    try {
      const updated = await updateTask(token, targetTask.listId, taskId, {
        timeLogs: nextLogs,
        totalTimeSpentSeconds: nextTotal,
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
      setAllTasksCache((prev) => {
        const copy = { ...prev };
        if (copy[targetTask.listId]) {
          copy[targetTask.listId] = copy[targetTask.listId].map((t) =>
            t.id === taskId ? { ...t, ...updated } : t
          );
        }
        return copy;
      });
      if (selectedTaskForDetail?.id === taskId) {
        setSelectedTaskForDetail((prev) => (prev ? { ...prev, ...updated } : null));
      }
      addNotification({
        title: 'Time Logged',
        message: `Productivity recorded for "${targetTask.title}".`,
        type: 'timer',
        taskId,
      });
    } catch (err) {
      console.error('Failed to log time:', err);
    }
  };

  // Toggle Complete / Uncomplete with Dependency Protection & Recurring Auto-Schedule
  const handleToggleComplete = async (task: GQueueTask) => {
    if (!token) return;
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';

    // 1. Dependency check: if completing, verify uncompleted prerequisites
    if (newStatus === 'completed' && task.dependsOn && task.dependsOn.length > 0) {
      const prereqs = allTasksCombined.filter((t) => task.dependsOn?.includes(t.id));
      const uncompleted = prereqs.filter((t) => t.status !== 'completed');
      if (uncompleted.length > 0) {
        const proceed = window.confirm(
          `⚠️ Task Dependency Notice:\nThis task depends on ${uncompleted.length} unfinished prerequisite task(s):\n\n` +
            uncompleted.map((t) => `• ${t.title}`).join('\n') +
            `\n\nMark as completed anyway?`
        );
        if (!proceed) return;
      }
    }

    const completedDate = newStatus === 'completed' ? new Date().toISOString() : undefined;
    const newKanbanStatus: KanbanStatus = newStatus === 'completed' ? 'done' : 'todo';

    // Optimistic UI update
    const updated: GQueueTask = {
      ...task,
      status: newStatus,
      completed: completedDate,
      kanbanStatus: newKanbanStatus,
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    if (newStatus === 'completed') {
      addNotification({
        title: 'Task Completed! 🎉',
        message: `"${task.title}" was marked as completed.`,
        type: 'success',
      });

      // 2. Recurring Task Auto-Schedule: generate the next occurrence if recurring
      if (task.recurring && task.recurring !== 'none') {
        const nextDue = computeNextRecurringDueDate(task.due, task.recurring, task.recurrenceRule);
        createTask(token, task.listId, {
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          due: nextDue,
          tags: task.tags,
          recurring: task.recurring,
          recurrenceRule: task.recurrenceRule,
          timeEstimate: task.timeEstimate,
          assignedContact: task.assignedContact,
        })
          .then((nextTask) => {
            setTasks((prev) => [nextTask, ...prev]);
            setAllTasksCache((prev) => ({
              ...prev,
              [task.listId]: [nextTask, ...(prev[task.listId] || [])],
            }));
            addNotification({
              title: 'Next Recurring Task Created',
              message: `"${task.title}" repeated for ${nextDue}.`,
              type: 'info',
              taskId: nextTask.id,
            });
          })
          .catch(console.warn);
      }
    }

    try {
      await updateTask(token, task.listId, task.id, {
        status: newStatus,
        completed: completedDate,
        kanbanStatus: newKanbanStatus,
      });
    } catch (err) {
      console.error('Failed to update task status in Google Tasks:', err);
      // Revert optimistic update on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  };

  // Toggle Star / Flag
  const handleToggleStar = async (task: GQueueTask) => {
    if (!token) return;
    const updated: GQueueTask = { ...task, starred: !task.starred };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { starred: updated.starred });
    } catch (err) {
      console.error('Failed to star task:', err);
    }
  };

  // Update Task Priority inline
  const handleUpdateTaskPriority = async (task: GQueueTask, priority: Priority) => {
    if (!token) return;
    const updated: GQueueTask = { ...task, priority };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { priority });
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  // Update Task Kanban Status
  const handleUpdateTaskKanbanStatus = async (task: GQueueTask, newStatus: KanbanStatus) => {
    if (!token) return;
    const isNowDone = newStatus === 'done';
    const newGoogleStatus = isNowDone ? 'completed' : 'needsAction';
    const completedDate = isNowDone ? (task.completed || new Date().toISOString()) : undefined;

    const updated: GQueueTask = {
      ...task,
      kanbanStatus: newStatus,
      status: newGoogleStatus,
      completed: completedDate,
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, {
        status: newGoogleStatus,
        kanbanStatus: newStatus,
        completed: completedDate,
      });
    } catch (err) {
      console.error('Failed to update kanban status:', err);
    }
  };

  // Save Task Details from Modal
  const handleSaveTaskDetail = async (updatedFields: Partial<GQueueTask>) => {
    if (!token || !selectedTaskForDetail) return;

    const updatedTask: GQueueTask = {
      ...selectedTaskForDetail,
      ...updatedFields,
    };

    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [updatedTask.listId]: (prev[updatedTask.listId] || []).map((t) =>
        t.id === updatedTask.id ? updatedTask : t
      ),
    }));
    setSelectedTaskForDetail(updatedTask);

    try {
      await updateTask(token, updatedTask.listId, updatedTask.id, {
        title: updatedTask.title,
        notes: updatedTask.notes,
        due: updatedTask.due,
        priority: updatedTask.priority,
        tags: updatedTask.tags,
        starred: updatedTask.starred,
        subtasks: updatedTask.subtasks,
        assignedContact: updatedTask.assignedContact,
        driveAttachments: updatedTask.driveAttachments,
        timeEstimate: updatedTask.timeEstimate,
        recurring: updatedTask.recurring,
      });

      // If task has a synced calendar event, update event details and assignee invitation
      if (updatedTask.calendarEventId) {
        const attendees = updatedTask.assignedContact?.email
          ? [{ email: updatedTask.assignedContact.email, displayName: updatedTask.assignedContact.name }]
          : undefined;

        updateCalendarEvent(token, updatedTask.calendarEventId, {
          summary: updatedTask.title,
          description: updatedTask.notes,
          dueDate: updatedTask.due,
          timeEstimate: updatedTask.timeEstimate,
          attendees,
          sendUpdates: 'all',
        }).catch((err) => console.warn('Failed to update synced Google Calendar event:', err));
      }
    } catch (err) {
      console.error('Failed to update task details:', err);
    }
  };

  // Subtask checkbox toggle
  const handleToggleSubtask = async (task: GQueueTask, subtaskId: string) => {
    if (!token) return;
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    const updated: GQueueTask = { ...task, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
    }
  };

  // Add new subtask inline
  const handleAddSubtask = async (task: GQueueTask, subtaskTitle: string) => {
    if (!token || !subtaskTitle.trim()) return;

    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: subtaskTitle.trim(),
      completed: false,
    };
    const updatedSubtasks = [...task.subtasks, newSub];

    const updated: GQueueTask = { ...task, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
    }
  };

  // Batch Complete
  const handleBatchComplete = async (selectedList: GQueueTask[]) => {
    if (!token || selectedList.length === 0) return;
    const completedDate = new Date().toISOString();
    const selectedIds = new Set(selectedList.map((t) => t.id));

    setTasks((prev) =>
      prev.map((t) =>
        selectedIds.has(t.id) ? { ...t, status: 'completed', completed: completedDate } : t
      )
    );
    setAllTasksCache((prev) => {
      const copy = { ...prev };
      for (const qId of Object.keys(copy)) {
        copy[qId] = copy[qId].map((t) =>
          selectedIds.has(t.id) ? { ...t, status: 'completed', completed: completedDate } : t
        );
      }
      return copy;
    });

    for (const t of selectedList) {
      updateTask(token, t.listId, t.id, { status: 'completed', completed: completedDate }).catch(
        console.error
      );
    }
  };

  // Batch Delete
  const handleBatchDelete = (selectedList: GQueueTask[]) => {
    if (selectedList.length === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      title: `Delete ${selectedList.length} Tasks from Google Workspace`,
      message: `Are you sure you want to permanently delete ${selectedList.length} tasks from your Google Workspace? This cannot be undone.`,
      confirmLabel: 'Delete All',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        const idsToDelete = new Set(selectedList.map((t) => t.id));
        setTasks((prev) => prev.filter((t) => !idsToDelete.has(t.id)));
        setAllTasksCache((prev) => {
          const copy = { ...prev };
          for (const qId of Object.keys(copy)) {
            copy[qId] = copy[qId].filter((t) => !idsToDelete.has(t.id));
          }
          return copy;
        });

        for (const t of selectedList) {
          deleteTask(token, t.listId, t.id).catch(console.error);
        }
      },
    });
  };

  // Task Delete (Mandatory Confirmation Modal)
  const handleDeleteTaskPrompt = (task: GQueueTask) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Task from Google Tasks',
      message: `Are you sure you want to delete "${task.title}"? This will permanently delete the task from your Google Workspace account and cannot be undone.`,
      confirmLabel: 'Delete Task',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        // If calendar event synced, clean it up
        if (task.calendarEventId) {
          deleteCalendarEvent(token, task.calendarEventId).catch(console.warn);
        }

        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setAllTasksCache((prev) => ({
          ...prev,
          [task.listId]: (prev[task.listId] || []).filter((t) => t.id !== task.id),
        }));

        if (selectedTaskForDetail?.id === task.id) {
          setSelectedTaskForDetail(null);
        }

        try {
          await deleteTask(token, task.listId, task.id);
        } catch (err) {
          console.error('Failed to delete task:', err);
        }
      },
    });
  };

  // Clear Completed Tasks Prompt
  const handleClearCompletedPrompt = () => {
    if (!currentQueue) return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Clear Completed Tasks',
      message: `Clear all finished tasks in "${currentQueue.title}"? This removes completed items from this list in Google Tasks.`,
      confirmLabel: 'Clear Completed',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
        setAllTasksCache((prev) => ({
          ...prev,
          [currentQueue.id]: (prev[currentQueue.id] || []).filter(
            (t) => t.status !== 'completed'
          ),
        }));

        try {
          await clearCompletedTasks(token, currentQueue.id);
        } catch (err) {
          console.error('Failed to clear completed tasks:', err);
        }
      },
    });
  };

  // --- Queue CRUD operations ---

  const handleOpenNewQueueModal = (cat?: string) => {
    setQueueModalTarget(null);
    setQueueModalDefaultCat(cat || 'My Queues');
    setIsQueueModalOpen(true);
  };

  const handleEditQueueModal = (queue: QueueList) => {
    setQueueModalTarget(queue);
    setQueueModalDefaultCat(queue.category || 'My Queues');
    setIsQueueModalOpen(true);
  };

  const handleSaveQueue = async (title: string, category: string, color: string) => {
    if (!token) return;

    if (queueModalTarget) {
      // Update existing queue
      const updated = await updateTaskList(token, queueModalTarget.id, title, category);
      updated.color = color;

      setQueues((prev) => prev.map((q) => (q.id === queueModalTarget.id ? updated : q)));
    } else {
      // Create new queue in Google Tasks
      const created = await createTaskList(token, title, category);
      created.color = color;

      setQueues((prev) => [...prev, created]);
      setActiveQueueId(created.id);
      setActiveSmartQueue(null);
      setTasks([]);
      setAllTasksCache((prev) => ({ ...prev, [created.id]: [] }));
    }
  };

  // Delete Queue Prompt (Mandatory Confirmation)
  const handleDeleteQueuePrompt = (queue: QueueList) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Queue from Google Tasks',
      message: `Are you sure you want to delete the queue "${queue.title}" and all its tasks? This permanently removes the list from Google Tasks and cannot be undone.`,
      confirmLabel: 'Delete Queue',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        setQueues((prev) => prev.filter((q) => q.id !== queue.id));
        if (activeQueueId === queue.id) {
          const nextQ = queues.find((q) => q.id !== queue.id);
          if (nextQ) {
            handleSelectQueue(nextQ.id);
          } else {
            setActiveQueueId(null);
            setTasks([]);
          }
        }

        try {
          await deleteTaskList(token, queue.id);
        } catch (err) {
          console.error('Failed to delete queue:', err);
        }
      },
    });
  };

  // --- Google Calendar Sync Operations ---

  const handleSyncTaskToCalendar = async (task: GQueueTask) => {
    if (!token) return;
    try {
      const attendees = task.assignedContact?.email
        ? [{ email: task.assignedContact.email, displayName: task.assignedContact.name }]
        : undefined;

      const event = await createCalendarEvent(token, {
        summary: task.title,
        description: task.notes,
        dueDate: task.due,
        timeEstimate: task.timeEstimate,
        attendees,
        sendUpdates: 'all',
      });

      const updated: GQueueTask = { ...task, calendarEventId: event.id };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setAllTasksCache((prev) => ({
        ...prev,
        [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
      }));

      // Update in Google Tasks
      await updateTask(token, task.listId, task.id, { calendarEventId: event.id });
      setCalendarEvents((prev) => [...prev, event]);
    } catch (err) {
      console.error('Failed to sync event to Google Calendar:', err);
    }
  };

  const handleUnsyncTaskFromCalendar = async (task: GQueueTask) => {
    if (!token || !task.calendarEventId) return;
    try {
      await deleteCalendarEvent(token, task.calendarEventId);
      const updated: GQueueTask = { ...task, calendarEventId: undefined };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setAllTasksCache((prev) => ({
        ...prev,
        [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
      }));

      await updateTask(token, task.listId, task.id, { calendarEventId: undefined });
      setCalendarEvents((prev) => prev.filter((e) => e.id !== task.calendarEventId));
    } catch (err) {
      console.error('Failed to remove event from Google Calendar:', err);
    }
  };

  // Google Drive attachment selected
  const handleSelectDriveAttachment = (att: DriveAttachment) => {
    if (selectedTaskForDetail) {
      if (selectedTaskForDetail.driveAttachments.some((a) => a.id === att.id || a.url === att.url)) {
        return;
      }
      const updatedList = [...selectedTaskForDetail.driveAttachments, att];
      const updatedTask: GQueueTask = {
        ...selectedTaskForDetail,
        driveAttachments: updatedList,
      };
      setSelectedTaskForDetail(updatedTask);
      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      setAllTasksCache((prev) => ({
        ...prev,
        [updatedTask.listId]: (prev[updatedTask.listId] || []).map((t) =>
          t.id === updatedTask.id ? updatedTask : t
        ),
      }));

      if (token) {
        updateTask(token, updatedTask.listId, updatedTask.id, {
          driveAttachments: updatedList,
        }).catch((err) => console.error('Failed to save Drive attachment to task:', err));
      }
    }
  };

  // Existing categories
  const existingCategories = useMemo(() => {
    return Array.from(new Set(queues.map((q) => q.category || 'My Queues')));
  }, [queues]);

  // If loading authentication state
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Connecting to Google Workspace...</p>
        </div>
      </div>
    );
  }

  // If not signed in with Google
  if (!user || !token) {
    return (
      <>
        <AuthScreen
          onSignIn={handleSignIn}
          isLoading={isLoggingIn}
          error={authError}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
        />
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 font-sans">
      {/* App Header */}
      <Header
        user={user}
        onSignOut={handleSignOut}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onQuickAddTask={() => {
          const el = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
          if (el) el.focus();
        }}
        onNewQueue={() => handleOpenNewQueueModal()}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isSyncing={isSyncing}
        onRefresh={handleRefresh}
        currentView={currentView}
        onViewChange={setCurrentView}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        completedCount={smartCounts.completed}
        todayMeetingsCount={todayMeetings.length}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenMeetingChecker={handleCheckMeetings}
        onOpenAIModal={() => setIsAIModalOpen(true)}
        isSessionExpired={isSessionExpired}
        onReconnect={handleReconnect}
        lastSyncTime={lastSyncTime}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden pb-16 md:pb-0">
        {/* Left Sidebar */}
        <Sidebar
          queues={queues}
          activeQueueId={activeQueueId}
          activeSmartQueue={activeSmartQueue}
          selectedTag={selectedTag}
          currentView={currentView}
          onViewChange={setCurrentView}
          onSelectQueue={handleSelectQueue}
          onSelectSmartQueue={handleSelectSmartQueue}
          onSelectTag={setSelectedTag}
          onNewQueue={handleOpenNewQueueModal}
          onEditQueue={handleEditQueueModal}
          onDeleteQueue={handleDeleteQueuePrompt}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          allTags={allTags}
          counts={smartCounts}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center / Right Content: 5 Main Views */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentView === 'tasks' && (
            <TaskList
              currentQueue={currentQueue}
              smartQueueType={activeSmartQueue}
              tasks={tasksToRender}
              allTasks={allTasksCombined}
              allQueues={queues}
              searchQuery={searchQuery}
              selectedTag={selectedTag}
              onToggleComplete={handleToggleComplete}
              onToggleStar={handleToggleStar}
              onQuickAddTask={handleQuickAddTask}
              onSelectTask={setSelectedTaskForDetail}
              onDeleteTask={handleDeleteTaskPrompt}
              onClearCompleted={handleClearCompletedPrompt}
              onEditQueue={handleEditQueueModal}
              onToggleSubtask={handleToggleSubtask}
              onAddSubtask={handleAddSubtask}
              onUpdatePriority={handleUpdateTaskPriority}
              onBatchComplete={handleBatchComplete}
              onBatchDelete={handleBatchDelete}
              onOpenCompletedView={() => setCurrentView('completed')}
              onOpenKanbanView={() => setCurrentView('kanban')}
              onEnterFocusMode={(task) => setFocusModeTask(task)}
            />
          )}

          {currentView === 'kanban' && (
            <KanbanBoard
              tasks={activeQueueId ? tasks : allTasksCombined}
              allTasks={allTasksCombined}
              queues={queues}
              currentQueue={currentQueue}
              onSelectTask={setSelectedTaskForDetail}
              onUpdateTaskStatus={handleUpdateTaskKanbanStatus}
              onQuickAddTask={handleQuickAddKanbanTask}
              onToggleComplete={handleToggleComplete}
              onEnterFocusMode={(task) => setFocusModeTask(task)}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView
              tasks={allTasksCombined}
              calendarEvents={calendarEvents}
              contacts={contacts}
              onSelectTask={setSelectedTaskForDetail}
              onToggleComplete={handleToggleComplete}
              onAddTask={(dateStr) => {
                handleQuickAddTask('New Task', dateStr);
              }}
              onCreateEvent={handleSaveCalendarEvent}
              onUpdateEvent={(id, data) => handleSaveCalendarEvent({ summary: data.summary || '', ...data, id })}
              onDeleteEvent={handleDeleteCalendarEvent}
              onConvertEventToTask={handleConvertEventToTask}
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardView
              tasks={tasksToRender}
              allTasks={allTasksCombined}
              queues={queues}
              onSelectTask={setSelectedTaskForDetail}
              onSelectQueue={(queueId) => {
                setActiveQueueId(queueId);
                setActiveSmartQueue(null);
                setCurrentView('tasks');
              }}
              onOpenCompletedView={() => setCurrentView('completed')}
            />
          )}

          {currentView === 'completed' && (
            <CompletedView
              tasks={allTasksCombined}
              queues={queues}
              onUncompleteTask={handleToggleComplete}
              onDeleteTask={handleDeleteTaskPrompt}
              onSelectTask={setSelectedTaskForDetail}
              onClearAllCompleted={() => {
                setConfirmModalConfig({
                  isOpen: true,
                  title: 'Clear All Completed Tasks',
                  message:
                    'Permanently clear all completed tasks across all Google Workspace queues? This will remove finished items from Google Tasks.',
                  confirmLabel: 'Clear All Completed',
                  isDestructive: true,
                  onConfirm: async () => {
                    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                    if (!token) return;

                    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
                    setAllTasksCache((prev) => {
                      const copy = { ...prev };
                      for (const qId of Object.keys(copy)) {
                        copy[qId] = copy[qId].filter((t) => t.status !== 'completed');
                      }
                      return copy;
                    });

                    for (const q of queues) {
                      clearCompletedTasks(token, q.id).catch(console.error);
                    }
                  },
                });
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        activeSmartQueue={activeSmartQueue}
        onSelectView={setCurrentView}
        onOpenQueuesDrawer={() => setIsMobileSidebarOpen(true)}
        onSelectToday={() => handleSelectSmartQueue('today')}
        onQuickAddTask={() => {
          const el = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        todayCount={smartCounts.today}
        completedCount={smartCounts.completed}
      />

      {/* Task Details Drawer/Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          allTasks={allTasksCombined}
          isOpen={true}
          contacts={contacts}
          accessToken={token}
          userDomain={user?.email?.includes('@') ? user.email.split('@')[1] : 'coolaireconsolidated.com'}
          onClose={() => setSelectedTaskForDetail(null)}
          onSave={handleSaveTaskDetail}
          onDelete={handleDeleteTaskPrompt}
          onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
          onSyncCalendar={handleSyncTaskToCalendar}
          onUnsyncCalendar={handleUnsyncTaskFromCalendar}
          onEnterFocusMode={(task) => setFocusModeTask(task)}
          onLogTimeSpent={handleLogTimeSpent}
          onRefreshContacts={async () => {
            if (token) {
              const domain = user?.email?.includes('@') ? user.email.split('@')[1] : 'coolaireconsolidated.com';
              const fresh = await fetchContacts(token, domain);
              setContacts(fresh);
            }
          }}
        />
      )}

      {/* Google Drive Picker Modal */}
      {isDrivePickerOpen && (
        <DrivePickerModal
          isOpen={isDrivePickerOpen}
          accessToken={token}
          onClose={() => setIsDrivePickerOpen(false)}
          onSelectFile={handleSelectDriveAttachment}
          onReauth={handleSignIn}
        />
      )}

      {/* New / Edit Queue Modal */}
      {isQueueModalOpen && (
        <NewQueueModal
          isOpen={isQueueModalOpen}
          initialQueue={queueModalTarget}
          defaultCategory={queueModalDefaultCat}
          existingCategories={existingCategories}
          onClose={() => {
            setIsQueueModalOpen(false);
            setQueueModalTarget(null);
          }}
          onSave={handleSaveQueue}
        />
      )}

      {/* Export Tasks Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tasks={allTasksCombined}
        queues={queues}
        currentQueue={currentQueue}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* PWA Install Modal (APK / iOS / Windows) */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />

      {/* Destructive Action User Confirmation Modal */}
      {/* Deep Work Focus Mode Modal */}
      {focusModeTask && (
        <FocusModeModal
          isOpen={true}
          task={focusModeTask}
          allTasks={allTasksCombined}
          onClose={() => setFocusModeTask(null)}
          onLogTime={handleLogTimeSpent}
          onToggleSubtask={(taskId, subId) => {
            const t = allTasksCombined.find((x) => x.id === taskId);
            if (t) handleToggleSubtask(t, subId);
          }}
          onCompleteTask={(t) => handleToggleComplete(t)}
        />
      )}

      {/* Google Workspace Meeting Checker Modal */}
      <MeetingCheckerModal
        isOpen={isMeetingCheckerOpen}
        onClose={() => setIsMeetingCheckerOpen(false)}
        meetings={todayMeetings}
        isLoading={isLoadingMeetings}
        onRefreshMeetings={handleCheckMeetings}
        onCreateTaskFromMeeting={handleConvertEventToTask}
        todayTasks={allTasksCombined.filter((t) => {
          if (!t.due) return false;
          return getManilaDateString(t.due) === getManilaTodayDateString();
        })}
      />

      {/* Real-time Toast Notification System */}
      <ToastNotificationSystem
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
        onClearAll={() => setNotifications([])}
        onSelectTask={(taskId) => {
          const found = allTasksCombined.find((t) => t.id === taskId);
          if (found) setSelectedTaskForDetail(found);
        }}
      />

      {/* Destructive Action User Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmLabel={confirmModalConfig.confirmLabel}
        isDestructive={confirmModalConfig.isDestructive}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* GQueues AI Companion Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        tasks={allTasksCombined}
        queues={queues}
        currentQueue={currentQueue}
        todayMeetings={todayMeetings}
        onQuickAddTask={(title, prio, due) => handleQuickAddTask(title, due, prio as any)}
        onAddTaskWithDetails={async (taskData) => {
          const targetQueueId = activeQueueId || queues[0]?.id;
          if (!token || !targetQueueId) return;
          try {
            const created = await createTask(token, targetQueueId, {
              title: taskData.title || 'New Task',
              due: taskData.due,
              priority: taskData.priority,
              notes: taskData.notes,
              timeEstimate: taskData.timeEstimate,
            });
            setTasks((prev) => [created, ...prev]);
            setAllTasksCache((prev) => ({
              ...prev,
              [targetQueueId]: [created, ...(prev[targetQueueId] || [])],
            }));
            addNotification({
              title: 'Task Created via AI',
              message: `Created "${taskData.title}" in ${currentQueue?.title || 'your queue'}.`,
              type: 'success',
            });
          } catch (err: any) {
            console.error('Failed to create task via AI:', err);
          }
        }}
      />
    </div>
  );
}
