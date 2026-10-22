import type {
  GQueueTask,
  GQueueTaskMetadata,
  QueueList,
  KanbanStatus,
  RecurringSchedule,
  TimeLogEntry,
} from '../types/gqueues';
import { notifySessionExpired } from './firebase';

const META_SEPARATOR = '\n\n--- [gqueues-meta] ---\n';

export function serializeNotes(cleanNotes: string, meta: GQueueTaskMetadata): string {
  const hasMeta =
    (meta.priority && meta.priority !== 'none') ||
    (meta.tags && meta.tags.length > 0) ||
    meta.starred ||
    (meta.subtasks && meta.subtasks.length > 0) ||
    meta.assignedContact ||
    (meta.driveAttachments && meta.driveAttachments.length > 0) ||
    meta.calendarEventId ||
    meta.timeEstimate ||
    (meta.kanbanStatus && meta.kanbanStatus !== 'todo') ||
    (meta.recurring && meta.recurring !== 'none') ||
    meta.recurrenceRule ||
    meta.reminder ||
    meta.completedAt ||
    (meta.timeLogs && meta.timeLogs.length > 0) ||
    (meta.totalTimeSpentSeconds && meta.totalTimeSpentSeconds > 0) ||
    (meta.dependsOn && meta.dependsOn.length > 0);

  const trimmedNotes = (cleanNotes || '').trim();
  if (!hasMeta) {
    return trimmedNotes;
  }

  const metaJson = JSON.stringify(meta);
  return trimmedNotes ? `${trimmedNotes}${META_SEPARATOR}${metaJson}` : `${META_SEPARATOR}${metaJson}`;
}

export function deserializeNotes(rawNotes?: string): { cleanNotes: string; meta: GQueueTaskMetadata } {
  if (!rawNotes) {
    return { cleanNotes: '', meta: {} };
  }

  const separatorIndex = rawNotes.indexOf(META_SEPARATOR);
  if (separatorIndex === -1) {
    return { cleanNotes: rawNotes, meta: {} };
  }

  const cleanNotes = rawNotes.substring(0, separatorIndex).trim();
  const jsonStr = rawNotes.substring(separatorIndex + META_SEPARATOR.length).trim();

  try {
    const meta = JSON.parse(jsonStr) as GQueueTaskMetadata;
    return { cleanNotes, meta };
  } catch {
    return { cleanNotes: rawNotes, meta: {} };
  }
}

export function buildRRuleString(schedule: RecurringSchedule): string | undefined {
  switch (schedule) {
    case 'daily':
      return 'RRULE:FREQ=DAILY;INTERVAL=1';
    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY;INTERVAL=1';
    case 'biweekly':
      return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY;INTERVAL=1';
    case 'yearly':
      return 'RRULE:FREQ=YEARLY;INTERVAL=1';
    default:
      return undefined;
  }
}

export function parseRRuleToSchedule(rrule?: string): RecurringSchedule {
  if (!rrule) return 'none';
  const upper = rrule.toUpperCase();
  if (upper.includes('FREQ=DAILY')) return 'daily';
  if (upper.includes('BYDAY=MO,TU,WE,TH,FR')) return 'weekdays';
  if (upper.includes('FREQ=WEEKLY')) {
    if (upper.includes('INTERVAL=2')) return 'biweekly';
    return 'weekly';
  }
  if (upper.includes('FREQ=MONTHLY')) return 'monthly';
  if (upper.includes('FREQ=YEARLY')) return 'yearly';
  return 'none';
}

/**
 * Calculates the next due date based on the repetition rule
 */
export function computeNextRecurringDueDate(
  currentDue?: string,
  recurring: RecurringSchedule = 'none',
  rrule?: string
): string {
  const baseDate = currentDue ? new Date(currentDue) : new Date();
  if (isNaN(baseDate.getTime())) {
    baseDate.setTime(Date.now());
  }

  const next = new Date(baseDate);

  const effectiveSchedule = recurring !== 'none' ? recurring : parseRRuleToSchedule(rrule);

  switch (effectiveSchedule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekdays': {
      next.setDate(next.getDate() + 1);
      const day = next.getDay();
      if (day === 6) next.setDate(next.getDate() + 2); // Saturday -> Monday
      else if (day === 0) next.setDate(next.getDate() + 1); // Sunday -> Monday
      break;
    }
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next.toISOString().split('T')[0];
}

export function formatSecondsToHuman(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  if (mins > 0) {
    return secs > 0 && mins < 5 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${secs}s`;
}

interface RawGoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

interface RawGoogleTask {
  id: string;
  title?: string;
  updated: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
  deleted?: boolean;
  hidden?: boolean;
  recurrence?: string[];
}

// Color palette for queues like GQueues
const QUEUE_COLORS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#dc2626', // Red
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#4f46e5', // Indigo
];

function getQueueColor(title: string, index: number): string {
  return QUEUE_COLORS[index % QUEUE_COLORS.length];
}

export function parseQueueTitle(rawTitle: string): { category: string; title: string } {
  const bracketMatch = rawTitle.match(/^\[(.*?)\]\s*(.*)$/);
  if (bracketMatch) {
    return { category: bracketMatch[1].trim(), title: bracketMatch[2].trim() };
  }

  const slashMatch = rawTitle.match(/^(.*?)\s*\/\s*(.*)$/);
  if (slashMatch && slashMatch[1] && slashMatch[2]) {
    return { category: slashMatch[1].trim(), title: slashMatch[2].trim() };
  }

  return { category: 'My Queues', title: rawTitle };
}

export function formatQueueTitle(category: string, title: string): string {
  if (!category || category === 'My Queues' || category === 'General') {
    return title;
  }
  return `[${category}] ${title}`;
}

export async function fetchTaskLists(accessToken: string): Promise<QueueList[]> {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      notifySessionExpired();
    }
    const errorBody = await res.text();
    throw new Error(`Failed to fetch task lists (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const items: RawGoogleTaskList[] = data.items || [];

  return items.map((item, idx) => {
    const parsed = parseQueueTitle(item.title);
    return {
      id: item.id,
      title: parsed.title,
      category: parsed.category,
      updated: item.updated,
      color: getQueueColor(item.title, idx),
    };
  });
}

export async function createTaskList(
  accessToken: string,
  title: string,
  category: string
): Promise<QueueList> {
  const formattedTitle = formatQueueTitle(category, title);
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: formattedTitle }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create queue (${res.status}): ${error}`);
  }

  const item: RawGoogleTaskList = await res.json();
  const parsed = parseQueueTitle(item.title);
  return {
    id: item.id,
    title: parsed.title,
    category: parsed.category,
    updated: item.updated,
    color: getQueueColor(item.title, 0),
  };
}

export async function updateTaskList(
  accessToken: string,
  listId: string,
  title: string,
  category: string
): Promise<QueueList> {
  const formattedTitle = formatQueueTitle(category, title);
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: formattedTitle }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update queue (${res.status}): ${error}`);
  }

  const item: RawGoogleTaskList = await res.json();
  const parsed = parseQueueTitle(item.title);
  return {
    id: item.id,
    title: parsed.title,
    category: parsed.category,
    updated: item.updated,
    color: getQueueColor(item.title, 0),
  };
}

export async function deleteTaskList(accessToken: string, listId: string): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Failed to delete queue (${res.status}): ${error}`);
  }
}

export async function fetchTasks(accessToken: string, listId: string): Promise<GQueueTask[]> {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      notifySessionExpired();
    }
    const error = await res.text();
    throw new Error(`Failed to fetch tasks for list ${listId} (${res.status}): ${error}`);
  }

  const data = await res.json();
  const items: RawGoogleTask[] = data.items || [];

  return items
    .filter((t) => !t.deleted)
    .map((item) => {
      const { cleanNotes, meta } = deserializeNotes(item.notes);
      const isDone = item.status === 'completed';
      const kanbanStatus: KanbanStatus = meta.kanbanStatus || (isDone ? 'done' : 'todo');

      const recurringSchedule =
        meta.recurring ||
        (item.recurrence && item.recurrence.length > 0
          ? parseRRuleToSchedule(item.recurrence[0])
          : 'none');

      const recurrenceRule =
        meta.recurrenceRule ||
        (item.recurrence && item.recurrence.length > 0 ? item.recurrence[0] : undefined);

      const timeLogs: TimeLogEntry[] = meta.timeLogs || [];
      const totalTimeSpentSeconds =
        meta.totalTimeSpentSeconds ||
        timeLogs.reduce((acc, log) => acc + (log.seconds || 0), 0);

      return {
        id: item.id,
        listId,
        title: item.title || '(No title)',
        notes: cleanNotes,
        rawNotes: item.notes,
        status: item.status,
        due: item.due,
        completed: item.completed,
        updated: item.updated,
        parent: item.parent,
        position: item.position,
        priority: meta.priority || 'none',
        tags: meta.tags || [],
        starred: !!meta.starred,
        subtasks: meta.subtasks || [],
        assignedContact: meta.assignedContact,
        driveAttachments: meta.driveAttachments || [],
        calendarEventId: meta.calendarEventId,
        timeEstimate: meta.timeEstimate,
        kanbanStatus,
        recurring: recurringSchedule,
        recurrenceRule: recurrenceRule || buildRRuleString(recurringSchedule),
        reminder: meta.reminder,
        completedAt: meta.completedAt || (isDone ? item.completed || item.updated : undefined),
        createdAt: meta.createdAt || item.updated,
        timeLogs,
        totalTimeSpentSeconds,
        dependsOn: meta.dependsOn || [],
      };
    });
}

export async function createTask(
  accessToken: string,
  listId: string,
  data: Partial<GQueueTask>
): Promise<GQueueTask> {
  const nowIso = new Date().toISOString();
  const recurrenceRule = data.recurrenceRule || (data.recurring ? buildRRuleString(data.recurring) : undefined);

  const meta: GQueueTaskMetadata = {
    priority: data.priority || 'none',
    tags: data.tags || [],
    starred: !!data.starred,
    subtasks: data.subtasks || [],
    assignedContact: data.assignedContact,
    driveAttachments: data.driveAttachments || [],
    calendarEventId: data.calendarEventId,
    timeEstimate: data.timeEstimate,
    kanbanStatus: data.kanbanStatus || 'todo',
    recurring: data.recurring || 'none',
    recurrenceRule,
    reminder: data.reminder,
    completedAt: data.completedAt,
    createdAt: data.createdAt || nowIso,
    timeLogs: data.timeLogs || [],
    totalTimeSpentSeconds: data.totalTimeSpentSeconds || 0,
    dependsOn: data.dependsOn || [],
  };

  const payload: Record<string, unknown> = {
    title: data.title || 'New Task',
    notes: serializeNotes(data.notes || '', meta),
    status: data.status || 'needsAction',
  };

  if (data.due) {
    payload.due = data.due.includes('T') ? data.due : `${data.due}T00:00:00.000Z`;
  }

  // Google Tasks API recurrence field
  if (recurrenceRule) {
    payload.recurrence = [recurrenceRule];
  }

  let res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // If Google Tasks rejects the recurrence property, retry without it (metadata remains safely preserved in notes)
  if (!res.ok && payload.recurrence) {
    delete payload.recurrence;
    res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create task (${res.status}): ${error}`);
  }

  const item: RawGoogleTask = await res.json();
  const { cleanNotes, meta: parsedMeta } = deserializeNotes(item.notes);

  return {
    id: item.id,
    listId,
    title: item.title || 'New Task',
    notes: cleanNotes,
    rawNotes: item.notes,
    status: item.status,
    due: item.due,
    completed: item.completed,
    updated: item.updated,
    parent: item.parent,
    position: item.position,
    priority: parsedMeta.priority || 'none',
    tags: parsedMeta.tags || [],
    starred: !!parsedMeta.starred,
    subtasks: parsedMeta.subtasks || [],
    assignedContact: parsedMeta.assignedContact,
    driveAttachments: parsedMeta.driveAttachments || [],
    calendarEventId: parsedMeta.calendarEventId,
    timeEstimate: parsedMeta.timeEstimate,
    kanbanStatus: parsedMeta.kanbanStatus || 'todo',
    recurring: parsedMeta.recurring || 'none',
    recurrenceRule: parsedMeta.recurrenceRule || recurrenceRule,
    reminder: parsedMeta.reminder,
    completedAt: parsedMeta.completedAt,
    createdAt: parsedMeta.createdAt || nowIso,
    timeLogs: parsedMeta.timeLogs || [],
    totalTimeSpentSeconds: parsedMeta.totalTimeSpentSeconds || 0,
    dependsOn: parsedMeta.dependsOn || [],
  };
}

export async function updateTask(
  accessToken: string,
  listId: string,
  taskId: string,
  data: Partial<GQueueTask>
): Promise<GQueueTask> {
  const recurrenceRule =
    data.recurrenceRule !== undefined
      ? data.recurrenceRule
      : data.recurring
      ? buildRRuleString(data.recurring)
      : undefined;

  const meta: GQueueTaskMetadata = {
    priority: data.priority || 'none',
    tags: data.tags || [],
    starred: !!data.starred,
    subtasks: data.subtasks || [],
    assignedContact: data.assignedContact,
    driveAttachments: data.driveAttachments || [],
    calendarEventId: data.calendarEventId,
    timeEstimate: data.timeEstimate,
    kanbanStatus: data.kanbanStatus || (data.status === 'completed' ? 'done' : 'todo'),
    recurring: data.recurring || 'none',
    recurrenceRule,
    reminder: data.reminder,
    completedAt: data.completedAt,
    createdAt: data.createdAt,
    timeLogs: data.timeLogs || [],
    totalTimeSpentSeconds: data.totalTimeSpentSeconds || 0,
    dependsOn: data.dependsOn || [],
  };

  const payload: Record<string, unknown> = {
    id: taskId,
    title: data.title,
    notes: serializeNotes(data.notes || '', meta),
    status: data.status,
  };

  if (data.due) {
    payload.due = data.due.includes('T') ? data.due : `${data.due}T00:00:00.000Z`;
  } else if (data.due === null || data.due === '') {
    payload.due = null;
  }

  if (data.completed) {
    payload.completed = data.completed;
  }

  if (recurrenceRule) {
    payload.recurrence = [recurrenceRule];
  }

  let res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok && payload.recurrence) {
    delete payload.recurrence;
    res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update task (${res.status}): ${error}`);
  }

  const item: RawGoogleTask = await res.json();
  const { cleanNotes, meta: parsedMeta } = deserializeNotes(item.notes);

  return {
    id: item.id,
    listId,
    title: item.title || '',
    notes: cleanNotes,
    rawNotes: item.notes,
    status: item.status,
    due: item.due,
    completed: item.completed,
    updated: item.updated,
    parent: item.parent,
    position: item.position,
    priority: parsedMeta.priority || 'none',
    tags: parsedMeta.tags || [],
    starred: !!parsedMeta.starred,
    subtasks: parsedMeta.subtasks || [],
    assignedContact: parsedMeta.assignedContact,
    driveAttachments: parsedMeta.driveAttachments || [],
    calendarEventId: parsedMeta.calendarEventId,
    timeEstimate: parsedMeta.timeEstimate,
    kanbanStatus: parsedMeta.kanbanStatus || (item.status === 'completed' ? 'done' : 'todo'),
    recurring: parsedMeta.recurring || 'none',
    recurrenceRule: parsedMeta.recurrenceRule || recurrenceRule,
    reminder: parsedMeta.reminder,
    completedAt: parsedMeta.completedAt,
    createdAt: parsedMeta.createdAt,
    timeLogs: parsedMeta.timeLogs || [],
    totalTimeSpentSeconds: parsedMeta.totalTimeSpentSeconds || 0,
    dependsOn: parsedMeta.dependsOn || [],
  };
}

export async function deleteTask(
  accessToken: string,
  listId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Failed to delete task (${res.status}): ${error}`);
  }
}

export async function clearCompletedTasks(
  accessToken: string,
  listId: string
): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Failed to clear completed tasks (${res.status}): ${error}`);
  }
}
