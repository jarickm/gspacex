import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Loader2,
  RefreshCw,
  Lightbulb,
  Zap,
  Settings,
  Server,
  Globe,
  Check,
} from 'lucide-react';
import type { GQueueTask, QueueList, CalendarMeeting } from '../types/gqueues';
import {
  aiChatAssistant,
  type AIChatMessage,
  getAiApiBaseUrl,
  setCustomBackendUrl,
  DEFAULT_HOSTED_BACKEND_URL,
} from '../services/aiApi';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: GQueueTask[];
  queues: QueueList[];
  currentQueue?: QueueList | null;
  todayMeetings: CalendarMeeting[];
  onQuickAddTask: (title: string, priority?: string, dueDate?: string) => Promise<void>;
  onAddTaskWithDetails?: (taskData: Partial<GQueueTask>) => Promise<void>;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  tasks,
  queues,
  currentQueue,
  todayMeetings,
  onQuickAddTask,
  onAddTaskWithDetails,
}) => {
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'model';
      text: string;
      suggestedAction?: any;
    }>
  >([
    {
      id: 'welcome-msg',
      role: 'model',
      text: `👋 **Hello! I'm GQueues AI Companion.**\n\nI have real-time visibility into your Google Tasks, Workspace Queues, and Calendar meetings (operating in **Philippine Standard Time / Manila UTC+8**).\n\nHow can I help you be more productive today?`,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(() => {
    try {
      return localStorage.getItem('gqueues_backend_api_url') || '';
    } catch {
      return '';
    }
  });
  const [backendTestStatus, setBackendTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [backendTestMsg, setBackendTestMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleTestBackend = async (urlToTest?: string) => {
    setBackendTestStatus('testing');
    setBackendTestMsg('Connecting to Gemini AI backend...');
    try {
      const explicit = urlToTest !== undefined ? urlToTest : customUrlInput;
      const base = (explicit.trim() || getAiApiBaseUrl() || DEFAULT_HOSTED_BACKEND_URL).replace(/\/+$/, '');
      const testUrl = base ? `${base}/api/health` : '/api/health';
      const res = await fetch(testUrl);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.hasApiKey === false) {
          setBackendTestStatus('error');
          setBackendTestMsg(
            'Server reached, but GEMINI_API_KEY is not set. In Vercel, please add GEMINI_API_KEY under Project Settings > Environment Variables.'
          );
        } else {
          setBackendTestStatus('ok');
          setBackendTestMsg(`Connected! Gemini AI engine is online (Platform: ${data.platform || 'cloud'}).`);
        }
      } else {
        setBackendTestStatus('error');
        setBackendTestMsg(`Server returned HTTP ${res.status}. Please check your URL configuration.`);
      }
    } catch (err: any) {
      setBackendTestStatus('error');
      setBackendTestMsg(`Cannot connect: ${err.message || 'Network error'}. Check URL or CORS.`);
    }
  };

  const handleSaveBackendUrl = () => {
    setCustomBackendUrl(customUrlInput.trim());
    handleTestBackend(customUrlInput.trim());
  };

  const handleResetBackendUrl = () => {
    setCustomUrlInput('');
    setCustomBackendUrl('');
    handleTestBackend('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Prepare workspace context summary for AI
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const urgentTasks = activeTasks
    .filter((t) => t.priority === 'urgent' || t.priority === 'high')
    .map((t) => t.title);
  const blockedTasks = activeTasks
    .filter((t) => t.dependsOn && t.dependsOn.length > 0)
    .map((t) => t.title);
  const dueSoonTasks = activeTasks.filter((t) => !!t.due).map((t) => `${t.title} (Due: ${t.due})`);
  const meetingSummaries = todayMeetings.map(
    (m) => `${m.summary} at ${m.start?.dateTime ? m.start.dateTime.split('T')[1]?.slice(0, 5) : 'All Day'}`
  );

  const workspaceContext = {
    activeQueueTitle: currentQueue?.title || 'All Queues',
    totalTasksCount: activeTasks.length,
    urgentTasks: urgentTasks.slice(0, 5),
    dueSoonTasks: dueSoonTasks.slice(0, 5),
    blockedTasks: blockedTasks.slice(0, 5),
    todayMeetings: meetingSummaries.slice(0, 5),
  };

  const handleSendMessage = async (textToSend?: string) => {
    const userText = (textToSend || input).trim();
    if (!userText || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const newMessages = [
      ...messages,
      { id: userMessageId, role: 'user' as const, text: userText },
    ];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Prior conversation history (excluding initial greeting and the newly added message)
      const history: AIChatMessage[] = messages.slice(1).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await aiChatAssistant(userText, history, workspaceContext);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'model',
          text: res.reply,
          suggestedAction: res.suggestedAction,
        },
      ]);
    } catch (err: any) {
      console.error('Failed to get AI response:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'model',
          text: `⚠️ **AI Engine Error:** ${err.message || 'I encountered an issue connecting to the Gemini AI engine. Please verify your connection or try again.'}\n\n*Tip: Click the ⚙️ settings icon in the top header to test your server connection or configure your custom backend URL.*`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: any) => {
    if (!action || action.type !== 'create_task' || !action.task) return;
    const { title, priority, due, notes, timeEstimate } = action.task;

    if (onAddTaskWithDetails) {
      await onAddTaskWithDetails({
        title,
        priority: priority || 'medium',
        due: due || undefined,
        notes: notes || undefined,
        timeEstimate: timeEstimate || undefined,
      });
    } else {
      await onQuickAddTask(title, priority, due);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `action-done-${Date.now()}`,
        role: 'model',
        text: `✅ **Created task:** "${title}"${due ? ` due on ${due}` : ''}${priority ? ` (${priority.toUpperCase()})` : ''} has been added to your queue and synced with Google Tasks!`,
      },
    ]);
  };

  const quickPrompts = [
    { label: '🎯 Prioritize my day', prompt: 'Analyze my tasks and today meetings. What are the top 3 highest priority things I should focus on right now?' },
    { label: '📅 Prep for today meetings', prompt: 'Look at my meetings today. What preparation or tasks should I do before attending them?' },
    { label: '⚡ Check blocked tasks', prompt: 'Do I have any blocked tasks or dependencies that need attention?' },
    { label: '➕ Plan next week', prompt: 'Suggest a smart schedule for my upcoming tasks for next week based on urgency.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] max-h-[720px] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">GQueues AI Companion</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-blue-100/80">
                Connected to Google Tasks, Calendar & Workspaces (Manila PHT)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setShowSettings((prev) => !prev);
                if (!showSettings && backendTestStatus === 'idle') {
                  handleTestBackend();
                }
              }}
              className={`p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer ${
                showSettings ? 'bg-white/20 text-white' : ''
              }`}
              title="Cloud Backend Settings (APK / Vercel / iOS)"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cloud Backend Configuration Drawer (Vercel / APK / iOS) */}
        {showSettings && (
          <div className="p-3.5 bg-slate-900 text-slate-100 border-b border-slate-700 text-xs space-y-2.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-blue-300">
                <Server className="w-4 h-4 text-blue-400" />
                AI Companion Cloud Backend Settings
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {getAiApiBaseUrl() ? 'Custom URL' : 'Auto-Detected'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong>Vercel:</strong> Uses your deployment's serverless functions. Ensure <code>GEMINI_API_KEY</code> is added to Vercel Project Settings &gt; Environment Variables.
              <br />
              <strong>Android APK & iOS:</strong> Enter your live Vercel URL below if you want the app to connect to your personal deployment.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://your-app.vercel.app (or leave empty for auto)"
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveBackendUrl}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Test</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetBackendUrl}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer"
                  title="Reset to default cloud server"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {backendTestStatus !== 'idle' && (
              <div
                className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                  backendTestStatus === 'ok'
                    ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-800'
                    : backendTestStatus === 'testing'
                    ? 'bg-blue-950/80 text-blue-200 border border-blue-800'
                    : 'bg-rose-950/80 text-rose-200 border border-rose-800'
                }`}
              >
                {backendTestStatus === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : backendTestStatus === 'testing' ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span className="text-[11px] leading-tight">{backendTestMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Quick Context Strip */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 overflow-x-auto">
          <div className="flex items-center gap-4 flex-nowrap">
            <span className="flex items-center gap-1 font-medium">
              <ListTodo className="w-3.5 h-3.5 text-blue-600" />
              <strong>{activeTasks.length}</strong> active tasks
            </span>
            <span className="flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <strong>{todayMeetings.length}</strong> meetings today
            </span>
            {urgentTasks.length > 0 && (
              <span className="flex items-center gap-1 font-medium text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <strong>{urgentTasks.length}</strong> high priority
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">🇵🇭 Manila UTC+8</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed text-xs sm:text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white shadow-xs rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs rounded-tl-none'
                }`}
              >
                {/* Render formatting simply */}
                <div className="whitespace-pre-wrap space-y-1">
                  {msg.text.split('\n').map((line, i) => {
                    if (line.startsWith('### ')) {
                      return <h4 key={i} className="font-bold text-sm text-slate-900 mt-2 mb-1">{line.slice(4)}</h4>;
                    }
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <strong key={i} className="font-bold block text-slate-900 mt-1">{line.slice(2, -2)}</strong>;
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <div key={i} className="flex items-start gap-1.5 ml-1 my-0.5">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{line.slice(2)}</span>
                        </div>
                      );
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>

                {/* Suggested Action Card (e.g. Create Task) */}
                {msg.suggestedAction && msg.suggestedAction.task && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-2 text-slate-900">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-900 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Suggested Task
                      </span>
                      {msg.suggestedAction.task.priority && (
                        <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-bold uppercase text-[10px]">
                          {msg.suggestedAction.task.priority}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-xs sm:text-sm text-slate-900">
                      {msg.suggestedAction.task.title}
                    </p>
                    {msg.suggestedAction.task.due && (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Due: {msg.suggestedAction.task.due}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction(msg.suggestedAction)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to GQueues Now
                    </button>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>GQueues AI is analyzing your workspace...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Row */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(qp.prompt)}
              className="py-1.5 px-3 rounded-full text-xs font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 flex-shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask GQueues AI about your tasks, schedule, or request advice..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
