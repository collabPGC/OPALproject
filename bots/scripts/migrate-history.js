#!/usr/bin/env node
/**
 * Migration Script - Index existing bot history into semantic memory
 *
 * Reads all history.json files from bot-memory and indexes into:
 *   - Vector store (LanceDB) for semantic search
 *   - Graph store (Graphology) for entity relationships
 *
 * Run once: node migrate-history.js
 */

import fs from 'fs';
import path from 'path';
import memory from '../shared/memory.js';

const MEMORY_ROOT = '/opt/mattermost/bot-memory';
const BATCH_SIZE = 50; // Messages per batch to avoid memory issues

async function getChannelDirs() {
  const channelsDir = path.join(MEMORY_ROOT, 'channels');
  if (!fs.existsSync(channelsDir)) {
    console.error('No channels directory found at:', channelsDir);
    return [];
  }

  return fs.readdirSync(channelsDir)
    .filter(name => {
      const stat = fs.statSync(path.join(channelsDir, name));
      return stat.isDirectory();
    });
}

function loadHistory(channelId) {
  const historyPath = path.join(MEMORY_ROOT, 'channels', channelId, 'history.json');
  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Failed to load history for ${channelId}:`, err.message);
    return [];
  }
}

function loadChannelContext(channelId) {
  const contextPath = path.join(MEMORY_ROOT, 'channels', channelId, 'context.yaml');
  // Just return channel ID as name if no context exists
  return { name: channelId };
}

async function migrateChannel(channelId, channelName) {
  const history = loadHistory(channelId);

  if (history.length === 0) {
    console.log(`  Skipping ${channelId} - no history`);
    return { channelId, indexed: 0, skipped: 0 };
  }

  console.log(`  Processing ${channelId}: ${history.length} messages`);

  // Filter valid messages (skip bots, short messages)
  const validMessages = history.filter(msg => {
    if (!msg.content || msg.content.length < 10) return false;
    if (msg.role === 'assistant') return false; // Skip bot responses
    if (msg.userId?.includes('bot')) return false;
    if (msg.username?.toLowerCase().includes('bot')) return false;
    return true;
  });

  console.log(`    Valid messages: ${validMessages.length} / ${history.length}`);

  if (validMessages.length === 0) {
    return { channelId, indexed: 0, skipped: history.length };
  }

  // Convert to memory format
  const messages = validMessages.map(msg => ({
    text: msg.content,
    channelId: channelId,
    channelName: channelName || channelId,
    userId: msg.userId || 'unknown',
    userName: msg.username || 'unknown',
    messageId: msg.id || `migrated-${msg.timestamp}-${Math.random().toString(36).slice(2)}`,
    timestamp: msg.timestamp || Date.now()
  }));

  // Index in batches
  let totalIndexed = 0;
  let totalGraphEdges = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const result = await memory.indexMessages(batch);
    totalIndexed += result.indexed || 0;
    totalGraphEdges += result.graphEdges || 0;

    const progress = Math.min(i + BATCH_SIZE, messages.length);
    process.stdout.write(`\r    Indexed: ${progress}/${messages.length}`);
  }

  console.log(`\n    Done: ${totalIndexed} indexed, ${totalGraphEdges} graph edges`);

  return {
    channelId,
    indexed: totalIndexed,
    skipped: history.length - validMessages.length,
    graphEdges: totalGraphEdges
  };
}

async function main() {
  console.log('=== Bot History Migration ===\n');
  console.log('Source:', MEMORY_ROOT);
  console.log('Target: Semantic Memory (Vector + Graph)\n');

  // Initialize memory system
  console.log('Initializing memory system...');
  await memory.init();
  console.log('Memory system ready.\n');

  // Get all channels
  const channels = await getChannelDirs();
  console.log(`Found ${channels.length} channels to migrate.\n`);

  if (channels.length === 0) {
    console.log('No channels to migrate.');
    return;
  }

  // Migrate each channel
  const results = [];
  for (const channelId of channels) {
    const context = loadChannelContext(channelId);
    const result = await migrateChannel(channelId, context.name);
    results.push(result);
  }

  // Summary
  console.log('\n=== Migration Summary ===\n');

  let totalIndexed = 0;
  let totalSkipped = 0;
  let totalGraphEdges = 0;

  for (const r of results) {
    if (r.indexed > 0) {
      console.log(`${r.channelId}: ${r.indexed} indexed, ${r.skipped} skipped`);
    }
    totalIndexed += r.indexed || 0;
    totalSkipped += r.skipped || 0;
    totalGraphEdges += r.graphEdges || 0;
  }

  console.log(`\nTotal: ${totalIndexed} messages indexed, ${totalSkipped} skipped`);
  console.log(`Graph: ${totalGraphEdges} relationship edges created`);

  // Final stats
  console.log('\n=== Final Memory Stats ===\n');
  const stats = await memory.getStats();
  console.log('Documents:', stats.documents);
  console.log('Conversations:', stats.conversations);
  console.log('Graph:', stats.graph);

  // Force save graph
  await memory.graph.forceSave();
  console.log('\nMigration complete!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
