/**
 * Timezone utilities for Philippines (Manila) Time (Asia/Manila, UTC+8 / PHT)
 */

export const MANILA_TIMEZONE = 'Asia/Manila';
export const MANILA_OFFSET = '+08:00';
export const MANILA_LABEL = 'Philippine Standard Time (PHT, GMT+8)';

/**
 * Returns today's date in Manila (Asia/Manila) in YYYY-MM-DD format
 */
export function getManilaTodayDateString(): string {
  return getManilaDateString(new Date());
}

/**
 * Returns the YYYY-MM-DD date string of any given Date or ISO string in Manila timezone
 */
export function getManilaDateString(input?: Date | string | null): string {
  if (!input) return getManilaTodayDateString();
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // Formats as YYYY-MM-DD
}

/**
 * Returns HH:mm (24-hour) string in Manila timezone, suitable for <input type="time">
 */
export function getManilaTimeString24(input?: Date | string | null): string {
  if (!input) return '09:00';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '09:00';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  let hour = '00';
  let minute = '00';
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value === '24' ? '00' : p.value.padStart(2, '0');
    if (p.type === 'minute') minute = p.value.padStart(2, '0');
  }
  return `${hour}:${minute}`;
}

/**
 * Format time in Manila (e.g., "9:30 AM" or "2:15 PM PHT")
 */
export function formatManilaTime(
  input?: Date | string | null,
  showTimeZoneSuffix: boolean = false
): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);

  return showTimeZoneSuffix ? `${timeStr} PHT` : timeStr;
}

/**
 * Format date & time in Manila (e.g., "Tue, Oct 20 • 9:30 AM PHT")
 */
export function formatManilaDateTime(
  input?: Date | string | null,
  showTimeZoneSuffix: boolean = true
): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';

  const str = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);

  return showTimeZoneSuffix ? `${str} PHT` : str;
}

/**
 * Formats a date label for headers in Manila time (e.g., "Tuesday, October 20, 2026")
 */
export function formatManilaFullDate(input?: Date | string | null): string {
  const d = !input ? new Date() : typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Get start and end of day in Manila for Google Calendar queries (RFC 3339 format)
 */
export function getManilaDayBounds(targetDateStr?: string): { timeMin: string; timeMax: string } {
  const dateStr = targetDateStr || getManilaTodayDateString();
  return {
    timeMin: `${dateStr}T00:00:00+08:00`,
    timeMax: `${dateStr}T23:59:59.999+08:00`,
  };
}

/**
 * Returns current live Manila time components
 */
export function getManilaCurrentComponents(): {
  year: number;
  month: number; // 0-indexed (0 to 11)
  date: number; // 1 to 31
  day: number; // 0 (Sun) to 6 (Sat)
  hours: number;
  minutes: number;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  let year = now.getFullYear();
  let month = now.getMonth();
  let date = now.getDate();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let weekdayStr = '';

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10) - 1; // 0-indexed
    if (p.type === 'day') date = parseInt(p.value, 10);
    if (p.type === 'hour') hours = parseInt(p.value === '24' ? '0' : p.value, 10);
    if (p.type === 'minute') minutes = parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayStr = p.value;
  }

  const daysMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = daysMap[weekdayStr] ?? 0;

  return { year, month, date, day, hours, minutes };
}
