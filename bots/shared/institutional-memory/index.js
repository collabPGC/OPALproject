/**
 * Institutional Memory - Event-sourced organizational knowledge system
 *
 * Architecture:
 *   JSONL event log (source of truth)
 *   └─ SQLite + FTS5 (structured + full-text queries)
 *   └─ Subscriptions (agent coordination)
 *   └─ Loop prevention (safety)
 *
 * Existing LanceDB and Graphology stores remain unchanged.
 * This module adds structured event capture and querying on top.
 */

import eventLog from './event-log.js';
import sqliteIndex from './sqlite-index.js';
import subscriptionManager from './subscription-manager.js';
import loopPrevention from './loop-prevention.js';
import { EVENT_TYPE, DOMAIN, RELATION_TYPE, validateEvent } from './event-schema.js';

let initialized = false;
let logger = null;

// Cross-process polling state
let pollInterval = null;
let lastPollTimestamp = null;

/**
 * Initialize the institutional memory system.
 *
 * @param {Function} [log] - Logger function: (level, message, data) => void
 * @param {Object} [options]
 * @param {number} [options.pollIntervalMs] - Cross-process event polling interval (default 5000)
 * @param {Object} [options.loopPrevention] - Loop prevention config overrides
 */
export async function init(log, options = {}) {
  if (initialized) return;

  logger = log || (() => {});

  // Initialize SQLite index
  sqliteIndex.init();
  logger('info', 'Institutional memory: SQLite index initialized');

  // Sync SQLite with any JSONL events not yet indexed
  await syncIndex();

  // Configure loop prevention
  if (options.loopPrevention) {
    loopPrevention.configure(options.loopPrevention);
  }

  // Start cross-process polling for events from other bots
  const pollMs = options.pollIntervalMs || 5000;
  if (pollMs > 0) {
    lastPollTimestamp = sqliteIndex.getLatestTimestamp() || new Date().toISOString();
    pollInterval = setInterval(() => pollForNewEvents(), pollMs);
    pollInterval.unref(); // Don't keep process alive for polling
  }

  initialized = true;
  logger('info', 'Institutional memory: initialized');
}

/**
 * Emit an event to the institutional memory.
 *
 * 1. Validates the event
 * 2. Appends to JSONL (source of truth)
 * 3. Indexes in SQLite + FTS5
 * 4. Fires matching subscriptions
 *
 * @param {Object} input - Event data (see event-schema.js)
 * @returns {Object} The stored event with generated id and timestamp
 */
export async function emit(input) {
  const { valid, event, errors } = validateEvent(input);
  if (!valid) {
    throw new Error(`Invalid event: ${errors.join('; ')}`);
  }

  // 1. Append to JSONL (source of truth)
  const stored = eventLog.appendEvent(input);

  // 2. Index in SQLite
  try {
    sqliteIndex.indexEvent(stored);
  } catch (err) {
    logger('error', 'Failed to index event in SQLite', { eventId: stored.id, error: err.message });
  }

  // 3. Fire subscriptions
  try {
    const results = await subscriptionManager.fireSubscriptions(stored, logger);
    const fired = results.filter(r => r.fired).length;
    if (fired > 0) {
      logger('info', 'Event triggered subscriptions', { eventId: stored.id, fired });
    }
  } catch (err) {
    logger('error', 'Failed to fire subscriptions', { eventId: stored.id, error: err.message });
  }

  logger('info', 'Event emitted', {
    id: stored.id,
    type: stored.type,
    domain: stored.domain,
    agent: stored.agent,
    title: stored.title,
  });

  return stored;
}

/**
 * Query events with structured filters.
 * Delegates to SQLite index.
 */
export function query(filters = {}) {
  return sqliteIndex.query(filters);
}

/**
 * Full-text search across events.
 * Uses FTS5 with Porter stemming.
 */
export function search(text, filters = {}) {
  return sqliteIndex.search(text, filters);
}

/**
 * Get events related to a specific event.
 */
export function getRelated(eventId) {
  return sqliteIndex.getRelated(eventId);
}

/**
 * Get an event by ID.
 * Tries SQLite first, falls back to JSONL scan.
 */
export function getEvent(id) {
  const fromIndex = sqliteIndex.getById(id);
  if (fromIndex) return fromIndex;
  return eventLog.getEventById(id);
}

/**
 * Get a timeline for a domain.
 */
export function getTimeline(domain, options = {}) {
  return sqliteIndex.getTimeline(domain, options);
}

/**
 * Subscribe to event patterns for agent coordination.
 *
 * @param {Object} pattern - { types, domains, agents, excludeAgents, tags }
 * @param {Function} handler - async (event) => void
 * @param {Object} [options] - { subscriber, cooldownMs }
 * @returns {string} Subscription ID
 */
export function subscribe(pattern, handler, options = {}) {
  return subscriptionManager.subscribe(pattern, handler, options);
}

/**
 * Unsubscribe by ID.
 */
export function unsubscribe(id) {
  return subscriptionManager.unsubscribe(id);
}

/**
 * Update approval status for an event.
 * Also updates the JSONL log by appending an approval event.
 */
export async function approve(eventId, approvedBy) {
  sqliteIndex.updateApproval(eventId, 'approved', approvedBy);

  // Emit an approval event that references the approved event
  await emit({
    agent: `human:${approvedBy}`,
    type: EVENT_TYPE.ACTION,
    domain: getEvent(eventId)?.domain || 'operations',
    title: `Approved: ${getEvent(eventId)?.title || eventId}`,
    content: `Event ${eventId} approved by ${approvedBy}`,
    relations: [{ type: RELATION_TYPE.FOLLOWS_FROM, targetId: eventId }],
    tags: ['approval'],
  });

  logger('info', 'Event approved', { eventId, approvedBy });
}

/**
 * Reject an event (set approval_status to 'rejected').
 */
export function reject(eventId, rejectedBy) {
  sqliteIndex.updateApproval(eventId, 'rejected', rejectedBy);
  logger('info', 'Event rejected', { eventId, rejectedBy });
}

/**
 * Get formatted context for AI system prompts.
 * Returns recent relevant events as markdown.
 */
export function getContext(options = {}) {
  const events = sqliteIndex.query({
    domain: options.domain,
    type: options.type,
    limit: options.limit || 20,
    order: 'desc',
  });

  if (events.length === 0) return '';

  const lines = ['## Institutional Memory Context', ''];

  for (const event of events) {
    const date = event.timestamp.slice(0, 10);
    const conf = event.confidence !== null ? ` (confidence: ${event.confidence})` : '';
    lines.push(`### [${event.type}] ${event.title}`);
    lines.push(`*${date} | ${event.agent} | ${event.domain}${conf}*`);
    if (event.content) {
      lines.push('');
      lines.push(event.content.length > 500 ? event.content.slice(0, 500) + '...' : event.content);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if an agent can react to an event (loop prevention).
 */
export function canReact(agent, triggerEvent, proposedReaction) {
  return loopPrevention.canReact(agent, triggerEvent, proposedReaction);
}

/**
 * Record that an agent has reacted (for loop prevention tracking).
 */
export function recordReaction(agent, event) {
  loopPrevention.recordReaction(agent, event);
}

/**
 * Build metadata for a reaction event.
 */
export function buildReactionMetadata(triggerEvent, extra = {}) {
  return loopPrevention.buildReactionMetadata(triggerEvent, extra);
}

/**
 * Get system statistics.
 */
export function getStats() {
  const indexStats = sqliteIndex.getStats();
  const logCount = eventLog.getEventCount();
  const subCount = subscriptionManager.getSubscriptionCount();
  const loopState = loopPrevention.getState();

  return {
    ...indexStats,
    logEventCount: logCount,
    activeSubscriptions: subCount,
    loopPrevention: loopState,
  };
}

/**
 * Sync the SQLite index with JSONL event log.
 * Indexes any events not yet in SQLite.
 */
async function syncIndex() {
  const latestTs = sqliteIndex.getLatestTimestamp();

  if (!latestTs) {
    // Full rebuild from all JSONL files
    const events = eventLog.readEvents();
    if (events.length > 0) {
      sqliteIndex.indexEvents(events);
      logger('info', 'Institutional memory: indexed all events from JSONL', { count: events.length });
    }
    return;
  }

  // Incremental: only index events after the latest indexed timestamp
  const newEvents = eventLog.readEvents({ since: latestTs });
  const toIndex = newEvents.filter(e => e.timestamp > latestTs);

  if (toIndex.length > 0) {
    sqliteIndex.indexEvents(toIndex);
    logger('info', 'Institutional memory: indexed new events', { count: toIndex.length });
  }
}

/**
 * Poll for new events from other processes (cross-bot coordination).
 * Reads new events from JSONL and fires matching subscriptions.
 */
async function pollForNewEvents() {
  try {
    const newEvents = eventLog.readEvents({ since: lastPollTimestamp });
    const unseen = newEvents.filter(e => e.timestamp > lastPollTimestamp);

    for (const event of unseen) {
      // Index if not already in SQLite
      if (!sqliteIndex.getById(event.id)) {
        try {
          sqliteIndex.indexEvent(event);
        } catch {
          // Already indexed (race condition)
        }
      }

      // Fire subscriptions for events from other processes
      await subscriptionManager.fireSubscriptions(event, logger);
    }

    if (unseen.length > 0) {
      lastPollTimestamp = unseen[unseen.length - 1].timestamp;
    }
  } catch (err) {
    if (logger) {
      logger('error', 'Event poll failed', { error: err.message });
    }
  }
}

/**
 * Shutdown: stop polling, close database.
 */
export function shutdown() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  sqliteIndex.close();
  subscriptionManager.clearAll();
  initialized = false;
  logger('info', 'Institutional memory: shut down');
}

// Export constants for convenience
export { EVENT_TYPE, DOMAIN, RELATION_TYPE } from './event-schema.js';

export default {
  init,
  emit,
  query,
  search,
  getRelated,
  getEvent,
  getTimeline,
  subscribe,
  unsubscribe,
  approve,
  reject,
  getContext,
  canReact,
  recordReaction,
  buildReactionMetadata,
  getStats,
  shutdown,
  EVENT_TYPE,
  DOMAIN,
  RELATION_TYPE,
};
