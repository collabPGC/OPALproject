/**
 * Graph Store - Entity relationships using Graphology
 *
 * Stores knowledge graph as nodes (entities) and edges (relationships).
 * Persisted to JSON file for robustness.
 * Storage: /mnt/volume_nyc3_01/graphdb/knowledge.json
 */

import Graph from 'graphology';
import { bfsFromNode } from 'graphology-traversal';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

// Configuration
const GRAPH_PATH = '/mnt/volume_nyc3_01/graphdb/knowledge.json';
const SAVE_DEBOUNCE_MS = 5000; // Batch saves

// Relationship types
export const RELATIONS = {
  MENTIONED: 'mentioned',
  DISCUSSED_IN: 'discussed_in',
  DECIDED: 'decided',
  RELATES_TO: 'relates_to',
  ASSIGNED_TO: 'assigned_to',
  CREATED_BY: 'created_by',
  PART_OF: 'part_of'
};

// Entity type prefixes for node IDs
export const ENTITY = {
  PERSON: 'person:',
  CHANNEL: 'channel:',
  TOPIC: 'topic:',
  DECISION: 'decision:',
  MESSAGE: 'message:'
};

// Singleton
let graph = null;
let saveTimer = null;
let initialized = false;

/**
 * Initialize the graph store (load from JSON or create new)
 */
export async function init(logger = console) {
  if (initialized) return true;

  try {
    const data = await readFile(GRAPH_PATH, 'utf-8');
    const json = JSON.parse(data);
    graph = Graph.from(json);
    logger.log?.('info', 'GraphStore loaded', { nodes: graph.order, edges: graph.size }) ||
      console.log(`[GraphStore] Loaded: ${graph.order} nodes, ${graph.size} edges`);
  } catch (err) {
    // File doesn't exist or is invalid - create new graph
    graph = new Graph({ multi: true }); // Allow multiple edges between nodes
    logger.log?.('info', 'GraphStore created new graph') ||
      console.log('[GraphStore] Created new graph');
  }

  initialized = true;
  return true;
}

/**
 * Save graph to JSON (debounced)
 */
async function save() {
  if (!graph) return;

  // Debounce saves
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await mkdir(dirname(GRAPH_PATH), { recursive: true });
      const json = graph.export();
      await writeFile(GRAPH_PATH, JSON.stringify(json, null, 2));
    } catch (err) {
      console.error('[GraphStore] Save failed:', err.message);
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Force immediate save
 */
export async function forceSave() {
  if (!graph) return;
  if (saveTimer) clearTimeout(saveTimer);
  await mkdir(dirname(GRAPH_PATH), { recursive: true });
  const json = graph.export();
  await writeFile(GRAPH_PATH, JSON.stringify(json, null, 2));
}

/**
 * Add or update a node (entity)
 */
export function addNode(id, attributes = {}) {
  if (!initialized) throw new Error('GraphStore not initialized');

  if (!graph.hasNode(id)) {
    graph.addNode(id, { ...attributes, createdAt: Date.now() });
  } else {
    graph.mergeNodeAttributes(id, attributes);
  }
  save();
  return id;
}

/**
 * Add an edge (relationship) between two nodes
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID
 * @param {string} relation - Relationship type
 * @param {Object} attributes - Edge metadata
 */
export function addEdge(source, target, relation, attributes = {}) {
  if (!initialized) throw new Error('GraphStore not initialized');

  // Ensure nodes exist
  if (!graph.hasNode(source)) graph.addNode(source, { createdAt: Date.now() });
  if (!graph.hasNode(target)) graph.addNode(target, { createdAt: Date.now() });

  // Generate unique edge ID with random suffix
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const edgeId = `${source}|${relation}|${target}|${Date.now()}_${randomSuffix}`;

  try {
    graph.addEdgeWithKey(edgeId, source, target, {
      relation,
      ...attributes,
      createdAt: Date.now()
    });
    save();
    return edgeId;
  } catch (err) {
    // Edge already exists or other error - silently skip duplicates
    if (err.message?.includes('already exists')) {
      return null;
    }
    throw err;
  }
}

/**
 * Find all edges from/to a node
 */
export function getRelationships(nodeId) {
  if (!initialized || !graph.hasNode(nodeId)) return { outgoing: [], incoming: [] };

  const outgoing = graph.outEdges(nodeId).map(e => ({
    id: e,
    target: graph.target(e),
    ...graph.getEdgeAttributes(e)
  }));

  const incoming = graph.inEdges(nodeId).map(e => ({
    id: e,
    source: graph.source(e),
    ...graph.getEdgeAttributes(e)
  }));

  return { outgoing, incoming };
}

/**
 * Find path between two nodes using BFS
 */
export function findPath(from, to, maxDepth = 4) {
  if (!initialized) return null;
  if (!graph.hasNode(from) || !graph.hasNode(to)) return null;

  const visited = new Map();
  visited.set(from, null);

  let found = false;
  bfsFromNode(graph, from, (node, attr, depth) => {
    if (depth > maxDepth) return true; // Stop traversal

    for (const neighbor of graph.neighbors(node)) {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, node);
        if (neighbor === to) {
          found = true;
          return true; // Stop traversal
        }
      }
    }
  });

  if (!found) return null;

  // Reconstruct path
  const path = [];
  let current = to;
  while (current !== from) {
    const prev = visited.get(current);
    const edges = graph.edges(prev, current);
    if (edges.length > 0) {
      path.unshift({
        from: prev,
        to: current,
        ...graph.getEdgeAttributes(edges[0])
      });
    }
    current = prev;
  }

  return path;
}

/**
 * Query nodes by type prefix
 */
export function getNodesByType(typePrefix) {
  if (!initialized) return [];
  return graph.filterNodes((node) => node.startsWith(typePrefix));
}

/**
 * Extract entities from message and add to graph
 * @param {Object} message - Message with text, userId, userName, channelId, channelName
 */
export function extractAndStore(message, logger = console) {
  if (!initialized) throw new Error('GraphStore not initialized');

  const { text, userId, userName, channelId, channelName, messageId } = message;
  let edgesAdded = 0;

  const personId = `${ENTITY.PERSON}${userId}`;
  const channelNodeId = `${ENTITY.CHANNEL}${channelId}`;

  // Ensure person and channel exist
  addNode(personId, { name: userName, type: 'person' });
  addNode(channelNodeId, { name: channelName, type: 'channel' });

  // Extract @mentions
  const mentions = text.match(/@(\w+)/g) || [];
  for (const mention of mentions) {
    const mentionedId = `${ENTITY.PERSON}${mention.substring(1)}`;
    addNode(mentionedId, { type: 'person' });
    addEdge(personId, mentionedId, RELATIONS.MENTIONED, { messageId, channelId });
    edgesAdded++;
  }

  // Extract topics (hashtags, ALL_CAPS words)
  const topics = text.match(/(?:#\w+|\b[A-Z][A-Z0-9_]{2,}\b)/g) || [];
  for (const topic of topics) {
    const topicId = `${ENTITY.TOPIC}${topic.replace('#', '').toLowerCase()}`;
    addNode(topicId, { name: topic, type: 'topic' });
    addEdge(personId, topicId, RELATIONS.MENTIONED, { messageId, channelId });
    addEdge(topicId, channelNodeId, RELATIONS.DISCUSSED_IN, { messageId });
    edgesAdded += 2;
  }

  // Detect decisions
  const decisionMatch = text.match(/(?:decided? to|let'?s go with|we'?ll use|approved)\s+(.+?)(?:\.|,|$)/i);
  if (decisionMatch) {
    const decisionId = `${ENTITY.DECISION}${messageId}`;
    addNode(decisionId, { detail: decisionMatch[1].trim(), type: 'decision' });
    addEdge(personId, decisionId, RELATIONS.DECIDED, { channelId });
    edgesAdded++;
  }

  if (edgesAdded > 0) {
    logger.log?.('debug', 'Extracted relationships', { messageId, edges: edgesAdded }) ||
      console.log(`[GraphStore] Extracted ${edgesAdded} relationships`);
  }

  return { extracted: edgesAdded };
}

/**
 * Get all topics discussed by a person
 */
export function getPersonTopics(userId) {
  const personId = userId.startsWith(ENTITY.PERSON) ? userId : `${ENTITY.PERSON}${userId}`;
  const rels = getRelationships(personId);

  return rels.outgoing
    .filter(e => e.relation === RELATIONS.MENTIONED && e.target.startsWith(ENTITY.TOPIC))
    .map(e => e.target.replace(ENTITY.TOPIC, ''));
}

/**
 * Get all topics discussed in a channel
 */
export function getChannelTopics(channelId) {
  const channelNodeId = channelId.startsWith(ENTITY.CHANNEL) ? channelId : `${ENTITY.CHANNEL}${channelId}`;
  const rels = getRelationships(channelNodeId);

  return rels.incoming
    .filter(e => e.relation === RELATIONS.DISCUSSED_IN)
    .map(e => e.source.replace(ENTITY.TOPIC, ''));
}

/**
 * Get graph statistics
 */
export function getStats() {
  if (!initialized) return { nodes: 0, edges: 0 };

  const byType = {};
  graph.forEachNode((node) => {
    const type = node.split(':')[0];
    byType[type] = (byType[type] || 0) + 1;
  });

  const byRelation = {};
  graph.forEachEdge((edge, attrs) => {
    byRelation[attrs.relation] = (byRelation[attrs.relation] || 0) + 1;
  });

  return {
    nodes: graph.order,
    edges: graph.size,
    byType,
    byRelation
  };
}

export default {
  init,
  forceSave,
  addNode,
  addEdge,
  getRelationships,
  findPath,
  getNodesByType,
  extractAndStore,
  getPersonTopics,
  getChannelTopics,
  getStats,
  RELATIONS,
  ENTITY
};
