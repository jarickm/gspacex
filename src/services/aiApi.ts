/**
 * Client service for calling server-side Gemini AI endpoints.
 * All API key credentials remain secure on the server side.
 * Supports adaptive backend routing for AI Studio, Vercel deployments, and Android APKs.
 */

export interface AISubtask {
  id: string;
  title: string;
  completed: boolean;
  timeEstimate?: string;
}

export interface TaskBreakdownResult {
  subtasks: AISubtask[];
  suggestedPriority: 'urgent' | 'high' | 'medium' | 'low';
  suggestedTimeEstimate: string;
  reasoning: string;
}

export interface TaskSuggestions {
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  timeEstimate?: string;
  tags?: string[];
  suggestedNotes?: string;
  tip?: string;
}

export interface DailyBriefingResult {
  headline: string;
  summary: string;
  topPriorities: string[];
  scheduleAnalysis?: string;
  motivationalTip?: string;
}

export interface MeetingPrepResult {
  agenda: string[];
  prepTasks: Array<{ title: string; timeEstimate?: string }>;
  discussionQuestions: string[];
  outcomeGoal: string;
}

export interface NaturalTaskResult {
  title: string;
  dueDate?: string | null;
  priority?: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  timeEstimate?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AIChatResponse {
  reply: string;
  suggestedAction?: {
    type: string;
    task?: {
      title: string;
      due?: string;
      priority?: string;
      timeEstimate?: string;
      notes?: string;
    };
  } | null;
}

// Hosted fallback backend service URL (AI Studio Cloud Run production instance)
export const DEFAULT_HOSTED_BACKEND_URL =
  'https://ais-pre-cqdgfed6gyikh6c55ssym2-756340359649.asia-northeast1.run.app';

// Auto-heal: Purge any invalid/stale backend URLs from localStorage that cause cross-origin Failed to fetch errors
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('gqueues_backend_api_url');
    if (
      stored &&
      (stored.includes('run.app') ||
        stored.includes('localhost:3000') ||
        stored === window.location.origin)
    ) {
      localStorage.removeItem('gqueues_backend_api_url');
    }
  } catch {}
}

/**
 * Resolves the base URL for AI API endpoints:
 * 1. Checks user override stored in localStorage ('gqueues_backend_api_url')
 * 2. Checks build-time environment variables (VITE_BACKEND_URL, VITE_API_URL, VITE_APP_URL)
 * 3. In web browsers (AI Studio, Vercel, Safari, Chrome): always defaults to relative URL ('') for same-origin reliability
 * 4. In Android APKs / Capacitor / Cordova / file / localhost-webview environments: routes to Cloud Run
 */
export function getAiApiBaseUrl(): string {
  // 1. Explicit user override in localStorage (only if different from current origin and not a stale cloud run dev url)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('gqueues_backend_api_url');
      if (
        stored &&
        stored.trim().startsWith('http') &&
        !stored.includes('run.app') &&
        stored.trim() !== window.location.origin
      ) {
        return stored.trim().replace(/\/+$/, '');
      }
    } catch {}
  }

  // 2. Build-time environment variable
  const envUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta as any).env?.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Environment detection: Android APK, Capacitor, Cordova, local file, or standalone WebView
  if (typeof window !== 'undefined') {
    const origin = window.location.origin || '';
    const hostname = window.location.hostname || '';

    const isApkOrStandalone =
      origin.startsWith('file:') ||
      origin.startsWith('capacitor:') ||
      origin.startsWith('ionic:') ||
      origin.startsWith('content:') ||
      (hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '');

    if (isApkOrStandalone) {
      return DEFAULT_HOSTED_BACKEND_URL;
    }
  }

  // 4. Default: relative URL for same-origin server (AI Studio, Vercel, iOS Safari, etc.)
  return '';
}

/**
 * Store custom backend URL in localStorage
 */
export function setCustomBackendUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('gqueues_backend_api_url');
    } else {
      localStorage.setItem('gqueues_backend_api_url', url.trim().replace(/\/+$/, ''));
    }
  }
}

/**
 * Resilient fetcher for AI endpoints:
 * 1. Queries primary base URL (relative for same-origin, or custom/detected)
 * 2. Catches network drops and retries with same-origin or cloud fallback
 */
async function fetchAiApi<T = any>(endpoint: string, payload: any): Promise<T> {
  const primaryBase = getAiApiBaseUrl();
  const primaryUrl = `${primaryBase}${endpoint}`;

  let res: Response;
  try {
    res = await fetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    // If a remote URL failed (e.g. CORS or network drop), retry with relative same-origin if not already tried
    if (primaryBase !== '') {
      console.warn(`[AI API] Failed to fetch from ${primaryUrl}. Falling back to relative ${endpoint}...`, netErr);
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error(
          `Unable to connect to AI server. If on Android APK, please verify your server URL in AI Settings (⚙️).`
        );
      }
    } else {
      throw new Error(
        `Unable to reach AI server. Please check your internet connection or verify the server status.`
      );
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI request failed with HTTP ${res.status}`);
  }

  return res.json();
}

export async function aiBreakdownTask(
  taskTitle: string,
  notes?: string,
  currentSubtasks?: string[]
): Promise<TaskBreakdownResult> {
  return fetchAiApi<TaskBreakdownResult>('/api/ai/breakdown-task', {
    taskTitle,
    notes,
    currentSubtasks,
  });
}

export async function aiSuggestTaskDetails(
  title: string,
  notes?: string,
  dueDate?: string
): Promise<TaskSuggestions> {
  return fetchAiApi<TaskSuggestions>('/api/ai/suggest-details', {
    title,
    notes,
    dueDate,
  });
}

export async function aiGenerateDailyBriefing(
  tasks: any[],
  meetings: any[],
  timeZone = 'Asia/Manila'
): Promise<DailyBriefingResult> {
  return fetchAiApi<DailyBriefingResult>('/api/ai/daily-briefing', {
    tasks,
    meetings,
    timeZone,
  });
}

export async function aiGenerateMeetingPrep(
  summary: string,
  description?: string,
  attendees?: any[],
  location?: string
): Promise<MeetingPrepResult> {
  return fetchAiApi<MeetingPrepResult>('/api/ai/meeting-prep', {
    summary,
    description,
    attendees,
    location,
  });
}

export async function aiParseNaturalTask(
  input: string,
  todayDateStr?: string
): Promise<NaturalTaskResult> {
  return fetchAiApi<NaturalTaskResult>('/api/ai/parse-natural', {
    input,
    todayDateStr,
  });
}

export async function aiChatAssistant(
  message: string,
  history: AIChatMessage[] = [],
  workspaceContext: Record<string, any> = {}
): Promise<AIChatResponse> {
  return fetchAiApi<AIChatResponse>('/api/ai/chat', {
    message,
    history,
    workspaceContext,
  });
}

