import React, { useState, useEffect, useRef } from 'react';
import type { GQueueTask, Subtask } from '../types/gqueues';
import { formatSecondsToHuman } from '../services/tasksApi';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Maximize2,
  Minimize2,
  Coffee,
  Brain,
  Clock,
  Plus,
  Flame,
  Check,
  ChevronRight,
  Sliders,
} from 'lucide-react';

interface FocusModeModalProps {
  isOpen: boolean;
  task: GQueueTask;
  allTasks?: GQueueTask[];
  onClose: () => void;
  onLogTime: (taskId: string, secondsLogged: number, sessionNote: string) => Promise<void>;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onCompleteTask?: (task: GQueueTask) => void;
}

type AmbientType = 'none' | 'whitenoise' | 'rain' | 'forest';

export const FocusModeModal: React.FC<FocusModeModalProps> = ({
  isOpen,
  task,
  allTasks = [],
  onClose,
  onLogTime,
  onToggleSubtask,
  onCompleteTask,
}) => {
  // Timer settings
  const [sessionType, setSessionType] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [initialDuration, setInitialDuration] = useState(25 * 60); // 25 mins
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedFocusSeconds, setElapsedFocusSeconds] = useState(0);

  // Scratchpad
  const [scratchpad, setScratchpad] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Web Audio for Ambient sounds & Chimes
  const [ambientSound, setAmbientSound] = useState<AmbientType>('none');
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientNodeRef = useRef<{ stop: () => void } | null>(null);

  // Sound chime synthesizer using Web Audio API
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;

      // Play pleasant two-tone chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.3); // A5

      osc2.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.3); // E5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio chime unsupported:', e);
    }
  };

  // Ambient sound synthesizer
  const startAmbient = (type: AmbientType) => {
    if (ambientNodeRef.current) {
      ambientNodeRef.current.stop();
      ambientNodeRef.current = null;
    }
    if (type === 'none') return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate procedural noise based on type
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'whitenoise') {
          // Pink-ish soft noise
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        } else if (type === 'rain') {
          // Brown noise + sprinkle filter
          lastOut = (lastOut + 0.04 * white) / 1.04;
          data[i] = lastOut * 4.0;
        } else if (type === 'forest') {
          // Gentle low-frequency wind breeze
          lastOut = (lastOut + 0.01 * white) / 1.01;
          data[i] = lastOut * 3.0;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.value = type === 'rain' ? 800 : 400;

      const gain = ctx.createGain();
      gain.gain.value = 0.06; // soft background volume

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();

      ambientNodeRef.current = {
        stop: () => {
          try {
            noise.stop();
            ctx.close();
          } catch {}
        },
      };
    } catch (e) {
      console.warn('Ambient audio error:', e);
    }
  };

  useEffect(() => {
    startAmbient(ambientSound);
    return () => {
      if (ambientNodeRef.current) {
        ambientNodeRef.current.stop();
      }
    };
  }, [ambientSound]);

  // Main timer countdown interval
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setSessionCompleted(true);
            playChime();
            return 0;
          }
          return prev - 1;
        });
        if (sessionType === 'focus') {
          setElapsedFocusSeconds((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, sessionType]);

  if (!isOpen) return null;

  const handleSelectPreset = (minutes: number, type: 'focus' | 'shortBreak' | 'longBreak') => {
    setSessionType(type);
    const secs = minutes * 60;
    setInitialDuration(secs);
    setTimeLeft(secs);
    setIsRunning(false);
    setSessionCompleted(false);
  };

  const handleAddMinutes = (mins: number) => {
    setTimeLeft((prev) => prev + mins * 60);
    setInitialDuration((prev) => prev + mins * 60);
  };

  const handleLogAndExit = async (markComplete: boolean = false) => {
    try {
      setIsLogging(true);
      if (elapsedFocusSeconds > 10) {
        const note = scratchpad.trim()
          ? `Focus session: ${formatSecondsToHuman(elapsedFocusSeconds)} • ${scratchpad.trim()}`
          : `Focus mode session: ${formatSecondsToHuman(elapsedFocusSeconds)}`;
        await onLogTime(task.id, elapsedFocusSeconds, note);
      }
      if (markComplete && onCompleteTask) {
        onCompleteTask(task);
      }
      onClose();
    } catch (err) {
      console.error('Failed to log focus time:', err);
      onClose();
    } finally {
      setIsLogging(false);
    }
  };

  // Format time mm:ss
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = initialDuration > 0 ? ((initialDuration - timeLeft) / initialDuration) * 100 : 0;
  const strokeDashoffset = 440 - (440 * progressPercent) / 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto animate-in fade-in duration-200">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
              Deep Work Focus Mode
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {sessionType === 'focus' ? 'Focus Session' : 'Rest Break'}
              </span>
            </h1>
            <p className="text-xs text-slate-400">Zero distractions • Automatic productivity logging</p>
          </div>
        </div>

        {/* Ambient Sounds & Exit */}
        <div className="flex items-center gap-3">
          {/* Ambient Noise Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 text-xs">
            <button
              onClick={() => setAmbientSound('none')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                ambientSound === 'none' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Silent"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setAmbientSound('whitenoise')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                ambientSound === 'whitenoise' ? 'bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pink Noise
            </button>
            <button
              onClick={() => setAmbientSound('rain')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                ambientSound === 'rain' ? 'bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rain
            </button>
            <button
              onClick={() => setAmbientSound('forest')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                ambientSound === 'forest' ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Forest
            </button>
          </div>

          {/* Close / Exit Button */}
          <button
            onClick={() => handleLogAndExit(false)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Log time and close Focus Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Focus Stage */}
      <div className="max-w-4xl w-full mx-auto my-6 sm:my-10 flex flex-col items-center justify-center flex-1">
        {/* Task Title Focus Card */}
        <div className="w-full max-w-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 mb-8 text-center shadow-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                task.priority === 'urgent'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : task.priority === 'high'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {task.priority !== 'none' ? `${task.priority} priority` : 'Active Task'}
            </span>
            {task.due && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Due {task.due.split('T')[0]}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">{task.title}</h2>
          {task.notes && (
            <p className="text-xs sm:text-sm text-slate-400 mt-2 line-clamp-2 max-w-md mx-auto">
              {task.notes}
            </p>
          )}
        </div>

        {/* Circular Countdown Timer */}
        <div className="relative flex items-center justify-center my-4">
          <svg className="w-64 h-64 sm:w-72 sm:h-72 transform -rotate-90">
            {/* Background ring */}
            <circle
              cx="50%"
              cy="50%"
              r="70"
              className="text-slate-900"
              strokeWidth="10"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Progress ring */}
            <circle
              cx="50%"
              cy="50%"
              r="70"
              className={sessionType === 'focus' ? 'text-orange-500' : 'text-emerald-500'}
              strokeWidth="10"
              strokeDasharray="440"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>

          <div className="absolute flex flex-col items-center">
            <span className="text-5xl sm:text-6xl font-black tracking-tighter text-white font-mono">
              {timeFormatted}
            </span>
            <span className="text-xs uppercase font-bold tracking-widest text-slate-400 mt-1">
              {isRunning ? 'Flowing...' : timeLeft === 0 ? 'Session Complete!' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Primary Timer Controls */}
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-8 py-3.5 rounded-2xl font-bold text-sm sm:text-base flex items-center gap-2.5 shadow-xl transition-all active:scale-95 ${
              isRunning
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" /> Start Focus
              </>
            )}
          </button>

          <button
            onClick={() => {
              setIsRunning(false);
              setTimeLeft(initialDuration);
            }}
            className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Reset timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleAddMinutes(5)}
            className="px-3.5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 5m
          </button>
        </div>

        {/* Session Preset Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button
            onClick={() => handleSelectPreset(25, 'focus')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              sessionType === 'focus' && initialDuration === 25 * 60
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
            }`}
          >
            25m Pomodoro
          </button>
          <button
            onClick={() => handleSelectPreset(50, 'focus')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              sessionType === 'focus' && initialDuration === 50 * 60
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
            }`}
          >
            50m Deep Flow
          </button>
          <button
            onClick={() => handleSelectPreset(5, 'shortBreak')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              sessionType === 'shortBreak'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
            }`}
          >
            5m Short Break
          </button>
          <button
            onClick={() => handleSelectPreset(15, 'longBreak')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              sessionType === 'longBreak'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
            }`}
          >
            15m Long Break
          </button>
        </div>

        {/* Subtasks & Scratchpad Section */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {/* Subtasks in Focus */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Task Action Items ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})</span>
            </h3>

            {task.subtasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No subtasks defined. Stay single-task focused on "{task.title}".
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {task.subtasks.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => onToggleSubtask && onToggleSubtask(task.id, sub.id)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800/80 text-left transition-colors text-xs"
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                    <span className={sub.completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                      {sub.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Scratchpad for Thoughts */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Flow Scratchpad (Saved with time log)
            </h3>
            <textarea
              value={scratchpad}
              onChange={(e) => setScratchpad(e.target.value)}
              placeholder="Dump quick distraction thoughts or notes here without leaving focus..."
              className="w-full flex-1 min-h-[90px] bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
            />
          </div>
        </div>
      </div>

      {/* Bottom Session Summary and Complete Buttons */}
      <div className="max-w-5xl w-full mx-auto border-t border-slate-900 pt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-xs">
            ⏱️
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">
              Session Time Logged: {formatSecondsToHuman(elapsedFocusSeconds)}
            </p>
            <p className="text-[11px] text-slate-500">
              Total lifetime task time: {formatSecondsToHuman(task.totalTimeSpentSeconds + elapsedFocusSeconds)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLogAndExit(false)}
            disabled={isLogging}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
          >
            {isLogging ? 'Logging...' : 'Save Time & Return'}
          </button>

          <button
            onClick={() => handleLogAndExit(true)}
            disabled={isLogging}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            Complete Task & Finish
          </button>
        </div>
      </div>
    </div>
  );
};
