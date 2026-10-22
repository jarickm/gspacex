import React, { useState, useEffect } from 'react';
import type { GoogleCalendarEvent, GoogleContact } from '../types/gqueues';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  MapPin,
  Users,
  AlignLeft,
  X,
  Trash2,
  ExternalLink,
  Plus,
  Check,
  Sparkles,
  ArrowRight,
  ListTodo,
  Loader2,
} from 'lucide-react';
import { aiGenerateMeetingPrep } from '../services/aiApi';
import {
  MANILA_TIMEZONE,
  MANILA_LABEL,
  getManilaTodayDateString,
  getManilaDateString,
  getManilaTimeString24,
} from '../utils/timezone';

interface CalendarEventModalProps {
  isOpen: boolean;
  event: GoogleCalendarEvent | null; // null if creating a new one
  initialDate?: string;
  contacts?: GoogleContact[];
  onClose: () => void;
  onSave: (eventData: {
    id?: string;
    summary: string;
    description?: string;
    dueDate?: string; // YYYY-MM-DD or ISO
    startTime?: string; // HH:mm
    endTime?: string; // HH:mm
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
    addGoogleMeet?: boolean;
  }) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  onConvertToTask?: (event: GoogleCalendarEvent) => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  event,
  initialDate,
  contacts = [],
  onClose,
  onSave,
  onDelete,
  onConvertToTask,
}) => {
  const isEditing = !!event?.id;

  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<Array<{ email: string; displayName?: string }>>([]);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [addGoogleMeet, setAddGoogleMeet] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleAIGenerateAgenda = async () => {
    if (!summary.trim() || isGeneratingAI) return;
    setIsGeneratingAI(true);
    try {
      const res = await aiGenerateMeetingPrep(summary, description, attendees, location);
      let newDesc = '';
      if (res.outcomeGoal) {
        newDesc += `🎯 Objective: ${res.outcomeGoal}\n\n`;
      }
      if (res.agenda && res.agenda.length > 0) {
        newDesc += `📋 Agenda:\n${res.agenda.map((a) => `• ${a}`).join('\n')}\n\n`;
      }
      if (res.discussionQuestions && res.discussionQuestions.length > 0) {
        newDesc += `❓ Key Questions:\n${res.discussionQuestions.map((q) => `• ${q}`).join('\n')}\n\n`;
      }
      if (description && description.trim()) {
        newDesc += `Notes:\n${description}`;
      }
      setDescription(newDesc.trim());
    } catch (err: any) {
      console.error('AI Meeting Prep error:', err);
      setError(`AI agenda generation failed: ${err.message || 'Please try again'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (event) {
      // Clean prefix if it had [GQueues]
      const cleanTitle = event.summary ? event.summary.replace(/^\[GQueues\]\s*/i, '') : '';
      setSummary(cleanTitle);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setAttendees(event.attendees || []);

      const startDateTime = event.start?.dateTime;
      const startDate = event.start?.date;

      if (startDateTime) {
        setIsAllDay(false);
        setDate(getManilaDateString(startDateTime));
        setStartTime(getManilaTimeString24(startDateTime));
      } else if (startDate) {
        setIsAllDay(true);
        setDate(startDate);
      } else {
        setDate(initialDate || getManilaTodayDateString());
      }

      const endDateTime = event.end?.dateTime;
      if (endDateTime) {
        setEndTime(getManilaTimeString24(endDateTime));
      }

      setAddGoogleMeet(!!event.hangoutLink);
    } else {
      setSummary('');
      setDescription('');
      setDate(initialDate || getManilaTodayDateString());
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setLocation('');
      setAttendees([]);
      setAddGoogleMeet(true);
    }
    setConfirmDelete(false);
    setError(null);
  }, [event, initialDate, isOpen]);

  if (!isOpen) return null;

  const handleAddAttendee = (emailToAdd?: string) => {
    const targetEmail = (emailToAdd || newAttendeeEmail).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) return;
    if (attendees.some((a) => a.email.toLowerCase() === targetEmail)) return;

    const matchedContact = contacts.find((c) => c.email.toLowerCase() === targetEmail);
    setAttendees((prev) => [
      ...prev,
      {
        email: targetEmail,
        displayName: matchedContact?.name || targetEmail.split('@')[0],
      },
    ]);
    setNewAttendeeEmail('');
  };

  const handleRemoveAttendee = (emailToRemove: string) => {
    setAttendees((prev) => prev.filter((a) => a.email.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Event title is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      let dueDateStr = date;
      if (!isAllDay && startTime) {
        dueDateStr = `${date}T${startTime}:00`;
      }

      await onSave({
        id: event?.id,
        summary: summary.trim(),
        description: description.trim(),
        dueDate: dueDateStr,
        startTime: isAllDay ? undefined : startTime,
        endTime: isAllDay ? undefined : endTime,
        location: location.trim(),
        attendees,
        addGoogleMeet,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !onDelete) return;

    try {
      setIsDeleting(true);
      await onDelete(event.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  {isEditing ? 'Edit Google Calendar Meeting' : 'Schedule New Meeting / Event'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30">
                  🇵🇭 Manila (GMT+8)
                </span>
              </div>
              <p className="text-xs text-amber-100">
                Directly syncs with Google Calendar in Philippine Standard Time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Event Title / Meeting Topic *
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Weekly Team Sync, Client Product Demo, Sprint Planning..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              autoFocus
              required
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-4">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-2 cursor-pointer pt-4">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                All-day Event
              </label>
            </div>

            {!isAllDay && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Start Time
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1 rounded">PHT (GMT+8)</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> End Time
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1 rounded">PHT (GMT+8)</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </>
            )}
          </div>

          {/* Google Meet Video Conference */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-900">Google Meet Video Call</p>
                <p className="text-[11px] text-blue-700">
                  {event?.hangoutLink ? 'Video conference link generated' : 'Include Google Meet video call link'}
                </p>
              </div>
            </div>

            {event?.hangoutLink ? (
              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
              >
                Join Meet <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={addGoogleMeet}
                  onChange={(e) => setAddGoogleMeet(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location / Room (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Conference Room B, HQ 4th Floor, or Online"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Attendees ({attendees.length})
            </label>
            
            {/* Added list */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attendees.map((att) => (
                  <span
                    key={att.email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900"
                  >
                    <span className="font-medium truncate max-w-[150px]">
                      {att.displayName || att.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(att.email)}
                      className="text-amber-500 hover:text-amber-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add attendee input */}
            <div className="flex gap-2">
              <input
                type="email"
                value={newAttendeeEmail}
                onChange={(e) => setNewAttendeeEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttendee();
                  }
                }}
                placeholder="colleague@coolaireconsolidated.com..."
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                type="button"
                onClick={() => handleAddAttendee()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {/* Suggested colleagues from Google Workspace directory */}
            {contacts.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Quick add colleague:
                </span>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {contacts.slice(0, 8).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => handleAddAttendee(c.email)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded text-[11px] text-slate-600 transition-colors"
                    >
                      +{c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description / Agenda */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-slate-400" /> Agenda & Description
              </label>

              <button
                type="button"
                onClick={handleAIGenerateAgenda}
                disabled={isGeneratingAI || !summary.trim()}
                className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Use Gemini AI to draft an agenda for this meeting"
              >
                {isGeneratingAI ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-200" />
                )}
                <span>{isGeneratingAI ? 'Drafting...' : '✨ AI Agenda'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda, action items, or notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Convert to Task option */}
          {isEditing && onConvertToTask && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-emerald-600" />
                  Turn into a GQueues Task
                </p>
                <p className="text-[11px] text-emerald-700">
                  Track prep work and follow-up to-dos in your queue
                </p>
              </div>
              <button
                type="button"
                onClick={() => onConvertToTask(event)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-2xs transition-colors"
              >
                Create Task
              </button>
            </div>
          )}
        </form>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {isEditing && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting || isSaving}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete?'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isDeleting || isSaving}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Meeting
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || isDeleting}
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Saving to Google...' : isEditing ? 'Save Changes' : 'Create Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
