import React, { useState } from 'react';
import type { CalendarMeeting, GQueueTask } from '../types/gqueues';
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Users,
  MapPin,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import {
  formatManilaTime,
  formatManilaFullDate,
  MANILA_LABEL,
} from '../utils/timezone';

interface MeetingCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: CalendarMeeting[];
  isLoading: boolean;
  onRefreshMeetings: () => Promise<void>;
  onCreateTaskFromMeeting: (meeting: CalendarMeeting) => Promise<void>;
  todayTasks: GQueueTask[];
}

export const MeetingCheckerModal: React.FC<MeetingCheckerModalProps> = ({
  isOpen,
  onClose,
  meetings,
  isLoading,
  onRefreshMeetings,
  onCreateTaskFromMeeting,
  todayTasks,
}) => {
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateTask = async (meeting: CalendarMeeting) => {
    setAddingTaskId(meeting.id);
    try {
      await onCreateTaskFromMeeting(meeting);
    } finally {
      setAddingTaskId(null);
    }
  };

  const liveMeetings = meetings.filter((m) => m.isLiveNow);
  const upcomingMeetings = meetings.filter((m) => !m.isLiveNow && (m.startsInMinutes === undefined || m.startsInMinutes >= 0));
  const pastMeetings = meetings.filter((m) => !m.isLiveNow && m.startsInMinutes !== undefined && m.startsInMinutes < 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200/90 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-white to-amber-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base">Google Workspace Meetings</h3>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                  title={MANILA_LABEL}
                >
                  🇵🇭 Philippines (PHT, GMT+8)
                </span>
                {meetings.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {meetings.length} Today
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Live Google Calendar events in Philippine Standard Time (Manila UTC+8).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshMeetings}
              disabled={isLoading}
              title="Refresh Google Calendar events"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active Live Meeting Banner */}
          {liveMeetings.length > 0 && (
            <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  HAPPENING NOW (MANILA TIME)
                </span>
                <span className="text-xs font-medium text-emerald-800">In Progress</span>
              </div>

              {liveMeetings.map((m) => (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.summary}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      {m.start.dateTime ? formatManilaTime(m.start.dateTime) : 'All Day'} -{' '}
                      {m.end.dateTime ? formatManilaTime(m.end.dateTime, true) : ''}
                    </p>
                  </div>

                  {m.hangoutLink && (
                    <a
                      href={m.hangoutLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Join Google Meet
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Today's Meetings List */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Schedule & Agenda ({meetings.length})
              </h4>
              <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                🇵🇭 {formatManilaFullDate()}
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                <p>Checking Google Workspace calendar...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No meetings scheduled for today!</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  You have a clear calendar schedule. A great opportunity to focus on your deep work tasks in GQueues.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => {
                  const startTime = m.start.dateTime
                    ? formatManilaTime(m.start.dateTime)
                    : 'All Day';
                  const endTime = m.end.dateTime
                    ? formatManilaTime(m.end.dateTime, true)
                    : '';

                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        m.isLiveNow
                          ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {startTime} {endTime ? `- ${endTime}` : ''}
                            </span>
                            {m.isLiveNow ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white animate-pulse">
                                LIVE
                              </span>
                            ) : m.startsInMinutes !== undefined && m.startsInMinutes > 0 ? (
                              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                In {m.startsInMinutes} mins
                              </span>
                            ) : null}
                          </div>

                          <h5 className="font-bold text-slate-900 text-sm truncate">{m.summary}</h5>

                          {m.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">{m.description}</p>
                          )}

                          {/* Location & Attendees */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                            {m.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {m.location}
                              </span>
                            )}
                            {m.attendees && m.attendees.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-slate-400" />
                                {m.attendees.length} attendee{m.attendees.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Meeting Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                          {m.hangoutLink && (
                            <a
                              href={m.hangoutLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Join Meet
                            </a>
                          )}

                          <button
                            type="button"
                            disabled={addingTaskId === m.id}
                            onClick={() => handleCreateTask(m)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                            title="Create a prep or action item task in GQueues"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {addingTaskId === m.id ? 'Adding...' : 'Add Task'}
                          </button>

                          {m.htmlLink && (
                            <a
                              href={m.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Open in Google Calendar"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today Tasks Alignment Note */}
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                You have <strong>{todayTasks.length} task{todayTasks.length === 1 ? '' : 's'}</strong> scheduled for today alongside your meetings.
              </span>
            </div>
            <span className="font-semibold text-blue-700">Aligned with Calendar</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Synced directly with Google Calendar API</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
