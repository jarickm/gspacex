import type { GoogleCalendarEvent, CalendarMeeting } from '../types/gqueues';
import { notifySessionExpired } from './firebase';
import {
  MANILA_TIMEZONE,
  getManilaDayBounds,
  getManilaTodayDateString,
} from '../utils/timezone';

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
}

export interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD or ISO
  startTime?: string;
  endTime?: string;
  timeEstimate?: string;
  location?: string;
  attendees?: CalendarEventAttendee[];
  addGoogleMeet?: boolean;
  sendUpdates?: 'all' | 'none' | 'externalOnly';
}

export interface UpdateCalendarEventParams {
  summary?: string;
  description?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  timeEstimate?: string;
  location?: string;
  attendees?: CalendarEventAttendee[];
  sendUpdates?: 'all' | 'none' | 'externalOnly';
}

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: MANILA_TIMEZONE,
    maxResults: '200',
  });

  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      notifySessionExpired();
    }
    const error = await res.text();
    throw new Error(`Failed to fetch calendar events (${res.status}): ${error}`);
  }

  const data = await res.json();
  const items = data.items || [];

  return items.map((e: any) => ({
    id: e.id,
    summary: e.summary || '(Untitled Event)',
    description: e.description,
    start: e.start || {},
    end: e.end || {},
    htmlLink: e.htmlLink,
    hangoutLink:
      e.hangoutLink ||
      e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
    location: e.location,
    attendees: e.attendees || [],
    status: e.status,
  }));
}

/**
 * Check if the user has meetings today in Google Workspace Calendar (Asia/Manila time)
 * Returns enriched meetings with Google Meet video links, status, and live countdowns
 */
export async function fetchTodayMeetings(accessToken: string): Promise<CalendarMeeting[]> {
  // Compute exact start & end of day in Philippines (Manila) Time (UTC+8)
  const { timeMin, timeMax } = getManilaDayBounds();

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin,
    timeMax,
    timeZone: MANILA_TIMEZONE,
    maxResults: '50',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      notifySessionExpired();
    }
    const errorBody = await res.text();
    throw new Error(`Failed to check today meetings (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const items = data.items || [];
  const currentTimeMs = Date.now();

  return items
    .filter((e: any) => e.status !== 'cancelled')
    .map((e: any) => {
      let isLiveNow = false;
      let startsInMinutes: number | undefined = undefined;

      const startTimeStr = e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00+08:00` : null);
      const endTimeStr = e.end?.dateTime || (e.end?.date ? `${e.end.date}T23:59:59+08:00` : null);

      if (startTimeStr && endTimeStr) {
        const startMs = new Date(startTimeStr).getTime();
        const endMs = new Date(endTimeStr).getTime();

        if (currentTimeMs >= startMs && currentTimeMs <= endMs) {
          isLiveNow = true;
          startsInMinutes = 0;
        } else if (startMs > currentTimeMs) {
          startsInMinutes = Math.round((startMs - currentTimeMs) / (60 * 1000));
        } else {
          startsInMinutes = Math.round((startMs - currentTimeMs) / (60 * 1000));
        }
      }

      // Check for Google Meet link
      const hangoutLink =
        e.hangoutLink ||
        e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;

      return {
        id: e.id,
        summary: e.summary || '(Untitled Meeting)',
        description: e.description,
        start: e.start || {},
        end: e.end || {},
        htmlLink: e.htmlLink,
        hangoutLink,
        conferenceData: e.conferenceData,
        attendees: e.attendees || [],
        location: e.location,
        status: e.status,
        isLiveNow,
        startsInMinutes,
      };
    });
}

export async function createCalendarEvent(
  accessToken: string,
  params: CreateCalendarEventParams
): Promise<GoogleCalendarEvent> {
  const rawDate = params.dueDate || getManilaTodayDateString();
  const dateOnly = rawDate.split('T')[0];

  let start: { dateTime?: string; date?: string; timeZone?: string };
  let end: { dateTime?: string; date?: string; timeZone?: string };

  if (params.startTime) {
    const startIso = `${dateOnly}T${params.startTime}:00+08:00`;
    const endIso = params.endTime
      ? `${dateOnly}T${params.endTime}:00+08:00`
      : `${dateOnly}T${params.startTime}:00+08:00`;
    start = { dateTime: startIso, timeZone: MANILA_TIMEZONE };
    end = { dateTime: endIso, timeZone: MANILA_TIMEZONE };
  } else if (rawDate.includes('T')) {
    const hasOffset = rawDate.includes('+') || rawDate.endsWith('Z');
    const startIso = hasOffset ? rawDate : `${rawDate}+08:00`;
    const startDate = new Date(startIso);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    start = { dateTime: startIso, timeZone: MANILA_TIMEZONE };
    end = { dateTime: endDate.toISOString(), timeZone: MANILA_TIMEZONE };
  } else {
    start = { date: dateOnly, timeZone: MANILA_TIMEZONE };
    end = { date: dateOnly, timeZone: MANILA_TIMEZONE };
  }

  const payload: any = {
    summary: params.summary,
    description: params.description || '',
    start,
    end,
    reminders: {
      useDefault: true,
    },
  };

  if (params.location) {
    payload.location = params.location;
  }

  // If attendees are provided, add them
  if (params.attendees && params.attendees.length > 0) {
    payload.attendees = params.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName || a.email,
    }));
  }

  // If Google Meet is requested, generate video conference
  if (params.addGoogleMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId: 'meet-' + Date.now(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const sendUpdatesParam = params.sendUpdates || (params.attendees?.length ? 'all' : 'none');
  const query = `?sendUpdates=${sendUpdatesParam}&conferenceDataVersion=1`;

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create calendar event (${res.status}): ${error}`);
  }

  const created = await res.json();
  return {
    id: created.id,
    summary: created.summary,
    description: created.description,
    start: created.start,
    end: created.end,
    htmlLink: created.htmlLink,
    hangoutLink:
      created.hangoutLink ||
      created.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
    location: created.location,
    attendees: created.attendees || [],
    status: created.status,
  };
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  params: UpdateCalendarEventParams
): Promise<GoogleCalendarEvent> {
  const payload: any = {};

  if (params.summary) {
    payload.summary = params.summary;
  }

  if (params.description !== undefined) {
    payload.description = params.description;
  }

  if (params.location !== undefined) {
    payload.location = params.location;
  }

  if (params.startTime) {
    const dateOnly = (params.dueDate || getManilaTodayDateString()).split('T')[0];
    const startIso = `${dateOnly}T${params.startTime}:00+08:00`;
    const endIso = params.endTime
      ? `${dateOnly}T${params.endTime}:00+08:00`
      : `${dateOnly}T${params.startTime}:00+08:00`;
    payload.start = { dateTime: startIso, timeZone: MANILA_TIMEZONE };
    payload.end = { dateTime: endIso, timeZone: MANILA_TIMEZONE };
  } else if (params.dueDate) {
    const dateStr = params.dueDate;
    const isDateTime = dateStr.includes('T');
    if (isDateTime) {
      const hasOffset = dateStr.includes('+') || dateStr.endsWith('Z');
      const startIso = hasOffset ? dateStr : `${dateStr}+08:00`;
      const startDate = new Date(startIso);
      payload.start = { dateTime: startIso, timeZone: MANILA_TIMEZONE };
      payload.end = {
        dateTime: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: MANILA_TIMEZONE,
      };
    } else {
      payload.start = { date: dateStr.split('T')[0], timeZone: MANILA_TIMEZONE };
      payload.end = { date: dateStr.split('T')[0], timeZone: MANILA_TIMEZONE };
    }
  }

  if (params.attendees) {
    payload.attendees = params.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName || a.email,
    }));
  }

  const sendUpdatesParam = params.sendUpdates || 'all';
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=${sendUpdatesParam}&conferenceDataVersion=1`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update calendar event (${res.status}): ${error}`);
  }

  const updated = await res.json();
  return {
    id: updated.id,
    summary: updated.summary,
    description: updated.description,
    start: updated.start,
    end: updated.end,
    htmlLink: updated.htmlLink,
    hangoutLink:
      updated.hangoutLink ||
      updated.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
    location: updated.location,
    attendees: updated.attendees || [],
    status: updated.status,
  };
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 204 && res.status !== 404 && res.status !== 410) {
    const error = await res.text();
    throw new Error(`Failed to delete calendar event (${res.status}): ${error}`);
  }
}
