#!/usr/bin/env node

/**
 * Rebuild Script - Rebuilds SQLite + FTS5 index from JSONL event logs
 *
 * Usage:
 *   node rebuild.js              # Full rebuild
 *   node rebuild.js --stats      # Show stats only
 *   node rebuild.js --verify     # Rebuild and verify consistency
 */

import fs from 'fs';
import eventLog from './event-log.js';
import sqliteIndex from './sqlite-index.js';

const args = process.argv.slice(2);
const statsOnly = args.includes('--stats');
const verify = args.includes('--verify');

async function main() {
  console.log('Institutional Memory - Index Rebuild');
  console.log('====================================\n');

  // Init SQLite
  sqliteIndex.init();

  if (statsOnly) {
    const stats = sqliteIndex.getStats();
    console.log('Current index stats:');
    console.log(`  Total events: ${stats.total}`);
    console.log(`  By type: ${stats.byType.map(t => `${t.type}=${t.count}`).join(', ')}`);
    console.log(`  By domain: ${stats.byDomain.map(d => `${d.domain}=${d.count}`).join(', ')}`);
    console.log(`  By agent: ${stats.byAgent.map(a => `${a.agent}=${a.count}`).join(', ')}`);
    console.log(`  Pending approvals: ${stats.pendingApprovals}`);
    process.exit(0);
  }

  // Count JSONL events
  const files = eventLog.listEventFiles();
  console.log(`Found ${files.length} JSONL file(s)`);

  // Read all events
  console.log('Reading all events from JSONL...');
  const events = eventLog.readEvents();
  console.log(`  Read ${events.length} events\n`);

  if (events.length === 0) {
    console.log('No events to index. Done.');
    sqliteIndex.close();
    process.exit(0);
  }

  // Rebuild
  console.log('Rebuilding SQLite index...');
  const start = Date.now();
  sqliteIndex.rebuild(events);
  const elapsed = Date.now() - start;
  console.log(`  Rebuilt in ${elapsed}ms\n`);

  // Show stats
  const stats = sqliteIndex.getStats();
  console.log('Index stats after rebuild:');
  console.log(`  Total events: ${stats.total}`);
  console.log(`  By type: ${stats.byType.map(t => `${t.type}=${t.count}`).join(', ') || 'none'}`);
  console.log(`  By domain: ${stats.byDomain.map(d => `${d.domain}=${d.count}`).join(', ') || 'none'}`);
  console.log(`  By agent: ${stats.byAgent.map(a => `${a.agent}=${a.count}`).join(', ') || 'none'}`);
  console.log(`  Pending approvals: ${stats.pendingApprovals}`);

  // Verify
  if (verify) {
    console.log('\nVerifying consistency...');
    let ok = true;

    // Check event count matches
    if (stats.total !== events.length) {
      console.log(`  MISMATCH: JSONL has ${events.length} events, index has ${stats.total}`);
      ok = false;
    } else {
      console.log(`  Event count: OK (${stats.total})`);
    }

    // Check each event is findable
    let missing = 0;
    for (const event of events) {
      const found = sqliteIndex.getById(event.id);
      if (!found) {
        missing++;
        if (missing <= 5) {
          console.log(`  MISSING: ${event.id} (${event.type} - ${event.title})`);
        }
      }
    }

    if (missing > 0) {
      console.log(`  Missing events: ${missing}`);
      ok = false;
    } else {
      console.log(`  All events found in index: OK`);
    }

    // Test FTS5
    try {
      const ftsResults = sqliteIndex.search(events[0].title.split(' ')[0]);
      console.log(`  FTS5 search: OK (returned ${ftsResults.length} results)`);
    } catch (err) {
      console.log(`  FTS5 search: FAILED - ${err.message}`);
      ok = false;
    }

    console.log(`\nVerification: ${ok ? 'PASSED' : 'FAILED'}`);
  }

  sqliteIndex.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Rebuild failed:', err);
  process.exit(1);
});
