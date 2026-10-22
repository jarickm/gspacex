export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export type KanbanStatus = 'todo' | 'in_progress' | 'waiting' | 'done';

export type RecurringSchedule =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly';

export type ViewMode = 'tasks' | 'kanban' | 'calendar' | 'completed' | 'dashboard';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  due?: string;
}

export interface DriveAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

export interface AssignedContact {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface TimeLogEntry {
  id: string;
  seconds: number;
  timestamp: string; // ISO date string
  note?: string;
}

export interface GQueueTaskMetadata {
  priority?: Priority;
  tags?: string[];
  starred?: boolean;
  subtasks?: Subtask[];
  assignedContact?: AssignedContact;
  driveAttachments?: DriveAttachment[];
  calendarEventId?: string;
  timeEstimate?: string;
  kanbanStatus?: KanbanStatus;
  recurring?: RecurringSchedule;
  recurrenceRule?: string; // RFC 5545 format e.g. RRULE:FREQ=DAILY
  reminder?: string;
  completedAt?: string;
  createdAt?: string;
  timeLogs?: TimeLogEntry[];
  totalTimeSpentSeconds?: number;
  dependsOn?: string[]; // IDs of tasks this task depends on (blocked by)
}

export interface GQueueTask {
  id: string;
  listId: string;
  title: string;
  notes: string; // Clean user notes without metadata block
  rawNotes?: string;
  status: 'needsAction' | 'completed';
  due?: string; // ISO string or YYYY-MM-DD
  completed?: string;
  updated: string;
  parent?: string;
  position?: string;
  
  // GQueues advanced metadata
  priority: Priority;
  tags: string[];
  starred: boolean;
  subtasks: Subtask[];
  assignedContact?: AssignedContact;
  driveAttachments: DriveAttachment[];
  calendarEventId?: string;
  timeEstimate?: string;
  kanbanStatus: KanbanStatus;
  recurring: RecurringSchedule;
  recurrenceRule?: string;
  reminder?: string;
  completedAt?: string;
  createdAt?: string;
  timeLogs: TimeLogEntry[];
  totalTimeSpentSeconds: number;
  dependsOn?: string[];
}

export interface QueueList {
  id: string;
  title: string;
  updated?: string;
  category: string;
  color: string;
  taskCount?: number;
  completedCount?: number;
}

export type SmartQueueType = 'today' | 'overdue' | 'upcoming' | 'starred' | 'all' | 'completed';

export interface GoogleContact {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  source?: 'contacts' | 'directory' | 'other' | 'custom';
  isOrgMember?: boolean;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: { displayName?: string; emailAddress?: string; photoLink?: string }[];
  thumbnailLink?: string;
  shared?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  hangoutLink?: string;
  location?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; self?: boolean }>;
  status?: string;
}

export interface CalendarMeeting {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  hangoutLink?: string; // Google Meet video call URL
  conferenceData?: any;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; self?: boolean }>;
  location?: string;
  status?: string;
  isLiveNow?: boolean;
  startsInMinutes?: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'meeting' | 'timer';
  timestamp: string;
  read?: boolean;
  taskId?: string;
  meetingLink?: string;
}
