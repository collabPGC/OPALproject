/**
 * Event Log - Append-only JSONL event storage
 *
 * Source of truth for all institutional memory events.
 * Daily JSONL files: one JSON object per line, never edited or deleted.
 * POSIX atomic append ensures concurrency safety.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { validateEvent } from './event-schema.js';

const EVENTS_DIR = '/mnt/volume_nyc3_01/institutional-memory/events';

/**
 * Get the JSONL file path for a given date
 */
function getFilePath(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return path.join(EVENTS_DIR, `${yyyy}-${mm}-${dd}.jsonl`);
}

/**
 * Get today's JSONL file path
 */
function getTodayPath() {
  return getFilePath(new Date());
}

/**
 * Append a validated event to today's JSONL file.
 * Returns the event with assigned id and timestamp.
 */
export function appendEvent(input) {
  const { valid, event, errors } = validateEvent(input);
  if (!valid) {
    throw new Error(`Invalid event: ${errors.join('; ')}`);
  }

  const filePath = getTodayPath();
  const line = JSON.stringify(event) + '\n';

  // Atomic append (safe for single-process, POSIX guarantees for small writes)
  fs.appendFileSync(filePath, line, 'utf8');

  return event;
}

/**
 * Read events from a single JSONL file.
 * Returns an array of parsed event objects.
 */
function readFile(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const events = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}

/**
 * Read events from JSONL files within a date range.
 *
 * @param {Object} options
 * @param {string} [options.since] - ISO date string (inclusive)
 * @param {string} [options.until] - ISO date string (inclusive)
 * @param {string} [options.type] - Filter by event type
 * @param {string} [options.domain] - Filter by domain
 * @param {string} [options.agent] - Filter by agent
 * @returns {Array} Matching events sorted by timestamp ascending
 */
export function readEvents(options = {}) {
  const since = options.since ? new Date(options.since) : null;
  const until = options.until ? new Date(options.until) : null;

  // List all JSONL files
  if (!fs.existsSync(EVENTS_DIR)) return [];

  const files = fs.readdirSync(EVENTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort();

  // Filter files by date range
  const filteredFiles = files.filter(f => {
    const dateStr = f.replace('.jsonl', '');
    if (since && dateStr < since.toISOString().slice(0, 10)) return false;
    if (until && dateStr > until.toISOString().slice(0, 10)) return false;
    return true;
  });

  let events = [];
  for (const file of filteredFiles) {
    events.push(...readFile(path.join(EVENTS_DIR, file)));
  }

  // Apply filters
  if (options.type) {
    events = events.filter(e => e.type === options.type);
  }
  if (options.domain) {
    events = events.filter(e => e.domain === options.domain);
  }
  if (options.agent) {
    events = events.filter(e => e.agent === options.agent);
  }
  if (since) {
    events = events.filter(e => new Date(e.timestamp) >= since);
  }
  if (until) {
    const untilEnd = new Date(until);
    untilEnd.setUTCDate(untilEnd.getUTCDate() + 1); // Include full day
    events = events.filter(e => new Date(e.timestamp) < untilEnd);
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Stream all events from all JSONL files in chronological order.
 * Uses async generator for memory-efficient processing.
 */
export async function* streamAllEvents() {
  if (!fs.existsSync(EVENTS_DIR)) return;

  const files = fs.readdirSync(EVENTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort();

  for (const file of files) {
    const filePath = path.join(EVENTS_DIR, file);
    const input = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed);
      } catch {
        // Skip malformed lines
      }
    }
  }
}

/**
 * Get a specific event by ID.
 * Scans files in reverse chronological order (recent events more likely).
 */
export function getEventById(id) {
  if (!fs.existsSync(EVENTS_DIR)) return null;

  const files = fs.readdirSync(EVENTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse();

  for (const file of files) {
    const events = readFile(path.join(EVENTS_DIR, file));
    const found = events.find(e => e.id === id);
    if (found) return found;
  }

  return null;
}

/**
 * Get total event count across all files.
 */
export function getEventCount() {
  if (!fs.existsSync(EVENTS_DIR)) return 0;

  let count = 0;
  const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf8');
    count += content.split('\n').filter(l => l.trim()).length;
  }

  return count;
}

/**
 * List available date files.
 */
export function listEventFiles() {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  return fs.readdirSync(EVENTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort();
}

export default {
  appendEvent,
  readEvents,
  streamAllEvents,
  getEventById,
  getEventCount,
  listEventFiles,
  EVENTS_DIR,
};
