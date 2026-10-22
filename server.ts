import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Enable CORS for mobile APKs, Capacitor, and external Vercel deployments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Normalize incoming request URLs in case Vercel or proxy strips the /api prefix
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && (req.url.startsWith('/ai') || req.url.startsWith('/health'))) {
    req.url = '/api' + req.url;
  }
  next();
});

// Helper to get fresh Google GenAI SDK client (Server-Side Only per security rules)
function getAiClient(): GoogleGenAI {
  const currentKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  return new GoogleGenAI({
    apiKey: currentKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient JSON parser that handles code blocks, conversational preambles, and malformed strings
function parseJsonSafely<T = any>(rawText: string, fallback?: T): T {
  if (!rawText || !rawText.trim()) {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty response received from AI model');
  }

  const clean = rawText.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(clean);
  } catch {}

  // 2. Strip code fences: ```json ... ``` or ``` ... ```
  const stripped = clean
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {}

  // 3. Extract substring between first { and last }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  // 4. Extract substring between first [ and last ]
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(clean.slice(firstBracket, lastBracket + 1));
    } catch {}
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Failed to parse AI output as JSON: ${clean.slice(0, 150)}...`);
}

interface GeminiCallOptions {
  systemInstruction?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  temperature?: number;
}

// Helper to call Gemini with resilient fallback and low-latency thinking levels
async function callGemini(prompt: string, options: GeminiCallOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please verify your API key in Settings > Secrets.'
    );
  }

  const ai = getAiClient();
  // Models to try in order of capability, latency, and resilience
  const modelsToTry = [
    { name: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
    { name: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { name: 'gemini-flash-latest', thinkingLevel: undefined },
  ];

  let lastError: any = null;

  for (const modelConfig of modelsToTry) {
    try {
      const config: any = {
        temperature: options.temperature ?? 0.2,
      };

      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }

      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }

      if (modelConfig.thinkingLevel !== undefined) {
        config.thinkingConfig = { thinkingLevel: modelConfig.thinkingLevel };
      }

      const response = await ai.models.generateContent({
        model: modelConfig.name,
        contents: prompt,
        config,
      });

      if (response && typeof response.text === 'string' && response.text.trim()) {
        return response.text.trim();
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API] Model ${modelConfig.name} encountered error:`, err?.message || err);
    }
  }

  throw lastError || new Error('All Gemini models failed to respond. Please try again.');
}

// -------------------------------------------------------------
// AI API Endpoints for GQueues Workspace Manager
// -------------------------------------------------------------

// Health & Diagnostics check
app.get('/api/health', (req, res) => {
  const currentKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  res.json({
    status: 'ok',
    hasApiKey: !!currentKey,
    keyPreview: currentKey ? `${currentKey.slice(0, 4)}...${currentKey.slice(-4)}` : null,
    model: 'gemini-3.8-flash',
    timestamp: new Date().toISOString(),
  });
});

// Quick live diagnostic ping
app.get('/api/ai/test', async (req, res) => {
  try {
    const text = await callGemini('Say "AI is operational" in 5 words or less.', {
      temperature: 0.1,
    });
    res.json({ success: true, message: text });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'AI test failed' });
  }
});

// 1. Task Breakdown into Subtasks
app.post('/api/ai/breakdown-task', async (req, res) => {
  try {
    const { taskTitle, notes, currentSubtasks } = req.body;
    if (!taskTitle) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const prompt = `You are an expert project manager and productivity coach for GQueues Workspace.
Break down this task into 3 to 6 logical, actionable, sequential subtasks.
Each subtask must be clear, concise, and start with an action verb.

Task Title: "${taskTitle}"
Existing Notes: "${notes || 'None'}"
Existing Subtasks: ${JSON.stringify(currentSubtasks || [])}

Respond with JSON in this exact structure:
{
  "subtasks": [
    { "title": "Specific action step", "timeEstimate": "15m" }
  ],
  "suggestedPriority": "urgent" | "high" | "medium" | "low",
  "suggestedTimeEstimate": "1h 30m",
  "reasoning": "Brief 1-sentence explanation"
}`;

    const text = await callGemini(prompt, {
      systemInstruction:
        'You are an expert project management JSON response engine. Return only a valid JSON object matching the requested schema.',
      responseMimeType: 'application/json',
      temperature: 0.2,
    });

    const parsed = parseJsonSafely(text, {
      subtasks: [
        { title: `Prepare and plan for: ${taskTitle}`, timeEstimate: '15m' },
        { title: `Execute core tasks for: ${taskTitle}`, timeEstimate: '45m' },
        { title: `Review and verify: ${taskTitle}`, timeEstimate: '15m' },
      ],
      suggestedPriority: 'medium',
      suggestedTimeEstimate: '1h 15m',
      reasoning: 'Generated standard project workflow',
    });

    // Format subtasks with unique IDs
    const formattedSubtasks = (parsed.subtasks || []).map((s: any, idx: number) => ({
      id: `subtask-ai-${Date.now()}-${idx}`,
      title: s.title || (typeof s === 'string' ? s : 'Action item'),
      completed: false,
      timeEstimate: s.timeEstimate || undefined,
    }));

    res.json({
      subtasks: formattedSubtasks,
      suggestedPriority: parsed.suggestedPriority || 'medium',
      suggestedTimeEstimate: parsed.suggestedTimeEstimate || '30m',
      reasoning: parsed.reasoning || 'Automated task breakdown based on best practices',
    });
  } catch (error: any) {
    console.error('Error in /api/ai/breakdown-task:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate task breakdown',
    });
  }
});

// 2. Task Details Enhancer (Suggest Priority, Time, Tags, Notes)
app.post('/api/ai/suggest-details', async (req, res) => {
  try {
    const { title, notes, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const prompt = `Analyze this task for a professional Google Workspace user:
Title: "${title}"
Notes: "${notes || ''}"
Due Date: "${dueDate || 'Unscheduled'}"

Recommend:
1. Priority: "urgent" (critical/deadlines), "high", "medium", or "low"
2. Realistic Time Estimate: e.g. "30m", "1h", "2h 30m"
3. Recommended Tags: 2-4 clean short tags (e.g. ["Procurement", "Review", "FollowUp"])
4. Clean Refined Description / Notes: helpful checklist or structured notes if appropriate
5. One quick productivity tip for completing it efficiently.

Return JSON with keys: "priority", "timeEstimate", "tags", "suggestedNotes", "tip".`;

    const text = await callGemini(prompt, {
      systemInstruction:
        'You are a productivity specialist. Return only valid JSON with keys: priority, timeEstimate, tags, suggestedNotes, tip.',
      responseMimeType: 'application/json',
      temperature: 0.2,
    });

    const parsed = parseJsonSafely(text, {
      priority: 'medium',
      timeEstimate: '45m',
      tags: ['Work'],
      suggestedNotes: notes || '',
      tip: 'Break large work into focused intervals.',
    });

    res.json({
      priority: parsed.priority || 'medium',
      timeEstimate: parsed.timeEstimate || '45m',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      suggestedNotes: parsed.suggestedNotes || '',
      tip: parsed.tip || 'Tackle the hardest component first.',
    });
  } catch (error: any) {
    console.error('Error in /api/ai/suggest-details:', error);
    res.status(500).json({
      error: error?.message || 'Failed to suggest task details',
    });
  }
});

// 3. AI Executive Daily Briefing
app.post('/api/ai/daily-briefing', async (req, res) => {
  try {
    const { tasks = [], meetings = [], timeZone = 'Asia/Manila' } = req.body;

    const prompt = `Generate a motivating, high-impact Daily Executive Briefing for a user operating in ${timeZone} (Philippine Standard Time, UTC+8).

Today's Scheduled Meetings (${meetings.length}):
${JSON.stringify(meetings.slice(0, 8))}

Pending / Due Tasks (${tasks.length}):
${JSON.stringify(
  tasks.slice(0, 15).map((t: any) => ({
    title: t.title,
    priority: t.priority,
    due: t.due,
    timeEstimate: t.timeEstimate,
    status: t.status,
    isBlocked: !!(t.dependsOn && t.dependsOn.length > 0),
  }))
)}

Generate an executive briefing with:
1. headline: Catchy 1-line summary
2. summary: 2-3 sentence executive overview of the day
3. topPriorities: Array of the top 3-4 specific things to accomplish first
4. scheduleAnalysis: Any meeting overlaps, tight transitions, or protected focus blocks
5. motivationalTip: A sharp, professional productivity tip

Return JSON with keys: "headline", "summary", "topPriorities", "scheduleAnalysis", "motivationalTip".`;

    const text = await callGemini(prompt, {
      systemInstruction:
        'You are an executive chief of staff. Output only a valid JSON object matching the requested schema.',
      responseMimeType: 'application/json',
      temperature: 0.3,
    });

    const parsed = parseJsonSafely(text, {
      headline: 'Focused execution day for your workspace',
      summary: 'You have active tasks ready for progress today. Focus on urgent priorities first.',
      topPriorities: ['Review high priority tasks', 'Check calendar schedule'],
      scheduleAnalysis: 'Plan focused blocks between key activities.',
      motivationalTip: 'Start with your highest-impact task first.',
    });

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/daily-briefing:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate daily briefing',
    });
  }
});

// 4. Meeting Preparation & Action Items
app.post('/api/ai/meeting-prep', async (req, res) => {
  try {
    const { summary, description, attendees, location } = req.body;
    if (!summary) {
      return res.status(400).json({ error: 'Meeting summary is required' });
    }

    const prompt = `You are an executive assistant preparing a briefing for this Google Workspace meeting:
Title: "${summary}"
Description: "${description || 'None'}"
Location / Link: "${location || 'Google Meet'}"
Attendees: ${JSON.stringify(attendees || [])}

Generate:
1. agenda: 3-5 structured agenda bullet points
2. prepTasks: 2-4 preparation tasks that should be done BEFORE the meeting (with time estimates like "10m", "20m")
3. discussionQuestions: 3 thought-provoking questions to ask during the meeting
4. outcomeGoal: 1 clear sentence describing what a successful meeting outcome looks like.

Return JSON with keys: "agenda", "prepTasks", "discussionQuestions", "outcomeGoal".`;

    const text = await callGemini(prompt, {
      systemInstruction:
        'You are an executive assistant. Return only valid JSON matching the requested keys.',
      responseMimeType: 'application/json',
      temperature: 0.2,
    });

    const parsed = parseJsonSafely(text, {
      agenda: ['Review objectives', 'Discuss key updates', 'Determine next steps'],
      prepTasks: [{ title: 'Review relevant notes and docs', timeEstimate: '10m' }],
      discussionQuestions: [
        'What are the key roadblocks?',
        'What decisions need to be made today?',
      ],
      outcomeGoal: 'Clear alignment on action items and owners.',
    });

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/meeting-prep:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate meeting preparation',
    });
  }
});

// 5. Natural Language Smart Add Parser
app.post('/api/ai/parse-natural', async (req, res) => {
  try {
    const { input, todayDateStr = new Date().toISOString().split('T')[0] } = req.body;
    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const prompt = `Today is ${todayDateStr}.
Parse the following natural language task into structured GQueues fields:
Input: "${input}"

Examples:
- "Submit payroll audit by Friday 4pm urgent #finance" -> title: "Submit payroll audit", dueDate: "[Friday YYYY-MM-DD]", priority: "urgent", tags: ["finance"], timeEstimate: "1h"
- "Review CoolAire HVAC specs next Tuesday" -> title: "Review CoolAire HVAC specs", dueDate: "[Tuesday YYYY-MM-DD]", priority: "medium", tags: []

Return JSON with keys:
"title" (clean task title without date or tags), "dueDate" (YYYY-MM-DD or null), "priority" ("urgent"|"high"|"medium"|"low"|"none"), "timeEstimate" (string or null), "tags" (string array), "notes" (string or null).`;

    const text = await callGemini(prompt, {
      systemInstruction:
        'You are a natural language task parser. Return only valid JSON with the requested keys.',
      responseMimeType: 'application/json',
      temperature: 0.1,
    });

    const parsed = parseJsonSafely(text, {
      title: input.trim(),
      dueDate: null,
      priority: 'none',
      timeEstimate: null,
      tags: [],
      notes: null,
    });

    res.json({
      title: parsed.title || input.trim(),
      dueDate: parsed.dueDate || null,
      priority: parsed.priority || 'none',
      timeEstimate: parsed.timeEstimate || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      notes: parsed.notes || null,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/parse-natural:', error);
    res.status(500).json({
      error: error?.message || 'Failed to parse natural language task',
    });
  }
});

// 6. GQueues AI Companion Chat Assistant
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [], workspaceContext = {} } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `You are GQueues AI Companion, an intelligent executive assistant integrated directly into GQueues Workspace Manager.
You have real-time visibility into the user's tasks, queues, and Google Calendar meetings (operating in Philippine Standard Time / Manila UTC+8).
Be concise, proactive, actionable, and professional. Use clean markdown formatting with bullet points.

Current Workspace Context:
- Active Queue: ${workspaceContext.activeQueueTitle || 'All Queues'}
- Total Active Tasks: ${workspaceContext.totalTasksCount ?? 'Unknown'}
- Urgent Tasks: ${JSON.stringify(workspaceContext.urgentTasks || [])}
- Due Today / Tomorrow: ${JSON.stringify(workspaceContext.dueSoonTasks || [])}
- Blocked Tasks: ${JSON.stringify(workspaceContext.blockedTasks || [])}
- Today's Meetings: ${JSON.stringify(workspaceContext.todayMeetings || [])}

If the user asks to create, schedule, or add a task, format a suggestedAction in your JSON response so the app can offer a 1-click button to create it!

Respond with JSON in this format:
{
  "reply": "Your markdown formatted conversational response with bullet points and clear recommendations",
  "suggestedAction": null | {
    "type": "create_task",
    "task": {
      "title": "Task title",
      "due": "YYYY-MM-DD",
      "priority": "high",
      "timeEstimate": "45m",
      "notes": "Optional notes"
    }
  }
}`;

    // Filter and format conversation history
    const historyText =
      Array.isArray(history) && history.length > 0
        ? history.map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n\n')
        : 'None';

    const prompt = `Conversation history:
${historyText}

User's new message: "${message}"

Respond with JSON containing "reply" and "suggestedAction".`;

    const text = await callGemini(prompt, {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      temperature: 0.3,
    });

    let reply = '';
    let suggestedAction = null;

    try {
      const parsed = parseJsonSafely(text);
      reply = parsed.reply || text;
      suggestedAction = parsed.suggestedAction || null;
    } catch {
      // If parsing fails for any reason, gracefully fallback to raw text as the conversational reply
      reply = text;
      suggestedAction = null;
    }

    res.json({
      reply,
      suggestedAction,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    res.status(500).json({
      error: error?.message || 'Failed to process AI chat message',
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GQueues Full-Stack Server running at http://0.0.0.0:${PORT}`);
  });
}

// Only start the HTTP listener if not running in a serverless environment (e.g. Vercel)
if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  });
}

export default app;
export { app };
