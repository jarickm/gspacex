import React, { useState, useMemo } from 'react';
import type { GQueueTask, GoogleCalendarEvent, GoogleContact } from '../types/gqueues';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  Video,
  Edit2,
  MapPin,
  Users,
  Check,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { CalendarEventModal } from './CalendarEventModal';
import {
  MANILA_TIMEZONE,
  MANILA_LABEL,
  getManilaTodayDateString,
  getManilaDateString,
  formatManilaTime,
  formatManilaFullDate,
  getManilaCurrentComponents,
} from '../utils/timezone';

export type CalendarScope = 'day' | 'week' | 'month';

interface CalendarViewProps {
  tasks: GQueueTask[];
  calendarEvents: GoogleCalendarEvent[];
  contacts?: GoogleContact[];
  onSelectTask: (task: GQueueTask) => void;
  onToggleComplete: (task: GQueueTask) => void;
  onAddTask: (dateStr: string) => void;
  onCreateEvent?: (eventData: {
    summary: string;
    description?: string;
    dueDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
    addGoogleMeet?: boolean;
  }) => Promise<void>;
  onUpdateEvent?: (
    eventId: string,
    eventData: {
      summary?: string;
      description?: string;
      dueDate?: string;
      startTime?: string;
      endTime?: string;
      location?: string;
      attendees?: Array<{ email: string; displayName?: string }>;
    }
  ) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onConvertEventToTask?: (event: GoogleCalendarEvent) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  calendarEvents,
  contacts = [],
  onSelectTask,
  onToggleComplete,
  onAddTask,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onConvertEventToTask,
}) => {
  const todayStr = getManilaTodayDateString();

  // Calendar View Scope: 'day' | 'week' | 'month' (Mobile default to 'day' or 'week' for spacious readability)
  const [calendarScope, setCalendarScope] = useState<CalendarScope>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'day';
    }
    return 'month';
  });

  // Active selected date (YYYY-MM-DD in Manila Time)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Month navigation year/month
  const [currentYearMonth, setCurrentYearMonth] = useState<{ year: number; month: number }>(() => {
    const comp = getManilaCurrentComponents();
    return { year: comp.year, month: comp.month };
  });

  // Modal states for clicking / editing
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<GoogleCalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [targetDateForCreate, setTargetDateForCreate] = useState<string>('');
  const [targetTimeForCreate, setTargetTimeForCreate] = useState<string>('09:00');

  // Quick Action menu when clicking on empty cell in month view
  const [cellActionMenu, setCellActionMenu] = useState<{
    dateStr: string;
    x: number;
    y: number;
  } | null>(null);

  // Map tasks by date YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map: Record<string, GQueueTask[]> = {};
    for (const t of tasks) {
      if (t.due) {
        const d = getManilaDateString(t.due);
        if (!map[d]) map[d] = [];
        map[d].push(t);
      }
    }
    return map;
  }, [tasks]);

  // Map calendar events by date YYYY-MM-DD in Manila Time
  const eventsByDate = useMemo(() => {
    const map: Record<string, GoogleCalendarEvent[]> = {};
    for (const e of calendarEvents) {
      const d = e.start.date || (e.start.dateTime ? getManilaDateString(e.start.dateTime) : null);
      if (d) {
        if (!map[d]) map[d] = [];
        map[d].push(e);
      }
    }
    return map;
  }, [calendarEvents]);

  // --- Day / Week / Month Navigation Helpers ---

  // Helper to shift selectedDate by N days
  const shiftSelectedDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + days);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    const newDateStr = `${newY}-${newM}-${newD}`;
    setSelectedDate(newDateStr);
    setCurrentYearMonth({ year: newY, month: dateObj.getMonth() });
  };

  // Compute 7 days of the current week for selectedDate
  const currentWeekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const currentObj = new Date(y, m - 1, d);
    const dayOfWeek = currentObj.getDay(); // 0 is Sun

    const days: Array<{
      dateString: string;
      dayName: string;
      shortDayName: string;
      dayNum: number;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const offset = i - dayOfWeek;
      const targetObj = new Date(y, m - 1, d + offset);
      const targetStr = `${targetObj.getFullYear()}-${String(targetObj.getMonth() + 1).padStart(2, '0')}-${String(targetObj.getDate()).padStart(2, '0')}`;
      days.push({
        dateString: targetStr,
        dayName: targetObj.toLocaleDateString('en-US', { weekday: 'long' }),
        shortDayName: targetObj.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: targetObj.getDate(),
        isToday: targetStr === todayStr,
        isSelected: targetStr === selectedDate,
      });
    }
    return days;
  }, [selectedDate, todayStr]);

  // Month navigation
  const { year, month } = currentYearMonth;
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay(); // 0 is Sun
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonth = () => {
    if (month === 0) {
      setCurrentYearMonth({ year: year - 1, month: 11 });
    } else {
      setCurrentYearMonth({ year, month: month - 1 });
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setCurrentYearMonth({ year: year + 1, month: 0 });
    } else {
      setCurrentYearMonth({ year, month: month + 1 });
    }
  };

  const handlePrev = () => {
    if (calendarScope === 'day') {
      shiftSelectedDate(-1);
    } else if (calendarScope === 'week') {
      shiftSelectedDate(-7);
    } else {
      prevMonth();
    }
  };

  const handleNext = () => {
    if (calendarScope === 'day') {
      shiftSelectedDate(1);
    } else if (calendarScope === 'week') {
      shiftSelectedDate(7);
    } else {
      nextMonth();
    }
  };

  const handleGoToday = () => {
    setSelectedDate(todayStr);
    const comp = getManilaCurrentComponents();
    setCurrentYearMonth({ year: comp.year, month: comp.month });
  };

  // Header Title based on current scope
  const headerTitle = useMemo(() => {
    if (calendarScope === 'day') {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: MANILA_TIMEZONE,
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(y, m - 1, d));
    }
    if (calendarScope === 'week') {
      const first = currentWeekDays[0];
      const last = currentWeekDays[6];
      return `${first.shortDayName}, ${first.dayNum} – ${last.shortDayName}, ${last.dayNum} (${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(year, month, 1))})`;
    }
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month, 1));
  }, [calendarScope, selectedDate, currentWeekDays, year, month]);

  // Modal handlers
  const handleOpenEditEvent = (evt: GoogleCalendarEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEventForEdit(evt);
    setIsEventModalOpen(true);
  };

  const handleOpenCreateEventModal = (dateStr: string, timeStr?: string) => {
    setSelectedEventForEdit(null);
    setTargetDateForCreate(dateStr);
    setTargetTimeForCreate(timeStr || '09:00');
    setIsEventModalOpen(true);
    setCellActionMenu(null);
  };

  const handleSaveEvent = async (eventData: any) => {
    if (eventData.id && onUpdateEvent) {
      await onUpdateEvent(eventData.id, eventData);
    } else if (onCreateEvent) {
      await onCreateEvent(eventData);
    }
  };

  // Month grid 42 cells calculation
  const calendarCells = useMemo(() => {
    const cells = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevMonthIdx = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateString = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dateString, dayNum, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({ dateString, dayNum: i, isCurrentMonth: true });
    }

    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonthIdx = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateString = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({ dateString, dayNum: i, isCurrentMonth: false });
    }
    return cells;
  }, [year, month, startDay, daysInMonth]);

  // Hours array for Day View timeline (08:00 to 20:00)
  const dayTimelineHours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

  return (
    <div
      className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative"
      onClick={() => setCellActionMenu(null)}
    >
      {/* Top Header Bar: View Scope Switcher, Navigation, Timezone Badge */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Left: Scope title and Timezone badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs flex-shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {headerTitle}
              </h2>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs"
                title={MANILA_LABEL}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                🇵🇭 Manila Time (GMT+8)
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {calendarScope === 'day'
                ? 'Detailed daily agenda with meetings, Google Meet video, and task progress'
                : calendarScope === 'week'
                ? '7-day schedule with spacious cards for mobile and desktop'
                : 'Month matrix view • Tap any day to drill in'}
            </p>
          </div>
        </div>

        {/* Right: View Scope Toggle & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Day / Week / Month Scope Switcher (User requested for mobile readability) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCalendarScope('day')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                calendarScope === 'day'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setCalendarScope('week')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                calendarScope === 'week'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setCalendarScope('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                calendarScope === 'month'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
          </div>

          {/* Quick Schedule Meeting Button */}
          <button
            onClick={() => handleOpenCreateEventModal(selectedDate)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Schedule Meet</span>
          </button>

          {/* Previous / Today / Next Navigation */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleGoToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DAY VIEW (Spacious, Clear, Ideal for Mobile) */}
      {calendarScope === 'day' && (() => {
        const dayEvents = eventsByDate[selectedDate] || [];
        const dayTasks = tasksByDate[selectedDate] || [];
        const isToday = selectedDate === todayStr;

        return (
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5">
            {/* Day Header Banner */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {formatManilaFullDate(selectedDate)}
                  </span>
                  {isToday && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                      TODAY
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {dayEvents.length} Meeting{dayEvents.length === 1 ? '' : 's'} • {dayTasks.length} Task{dayTasks.length === 1 ? '' : 's'} scheduled for this date (Manila Time)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddTask(selectedDate)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateEventModal(selectedDate)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  Schedule Meet
                </button>
              </div>
            </div>

            {/* Meetings Section in Day View */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-amber-500" />
                  Google Workspace Meetings & Events ({dayEvents.length})
                </h3>
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Philippine Standard Time (PHT)
                </span>
              </div>

              {dayEvents.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No meetings scheduled for this day</p>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateEventModal(selectedDate)}
                    className="text-xs text-amber-700 hover:underline font-bold"
                  >
                    + Schedule a meeting with Google Meet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dayEvents.map((evt) => {
                    const hasMeet = !!evt.hangoutLink;
                    const startTimeStr = evt.start.dateTime
                      ? formatManilaTime(evt.start.dateTime)
                      : 'All Day';
                    const endTimeStr = evt.end.dateTime
                      ? formatManilaTime(evt.end.dateTime, true)
                      : '';

                    return (
                      <div
                        key={evt.id}
                        onClick={() => handleOpenEditEvent(evt)}
                        className="p-4 bg-white hover:bg-amber-50/40 rounded-2xl border border-amber-200/90 shadow-2xs transition-all cursor-pointer group space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              {startTimeStr} {endTimeStr ? `– ${endTimeStr}` : ''}
                            </span>
                            {hasMeet && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                Google Meet
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-amber-600 group-hover:text-amber-800 font-semibold flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Edit
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-amber-900">
                          {evt.summary}
                        </h4>

                        {evt.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {evt.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            {evt.location && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {evt.location}
                              </span>
                            )}
                            {evt.attendees && evt.attendees.length > 0 && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                {evt.attendees.length} Attendee{evt.attendees.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {evt.hangoutLink && (
                            <a
                              href={evt.hangoutLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Join Meet
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tasks Section in Day View */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  GQueues Tasks Due ({dayTasks.length})
                </h3>
                <button
                  type="button"
                  onClick={() => onAddTask(selectedDate)}
                  className="text-xs text-blue-600 hover:underline font-bold"
                >
                  + Add task on this day
                </button>
              </div>

              {dayTasks.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No tasks due on this date</p>
                  <button
                    type="button"
                    onClick={() => onAddTask(selectedDate)}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    + Add a new task for {selectedDate}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayTasks.map((t) => {
                    const isDone = t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask(t)}
                        className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-xs group flex items-start gap-3 ${
                          isDone
                            ? 'bg-slate-50/70 border-slate-200 opacity-60'
                            : 'hover:border-blue-300 border-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleComplete(t);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 flex-shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold leading-snug group-hover:text-blue-700 ${
                                isDone ? 'line-through text-slate-400' : 'text-slate-900'
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.priority && t.priority !== 'none' && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  t.priority === 'urgent'
                                    ? 'bg-red-100 text-red-700'
                                    : t.priority === 'high'
                                    ? 'bg-amber-100 text-amber-700'
                                    : t.priority === 'medium'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {t.priority}
                              </span>
                            )}
                            {t.timeEstimate && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                ⏱️ {t.timeEstimate}
                              </span>
                            )}
                          </div>

                          {t.notes && (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {t.notes}
                            </p>
                          )}

                          {t.subtasks && t.subtasks.length > 0 && (
                            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                              <span>
                                {t.subtasks.filter((s) => s.completed).length} of {t.subtasks.length} subtasks done
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hourly Tap-to-Schedule Timeline for Day View */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Hourly Timeline & Quick Slot Booking (PHT)
              </h3>
              <div className="divide-y divide-slate-100">
                {dayTimelineHours.map((hour) => {
                  const hourStr = String(hour).padStart(2, '0') + ':00';
                  const hourSlotEvents = dayEvents.filter((e) => {
                    if (!e.start.dateTime) return false;
                    const eventTimeStr = formatManilaTime(e.start.dateTime);
                    return eventTimeStr.startsWith(String(hour > 12 ? hour - 12 : hour));
                  });

                  return (
                    <div
                      key={hour}
                      onClick={() => handleOpenCreateEventModal(selectedDate, hourStr)}
                      className="py-2.5 px-2 flex items-center justify-between hover:bg-blue-50/40 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-14 text-xs font-mono font-bold text-slate-500">
                          {hourStr}
                        </span>
                        {hourSlotEvents.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {hourSlotEvents.map((evt) => (
                              <span
                                key={evt.id}
                                onClick={(e) => handleOpenEditEvent(evt, e)}
                                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold"
                              >
                                {evt.summary}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 group-hover:text-blue-600 transition-colors">
                            + Tap to book {hourStr}
                          </span>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* VIEW 2: WEEK VIEW (Ultra-clean Agenda Cards for Mobile & Desktop) */}
      {calendarScope === 'week' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
          {/* 7-Day Pill Bar */}
          <div className="grid grid-cols-7 gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
            {currentWeekDays.map((day) => {
              const dayEvts = eventsByDate[day.dateString] || [];
              const dayTsks = tasksByDate[day.dateString] || [];
              const totalItems = dayEvts.length + dayTsks.length;

              return (
                <button
                  key={day.dateString}
                  type="button"
                  onClick={() => setSelectedDate(day.dateString)}
                  className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                    day.isSelected
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : day.isToday
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    {day.shortDayName}
                  </span>
                  <span className="text-sm sm:text-base font-extrabold mt-0.5">
                    {day.dayNum}
                  </span>
                  {totalItems > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        day.isSelected ? 'bg-white' : 'bg-amber-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Weekly Agenda Card List (Mobile-friendly vertical cards for all 7 days) */}
          <div className="space-y-4">
            {currentWeekDays.map((day) => {
              const dayEvts = eventsByDate[day.dateString] || [];
              const dayTsks = tasksByDate[day.dateString] || [];
              const hasItems = dayEvts.length > 0 || dayTsks.length > 0;

              return (
                <div
                  key={day.dateString}
                  className={`p-4 sm:p-5 bg-white rounded-2xl border transition-all shadow-2xs space-y-3 ${
                    day.isToday
                      ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Day Title & Action buttons */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-slate-900">
                        {day.dayName}, {new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(day.dateString))} {day.dayNum}
                      </span>
                      {day.isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                          TODAY
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(day.dateString);
                          setCalendarScope('day');
                        }}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                      >
                        Open Day View
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddTask(day.dateString)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Add task"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateEventModal(day.dateString)}
                        className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Schedule meet"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Day Content */}
                  {!hasItems ? (
                    <div className="py-3 text-center text-xs text-slate-400 italic">
                      No meetings or tasks scheduled for {day.dayName}.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Meetings */}
                      {dayEvts.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenEditEvent(evt)}
                          className="p-3 bg-amber-50 hover:bg-amber-100/90 rounded-xl border border-amber-200/90 text-xs text-amber-900 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Video className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="font-bold truncate">{evt.summary}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] text-amber-700 font-semibold">
                              {evt.start.dateTime ? formatManilaTime(evt.start.dateTime) : 'All Day'}
                            </span>
                            <Edit2 className="w-3 h-3 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}

                      {/* Tasks */}
                      {dayTsks.map((t) => {
                        const isDone = t.status === 'completed';
                        return (
                          <div
                            key={t.id}
                            onClick={() => onSelectTask(t)}
                            className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer transition-colors ${
                              isDone
                                ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                                : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100 text-blue-900 font-medium'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete(t);
                              }}
                              className="text-slate-400 hover:text-emerald-600 flex-shrink-0"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <span className="truncate flex-1">{t.title}</span>
                            {t.priority && t.priority !== 'none' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white text-slate-700 uppercase border border-slate-200">
                                {t.priority}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: MONTH VIEW (Classic Grid for Desktop / Full Calendar Scanning) */}
      {calendarScope === 'month' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-white border-b border-slate-200 text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span className="text-rose-500">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-blue-500">Sat</span>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-slate-200 overflow-y-auto">
            {calendarCells.map((cell) => {
              const isToday = cell.dateString === todayStr;
              const dayTasks = tasksByDate[cell.dateString] || [];
              const dayEvents = eventsByDate[cell.dateString] || [];

              return (
                <div
                  key={cell.dateString}
                  onClick={(e) => {
                    // On mobile, tapping cell switches to day view so user can view/interact easily
                    if (window.innerWidth < 768) {
                      setSelectedDate(cell.dateString);
                      setCalendarScope('day');
                      return;
                    }

                    setCellActionMenu({
                      dateStr: cell.dateString,
                      x: Math.min(e.clientX, window.innerWidth - 220),
                      y: Math.min(e.clientY, window.innerHeight - 150),
                    });
                  }}
                  className={`min-h-[90px] sm:min-h-[105px] p-1.5 sm:p-2 bg-white flex flex-col justify-between group transition-colors cursor-pointer hover:bg-blue-50/20 ${
                    !cell.isCurrentMonth ? 'bg-slate-50/70 text-slate-400' : 'text-slate-800'
                  } ${isToday ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-400' : ''}`}
                >
                  {/* Day Number and Action Buttons */}
                  <div className="flex items-center justify-between pointer-events-auto">
                    <span
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    <div className="hidden sm:flex opacity-0 group-hover:opacity-100 items-center gap-1 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddTask(cell.dateString);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Add task on this date"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCreateEventModal(cell.dateString);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title="Schedule meeting on this date"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Items Container */}
                  <div className="flex-1 overflow-y-auto space-y-1 my-1 max-h-24 pr-0.5">
                    {/* Meetings */}
                    {dayEvents.map((evt) => {
                      const timeDisplay = evt.start.dateTime
                        ? formatManilaTime(evt.start.dateTime)
                        : 'All Day';

                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => handleOpenEditEvent(evt, e)}
                          className="p-1 sm:p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100/90 border border-amber-200/90 text-[11px] text-amber-900 flex items-center justify-between gap-1 shadow-2xs group/item transition-all cursor-pointer"
                          title={`Click to edit: ${evt.summary} (${timeDisplay} PHT)`}
                        >
                          <div className="flex items-center gap-1 truncate min-w-0">
                            <Video className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            <span className="truncate font-semibold">{evt.summary}</span>
                          </div>
                          <span className="text-[9px] text-amber-700 font-medium hidden sm:inline flex-shrink-0">
                            {timeDisplay}
                          </span>
                        </div>
                      );
                    })}

                    {/* Tasks */}
                    {dayTasks.map((t) => {
                      const isDone = t.status === 'completed';
                      return (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask(t);
                          }}
                          className={`p-1 sm:p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${
                            isDone
                              ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                              : 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900 hover:bg-blue-100 font-medium'
                          }`}
                          title={`Click to edit task: ${t.title}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(t);
                            }}
                            className="text-slate-400 hover:text-emerald-600 flex-shrink-0"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Circle className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                          <span className="truncate flex-1">{t.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popover Action Menu for empty day clicking in Month view */}
      {cellActionMenu && (
        <div
          style={{ top: cellActionMenu.y, left: cellActionMenu.x }}
          className="fixed z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 w-60 flex flex-col gap-1 animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 flex items-center justify-between">
            <span>{cellActionMenu.dateStr}</span>
            <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded font-bold">PHT</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedDate(cellActionMenu.dateStr);
              setCalendarScope('day');
              setCellActionMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <CalendarDays className="w-4 h-4 text-blue-600" />
            Open Detailed Day View
          </button>
          <button
            type="button"
            onClick={() => {
              onAddTask(cellActionMenu.dateStr);
              setCellActionMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            Add GQueues Task
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreateEventModal(cellActionMenu.dateStr)}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 hover:bg-amber-50 hover:text-amber-700 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Video className="w-4 h-4 text-amber-600" />
            Schedule Google Meet (PHT)
          </button>
        </div>
      )}

      {/* Calendar Event / Meeting Editor & Scheduler Modal */}
      <CalendarEventModal
        isOpen={isEventModalOpen}
        event={selectedEventForEdit}
        initialDate={targetDateForCreate}
        contacts={contacts}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEventForEdit(null);
        }}
        onSave={handleSaveEvent}
        onDelete={onDeleteEvent}
        onConvertToTask={onConvertEventToTask}
      />
    </div>
  );
};
