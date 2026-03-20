/**
 * Daily nudge — reads school calendar and sends a morning push notification.
 *
 * For the POC, this is a lightweight function (no Claude agent involved).
 * When more data sources are added beyond calendar, this can evolve to an
 * agent-invoked task. The sendPush() call stays the same.
 */

import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';

import { sendPushToAll } from './apns.js';
import { TIMEZONE } from './config.js';
import { logger } from './logger.js';

const SIGMA_DATA = path.join(process.env.HOME || '/Users/fambot', 'sigma-data');
const SCHEDULES_DIR = path.join(SIGMA_DATA, 'family', 'schedules');

// Reuse the ICS parsing logic from ios-data-api (same format).
// Inlined here to keep this module standalone and avoid circular deps.

interface CalendarEvent {
  summary: string;
  startDate: Date;
  isAllDay: boolean;
}

function parseICSFile(filePath: string): CalendarEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const unfolded = content
    .replace(/\r\n /g, '')
    .replace(/\r\n\t/g, '')
    .replace(/\n /g, '')
    .replace(/\n\t/g, '');

  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];

  let inEvent = false;
  let summary = '';
  let dtstart = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      dtstart = '';
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      const parsed = parseICSDate(dtstart);
      if (parsed) {
        events.push({
          summary: summary.replace(/\\,/g, ',').replace(/\\;/g, ';'),
          startDate: parsed.date,
          isAllDay: parsed.isAllDay,
        });
      }
      continue;
    }
    if (!inEvent) continue;
    if (trimmed.startsWith('SUMMARY:')) summary = trimmed.slice(8);
    else if (trimmed.startsWith('DTSTART')) dtstart = trimmed;
  }

  return events;
}

function parseICSDate(raw: string): { date: Date; isAllDay: boolean } | null {
  if (!raw) return null;
  const colonIdx = raw.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const value = raw.slice(colonIdx + 1);
  const isAllDay = raw.includes('VALUE=DATE');

  const y = parseInt(value.slice(0, 4));
  const m = parseInt(value.slice(4, 6)) - 1;
  const d = parseInt(value.slice(6, 8));

  if (isAllDay) {
    return { date: new Date(y, m, d), isAllDay: true };
  }

  const h = parseInt(value.slice(9, 11));
  const min = parseInt(value.slice(11, 13));
  const s = parseInt(value.slice(13, 15));

  if (value.endsWith('Z')) {
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), isAllDay: false };
  }
  return { date: new Date(y, m, d, h, min, s), isAllDay: false };
}

/**
 * Get today's events from all .ics files.
 */
function getTodayEvents(): CalendarEvent[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const allEvents: CalendarEvent[] = [];

  try {
    const files = fs.readdirSync(SCHEDULES_DIR).filter(f => f.endsWith('.ics'));
    for (const file of files) {
      const events = parseICSFile(path.join(SCHEDULES_DIR, file));
      allEvents.push(...events);
    }
  } catch (err) {
    logger.error({ err }, 'Failed to read calendar files for daily nudge');
    return [];
  }

  // Filter to today
  return allEvents.filter(e => {
    const eventDate = `${e.startDate.getFullYear()}-${String(e.startDate.getMonth() + 1).padStart(2, '0')}-${String(e.startDate.getDate()).padStart(2, '0')}`;
    return eventDate === todayStr;
  }).sort((a, b) => {
    // All-day events first, then by time
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.startDate.getTime() - b.startDate.getTime();
  });
}

/**
 * Format a notification body from today's events.
 */
function formatNotificationBody(events: CalendarEvent[]): { title: string; body: string } {
  if (events.length === 0) {
    return {
      title: 'All Clear Today',
      body: 'Nothing on the calendar — enjoy your day!',
    };
  }

  const MAX_EVENTS = 4;
  const shown = events.slice(0, MAX_EVENTS);
  const remaining = events.length - MAX_EVENTS;

  const lines = shown.map(e => {
    if (e.isAllDay) {
      return `All day — ${e.summary}`;
    }
    const time = e.startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${time} ${e.summary}`;
  });

  if (remaining > 0) {
    lines.push(`+${remaining} more`);
  }

  return {
    title: "Today's Schedule",
    body: lines.join('\n'),
  };
}

/**
 * Run the daily nudge — read calendar, compose notification, send to all devices.
 * Exported so the test endpoint can call it directly.
 */
export async function runDailyNudge(): Promise<{ title: string; body: string; sent: number }> {
  const events = getTodayEvents();
  const { title, body } = formatNotificationBody(events);

  logger.info({ eventCount: events.length, title }, 'Running daily nudge');

  const sent = await sendPushToAll(title, body);
  return { title, body, sent };
}

/**
 * Start the daily nudge cron. Runs at 7:30am in the configured timezone.
 */
export function startDailyNudgeCron(): void {
  const CRON_EXPRESSION = '30 7 * * *'; // 7:30am daily

  const scheduleNext = () => {
    const interval = CronExpressionParser.parse(CRON_EXPRESSION, { tz: TIMEZONE });
    const nextRun = interval.next().toDate();
    const delay = nextRun.getTime() - Date.now();

    logger.info({ nextRun: nextRun.toISOString(), timezone: TIMEZONE }, 'Daily nudge scheduled');

    setTimeout(async () => {
      try {
        await runDailyNudge();
      } catch (err) {
        logger.error({ err }, 'Daily nudge failed');
      }
      // Schedule the next one
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
