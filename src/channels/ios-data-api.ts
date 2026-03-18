/**
 * Data API endpoints for the iOS channel.
 *
 * Serves family data (calendar, tasks) over HTTP so the app works
 * on real devices over LAN — not just in Simulator with filesystem access.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { getMessageHistory, getMessageHistoryAllIos } from '../db.js';

const SIGMA_DATA = path.join(process.env.HOME || '/Users/fambot', 'sigma-data');
const SCHEDULES_DIR = path.join(SIGMA_DATA, 'family', 'schedules');
const TASKS_FILE = path.join(SIGMA_DATA, 'family', 'sigma-app-tasks.md');

/**
 * Handle data API routes. Returns true if the request was handled.
 */
export function handleDataApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  token: string,
): boolean {
  const url = req.url || '';

  if (req.method === 'GET' && url === '/api/calendar') {
    authGuard(req, res, token, () => handleGetCalendar(res));
    return true;
  }

  if (req.method === 'GET' && url.startsWith('/api/messages')) {
    authGuard(req, res, token, () => handleGetMessages(req, res));
    return true;
  }

  if (req.method === 'GET' && url === '/api/tasks') {
    authGuard(req, res, token, () => handleGetTasks(res));
    return true;
  }

  if (req.method === 'PUT' && url === '/api/tasks') {
    authGuard(req, res, token, () => handlePutTasks(req, res));
    return true;
  }

  return false;
}

// MARK: - Auth

function authGuard(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  token: string,
  handler: () => void,
): void {
  const authHeader = req.headers.authorization || '';
  const reqToken = authHeader.replace('Bearer ', '');
  if (reqToken !== token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  handler();
}

// MARK: - Calendar

interface CalendarEvent {
  id: string;
  summary: string;
  startDate: string; // ISO string
  endDate: string | null;
  isAllDay: boolean;
  description: string | null;
}

function handleGetCalendar(res: http.ServerResponse): void {
  try {
    const files = fs.readdirSync(SCHEDULES_DIR).filter((f) => f.endsWith('.ics'));
    const allEvents: CalendarEvent[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(SCHEDULES_DIR, file), 'utf-8');
      const events = parseICS(content);
      allEvents.push(...events);
      logger.debug({ file, count: events.length }, 'Parsed ICS file');
    }

    // Sort by start date
    allEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: allEvents }));
  } catch (err) {
    logger.error({ err }, 'Failed to read calendar');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read calendar' }));
  }
}

/**
 * Lightweight ICS parser — same logic as the Swift ICSParser but in TypeScript.
 * Handles School Bytes' VEVENT format.
 */
function parseICS(content: string): CalendarEvent[] {
  // Unfold continuation lines (RFC 5545)
  const unfolded = content
    .replace(/\r\n /g, '')
    .replace(/\r\n\t/g, '')
    .replace(/\n /g, '')
    .replace(/\n\t/g, '');

  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];

  let inEvent = false;
  let uid = '';
  let summary = '';
  let dtstart = '';
  let dtend = '';
  let description: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      summary = '';
      dtstart = '';
      dtend = '';
      description = null;
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      const start = parseICSDate(dtstart);
      if (start) {
        const isAllDay = dtstart.includes('VALUE=DATE');
        const end = parseICSDate(dtend);

        events.push({
          id: uid || `gen-${Date.now()}-${Math.random()}`,
          summary: summary.replace(/\\,/g, ',').replace(/\\;/g, ';'),
          startDate: start.toISOString(),
          endDate: end ? end.toISOString() : null,
          isAllDay,
          description: description
            ? description.replace(/\\n/g, '\n').replace(/\\,/g, ',').trim()
            : null,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    if (trimmed.startsWith('UID:')) uid = trimmed.slice(4);
    else if (trimmed.startsWith('SUMMARY:')) summary = trimmed.slice(8);
    else if (trimmed.startsWith('DTSTART')) dtstart = trimmed;
    else if (trimmed.startsWith('DTEND')) dtend = trimmed;
    else if (trimmed.startsWith('DESCRIPTION:')) description = trimmed.slice(12);
  }

  return events;
}

function parseICSDate(raw: string): Date | null {
  if (!raw) return null;

  const colonIdx = raw.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const value = raw.slice(colonIdx + 1);

  if (raw.includes('VALUE=DATE')) {
    // All-day: 20260318 → local midnight
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    return new Date(y, m, d);
  } else if (value.endsWith('Z')) {
    // UTC: 20260318T090000Z
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    const h = parseInt(value.slice(9, 11));
    const min = parseInt(value.slice(11, 13));
    const s = parseInt(value.slice(13, 15));
    return new Date(Date.UTC(y, m, d, h, min, s));
  } else {
    // Local: 20260318T090000
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    const h = parseInt(value.slice(9, 11));
    const min = parseInt(value.slice(11, 13));
    const s = parseInt(value.slice(13, 15));
    return new Date(y, m, d, h, min, s);
  }
}

// MARK: - Messages

function handleGetMessages(req: http.IncomingMessage, res: http.ServerResponse): void {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const jid = url.searchParams.get('jid');
    const limit = parseInt(url.searchParams.get('limit') || '200', 10);

    // If no JID specified, return all iOS messages (unified view)
    const messages = jid ? getMessageHistory(jid, limit) : getMessageHistoryAllIos(limit);

    // Strip the @Sigma prefix from user messages for display
    const cleaned = messages.map((m) => ({
      id: m.id,
      sender: m.sender_name,
      content: m.content.replace(/^@\S+\s*/, ''),
      timestamp: m.timestamp,
      isFromMe: m.is_from_me ? true : false,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: cleaned }));
  } catch (err) {
    logger.error({ err }, 'Failed to get messages');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get messages' }));
  }
}

// MARK: - Tasks

function handleGetTasks(res: http.ServerResponse): void {
  try {
    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/markdown' });
    res.end(content);
  } catch (err) {
    logger.error({ err }, 'Failed to read tasks');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read tasks file' }));
  }
}

function handlePutTasks(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      fs.writeFileSync(TASKS_FILE, body, 'utf-8');
      logger.info('Tasks file updated via API');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'saved' }));
    } catch (err) {
      logger.error({ err }, 'Failed to write tasks');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to write tasks file' }));
    }
  });
}
