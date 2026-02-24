/**
 * SQLite + FTS5 Index - Derived index for institutional memory events
 *
 * This is a rebuildable materialized view over the JSONL event log.
 * Provides:
 *  - Structured queries (by type, domain, agent, date range)
 *  - Full-text search via FTS5 with Porter stemming
 *  - Relation and tag lookups
 *
 * Can be deleted and rebuilt at any time from the JSONL source of truth.
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = '/mnt/volume_nyc3_01/institutional-memory/index/institutional.db';

let db = null;

/**
 * Initialize the SQLite database and create tables if needed.
 */
export function init() {
  if (db) return db;

  db = new Database(DB_PATH);

  // WAL mode for concurrent reads + single writer
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      agent TEXT NOT NULL,
      type TEXT NOT NULL,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      confidence REAL,
      requires_approval INTEGER DEFAULT 0,
      approval_status TEXT,
      approved_by TEXT,
      source_channel TEXT,
      source_post TEXT,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_relations (
      event_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );

    CREATE TABLE IF NOT EXISTS event_tags (
      event_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_domain ON events(domain);
    CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_approval ON events(approval_status);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON event_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_tags_event ON event_tags(event_id);
    CREATE INDEX IF NOT EXISTS idx_relations_event ON event_relations(event_id);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON event_relations(target_id);
  `);

  // FTS5 virtual table (separate creation to handle "already exists" gracefully)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE events_fts USING fts5(
        title,
        content,
        tags,
        tokenize='porter unicode61'
      );
    `);
  } catch {
    // Table already exists
  }

  return db;
}

/**
 * Index a single event into SQLite + FTS5.
 */
export function indexEvent(event) {
  if (!db) init();

  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO events (id, timestamp, agent, type, domain, title, content,
      confidence, requires_approval, approval_status, approved_by,
      source_channel, source_post, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRelation = db.prepare(`
    INSERT INTO event_relations (event_id, relation_type, target_id)
    VALUES (?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT INTO event_tags (event_id, tag) VALUES (?, ?)
  `);

  const insertFts = db.prepare(`
    INSERT INTO events_fts (rowid, title, content, tags)
    VALUES ((SELECT rowid FROM events WHERE id = ?), ?, ?, ?)
  `);

  const txn = db.transaction(() => {
    insertEvent.run(
      event.id,
      event.timestamp,
      event.agent,
      event.type,
      event.domain,
      event.title,
      event.content || '',
      event.confidence,
      event.requires_approval ? 1 : 0,
      event.approval_status || null,
      event.approved_by || null,
      event.source?.channelId || null,
      event.source?.postId || null,
      JSON.stringify(event.metadata || {}),
      Date.parse(event.timestamp)
    );

    // Relations
    for (const rel of (event.relations || [])) {
      insertRelation.run(event.id, rel.type, rel.targetId);
    }

    // Tags
    for (const tag of (event.tags || [])) {
      insertTag.run(event.id, tag);
    }

    // FTS5
    const tagsStr = (event.tags || []).join(' ');
    insertFts.run(event.id, event.title, event.content || '', tagsStr);
  });

  txn();
}

/**
 * Index multiple events in a single transaction.
 */
export function indexEvents(events) {
  if (!db) init();

  const txn = db.transaction(() => {
    for (const event of events) {
      indexEvent(event);
    }
  });

  txn();
}

/**
 * Query events with structured filters.
 *
 * @param {Object} filters
 * @param {string} [filters.type] - Event type
 * @param {string} [filters.domain] - Domain
 * @param {string} [filters.agent] - Agent name
 * @param {string} [filters.since] - ISO date (inclusive)
 * @param {string} [filters.until] - ISO date (inclusive)
 * @param {string} [filters.approval_status] - 'pending', 'approved', 'rejected'
 * @param {string[]} [filters.tags] - Match any of these tags
 * @param {number} [filters.limit] - Max results (default 50)
 * @param {string} [filters.order] - 'asc' or 'desc' (default 'desc')
 * @returns {Array} Matching events
 */
export function query(filters = {}) {
  if (!db) init();

  const conditions = [];
  const params = [];

  if (filters.type) {
    conditions.push('e.type = ?');
    params.push(filters.type);
  }
  if (filters.domain) {
    conditions.push('e.domain = ?');
    params.push(filters.domain);
  }
  if (filters.agent) {
    conditions.push('e.agent = ?');
    params.push(filters.agent);
  }
  if (filters.since) {
    conditions.push('e.timestamp >= ?');
    params.push(filters.since);
  }
  if (filters.until) {
    conditions.push('e.timestamp <= ?');
    params.push(filters.until + 'T23:59:59.999Z');
  }
  if (filters.approval_status) {
    conditions.push('e.approval_status = ?');
    params.push(filters.approval_status);
  }
  if (filters.tags && filters.tags.length > 0) {
    const placeholders = filters.tags.map(() => '?').join(',');
    conditions.push(`e.id IN (SELECT event_id FROM event_tags WHERE tag IN (${placeholders}))`);
    params.push(...filters.tags);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';
  const limit = filters.limit || 50;

  const sql = `
    SELECT e.*, GROUP_CONCAT(DISTINCT t.tag) as tags_str
    FROM events e
    LEFT JOIN event_tags t ON t.event_id = e.id
    ${where}
    GROUP BY e.id
    ORDER BY e.timestamp ${order}
    LIMIT ?
  `;

  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToEvent);
}

/**
 * Full-text search combined with optional structured filters.
 *
 * @param {string} text - Search query (FTS5 syntax supported)
 * @param {Object} [filters] - Same filters as query()
 * @returns {Array} Matching events ranked by relevance
 */
export function search(text, filters = {}) {
  if (!db) init();

  // Step 1: Get ranked rowids from FTS5
  const ftsRows = db.prepare(`
    SELECT rowid, rank FROM events_fts WHERE events_fts MATCH ? ORDER BY rank LIMIT 200
  `).all(text);

  if (ftsRows.length === 0) return [];

  // Build a rank lookup map
  const rankMap = new Map();
  const rowids = [];
  for (const r of ftsRows) {
    rankMap.set(r.rowid, r.rank);
    rowids.push(r.rowid);
  }

  // Step 2: Fetch full events with structured filters
  const conditions = [];
  const params = [];

  const rowidPlaceholders = rowids.map(() => '?').join(',');
  conditions.push(`e.rowid IN (${rowidPlaceholders})`);
  params.push(...rowids);

  if (filters.type) {
    conditions.push('e.type = ?');
    params.push(filters.type);
  }
  if (filters.domain) {
    conditions.push('e.domain = ?');
    params.push(filters.domain);
  }
  if (filters.agent) {
    conditions.push('e.agent = ?');
    params.push(filters.agent);
  }
  if (filters.since) {
    conditions.push('e.timestamp >= ?');
    params.push(filters.since);
  }
  if (filters.until) {
    conditions.push('e.timestamp <= ?');
    params.push(filters.until + 'T23:59:59.999Z');
  }
  if (filters.tags && filters.tags.length > 0) {
    const placeholders = filters.tags.map(() => '?').join(',');
    conditions.push(`e.id IN (SELECT event_id FROM event_tags WHERE tag IN (${placeholders}))`);
    params.push(...filters.tags);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = filters.limit || 20;

  const sql = `
    SELECT e.*, GROUP_CONCAT(DISTINCT t.tag) as tags_str
    FROM events e
    LEFT JOIN event_tags t ON t.event_id = e.id
    ${where}
    GROUP BY e.id
    LIMIT ?
  `;

  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  // Attach rank and sort by it
  const results = rows.map(row => {
    const evt = rowToEvent(row);
    evt.rank = rankMap.get(row.rowid) ?? 0;
    return evt;
  });

  results.sort((a, b) => a.rank - b.rank);
  return results;
}

/**
 * Get events related to a specific event (incoming and outgoing relations).
 */
export function getRelated(eventId) {
  if (!db) init();

  const outgoing = db.prepare(`
    SELECT e.*, r.relation_type as rel_type, 'outgoing' as rel_direction
    FROM event_relations r
    JOIN events e ON e.id = r.target_id
    WHERE r.event_id = ?
  `).all(eventId);

  const incoming = db.prepare(`
    SELECT e.*, r.relation_type as rel_type, 'incoming' as rel_direction
    FROM event_relations r
    JOIN events e ON e.id = r.event_id
    WHERE r.target_id = ?
  `).all(eventId);

  return {
    outgoing: outgoing.map(rowToEvent),
    incoming: incoming.map(rowToEvent),
  };
}

/**
 * Get a timeline of events for a domain.
 */
export function getTimeline(domain, options = {}) {
  return query({ domain, order: 'asc', ...options });
}

/**
 * Get an event by ID.
 */
export function getById(id) {
  if (!db) init();

  const row = db.prepare(`
    SELECT e.*, GROUP_CONCAT(DISTINCT t.tag) as tags_str
    FROM events e
    LEFT JOIN event_tags t ON t.event_id = e.id
    WHERE e.id = ?
    GROUP BY e.id
  `).get(id);

  return row ? rowToEvent(row) : null;
}

/**
 * Update approval status for an event.
 */
export function updateApproval(eventId, status, approvedBy) {
  if (!db) init();

  db.prepare(`
    UPDATE events SET approval_status = ?, approved_by = ? WHERE id = ?
  `).run(status, approvedBy, eventId);
}

/**
 * Get aggregate stats.
 */
export function getStats() {
  if (!db) init();

  const total = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  const byType = db.prepare('SELECT type, COUNT(*) as count FROM events GROUP BY type ORDER BY count DESC').all();
  const byDomain = db.prepare('SELECT domain, COUNT(*) as count FROM events GROUP BY domain ORDER BY count DESC').all();
  const byAgent = db.prepare('SELECT agent, COUNT(*) as count FROM events GROUP BY agent ORDER BY count DESC').all();
  const pending = db.prepare("SELECT COUNT(*) as count FROM events WHERE approval_status = 'pending'").get().count;

  return { total, byType, byDomain, byAgent, pendingApprovals: pending };
}

/**
 * Drop all data and rebuild from an event stream.
 */
export function rebuild(events) {
  if (!db) init();

  db.exec(`
    DELETE FROM events_fts;
    DELETE FROM event_tags;
    DELETE FROM event_relations;
    DELETE FROM events;
  `);

  indexEvents(events);
}

/**
 * Get the latest indexed timestamp.
 */
export function getLatestTimestamp() {
  if (!db) init();
  const row = db.prepare('SELECT MAX(timestamp) as ts FROM events').get();
  return row?.ts || null;
}

/**
 * Close the database connection.
 */
export function close() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Convert a database row to an event-like object.
 */
function rowToEvent(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    agent: row.agent,
    type: row.type,
    domain: row.domain,
    title: row.title,
    content: row.content,
    confidence: row.confidence,
    requires_approval: !!row.requires_approval,
    approval_status: row.approval_status,
    approved_by: row.approved_by,
    tags: row.tags_str ? row.tags_str.split(',') : [],
    source: row.source_channel ? { channelId: row.source_channel, postId: row.source_post } : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    // Extra fields from joins
    ...(row.rank !== undefined && { rank: row.rank }),
    ...(row.rel_type && { relationType: row.rel_type }),
    ...(row.rel_direction && { relationDirection: row.rel_direction }),
  };
}

export default {
  init,
  indexEvent,
  indexEvents,
  query,
  search,
  getRelated,
  getTimeline,
  getById,
  updateApproval,
  getStats,
  rebuild,
  getLatestTimestamp,
  close,
};
