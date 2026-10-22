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
  'https://ais-dev-cqdgfed6gyikh6c55ssym2-756340359649.asia-northeast1.run.app';

/**
 * Resolves the base URL for AI API endpoints:
 * 1. Checks user override stored in localStorage ('gqueues_backend_api_url')
 * 2. Checks build-time environment variables (VITE_BACKEND_URL, VITE_API_URL, VITE_APP_URL)
 * 3. Detects Android APK / Capacitor / Cordova / file / localhost-webview environments and routes to Cloud Run
 * 4. Defaults to relative URL (empty string) for same-origin full-stack deployments
 */
export function getAiApiBaseUrl(): string {
  // 1. Explicit user override in localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('gqueues_backend_api_url');
      if (stored && stored.trim().startsWith('http')) {
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
      // Direct the APK to the hosted cloud backend
      return DEFAULT_HOSTED_BACKEND_URL;
    }
  }

  // 4. Default: relative URL for same-origin server
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
 * 2. If 404 occurs (e.g. static Vercel deployment or APK with missing local server),
 *    automatically falls back to DEFAULT_HOSTED_BACKEND_URL and caches the working URL.
 * 3. Catches network drops and retries with cloud backend fallback.
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
    if (primaryBase !== DEFAULT_HOSTED_BACKEND_URL) {
      console.warn(`[AI API] Network error calling ${primaryUrl}. Falling back to hosted cloud backend...`, netErr);
      res = await fetch(`${DEFAULT_HOSTED_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      throw netErr;
    }
  }

  // If 404 (common on static Vercel hosting where /api routes do not exist, or on APK local WebView)
  if (res.status === 404 && primaryBase !== DEFAULT_HOSTED_BACKEND_URL) {
    console.warn(`[AI API] Endpoint ${primaryUrl} returned 404. Automatically falling back to hosted backend...`);
    const fallbackRes = await fetch(`${DEFAULT_HOSTED_BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!fallbackRes.ok) {
      const data = await fallbackRes.json().catch(() => ({}));
      throw new Error(data.error || `AI request failed (${fallbackRes.status})`);
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('gqueues_backend_api_url', DEFAULT_HOSTED_BACKEND_URL);
      }
    } catch {}

    return fallbackRes.json();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI request failed (${res.status})`);
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

