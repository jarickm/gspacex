import React, { useState, useEffect } from 'react';
import type { AppNotification } from '../types/gqueues';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Video,
  X,
  ExternalLink,
  Volume2,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ToastNotificationSystemProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onSelectTask?: (taskId: string) => void;
}

// Gentle audio chime using Web Audio API (safe, no external assets required)
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio errors if blocked by browser policy
  }
}

export const ToastNotificationSystem: React.FC<ToastNotificationSystemProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  onSelectTask,
}) => {
  // Floating active toast queue (shows last 3 most recent notifications for 5 seconds)
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      // Only add to toast if not already in activeToasts
      setActiveToasts((prev) => {
        if (prev.some((t) => t.id === latest.id)) return prev;
        playNotificationChime();
        return [latest, ...prev.slice(0, 2)];
      });

      // Auto dismiss after 5 seconds
      const timer = setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== latest.id));
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {activeToasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isMeeting = toast.type === 'meeting';
        const isTimer = toast.type === 'timer';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 flex items-start gap-3 ${
              isMeeting
                ? 'bg-blue-900/95 text-white border-blue-700'
                : isTimer
                ? 'bg-purple-900/95 text-white border-purple-700'
                : isWarning
                ? 'bg-amber-900/95 text-white border-amber-700'
                : isSuccess
                ? 'bg-emerald-900/95 text-white border-emerald-700'
                : 'bg-slate-900/95 text-white border-slate-700'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {isMeeting ? (
                <Video className="w-5 h-5 text-blue-300 animate-pulse" />
              ) : isTimer ? (
                <Clock className="w-5 h-5 text-purple-300" />
              ) : isWarning ? (
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              ) : (
                <Bell className="w-5 h-5 text-blue-300" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold truncate">{toast.title}</p>
                <span className="text-[10px] opacity-70">
                  {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5 line-clamp-2 leading-relaxed">{toast.message}</p>

              {/* Action buttons on toast */}
              <div className="mt-2 flex items-center gap-2">
                {toast.meetingLink && (
                  <a
                    href={toast.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 rounded-md text-[11px] font-bold hover:bg-blue-50 transition-colors shadow-xs"
                  >
                    <Video className="w-3 h-3" />
                    Join Google Meet
                  </a>
                )}
                {toast.taskId && onSelectTask && (
                  <button
                    onClick={() => {
                      onSelectTask(toast.taskId!);
                      setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[11px] font-medium transition-colors"
                  >
                    View Task
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/60 hover:text-white p-1 rounded transition-colors flex-shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
