/**
 * Loop Prevention - Prevents infinite agent reaction loops
 *
 * Rules:
 * 1. Self-event ignoring: agents never react to their own events
 * 2. Cooldown per agent: minimum time between reactions
 * 3. Same-type echo block: reaction cannot be same event type as trigger
 * 4. Depth limit: event causal chain cannot exceed max depth
 * 5. Dedup window: same agent + same title within window = skip
 */

// Agent cooldown tracking: agent -> last reaction timestamp
const agentCooldowns = new Map();

// Dedup tracking: "agent:title" -> timestamp of last emission
const dedupCache = new Map();

// Configuration defaults
const DEFAULT_CONFIG = {
  cooldownMs: 30000,        // 30 seconds between reactions per agent
  maxDepth: 3,              // Max causal chain depth
  dedupWindowMs: 300000,    // 5 minute dedup window
};

let config = { ...DEFAULT_CONFIG };

/**
 * Configure loop prevention parameters.
 */
export function configure(overrides) {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Check if an agent is allowed to react to a trigger event.
 *
 * @param {string} agent - The reacting agent's name
 * @param {Object} triggerEvent - The event being reacted to
 * @param {Object} proposedReaction - The event the agent wants to emit
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canReact(agent, triggerEvent, proposedReaction) {
  // Rule 1: Self-event ignoring
  if (triggerEvent.agent === agent) {
    return { allowed: false, reason: 'self-event' };
  }

  // Rule 2: Cooldown per agent
  const now = Date.now();
  const lastReaction = agentCooldowns.get(agent) || 0;
  if (now - lastReaction < config.cooldownMs) {
    const remainingMs = config.cooldownMs - (now - lastReaction);
    return { allowed: false, reason: `cooldown (${Math.ceil(remainingMs / 1000)}s remaining)` };
  }

  // Rule 3: Same-type echo block
  if (triggerEvent.type === proposedReaction.type) {
    return { allowed: false, reason: 'same-type-echo' };
  }

  // Rule 4: Depth limit
  const depth = getEventDepth(triggerEvent);
  if (depth >= config.maxDepth) {
    return { allowed: false, reason: `max-depth (${depth} >= ${config.maxDepth})` };
  }

  // Rule 5: Dedup window
  const dedupKey = `${agent}:${(proposedReaction.title || '').toLowerCase().trim()}`;
  const lastEmit = dedupCache.get(dedupKey) || 0;
  if (now - lastEmit < config.dedupWindowMs) {
    return { allowed: false, reason: 'duplicate-within-window' };
  }

  return { allowed: true, reason: null };
}

/**
 * Record that an agent has reacted (updates cooldown and dedup tracking).
 * Call this after successfully emitting a reaction event.
 */
export function recordReaction(agent, event) {
  const now = Date.now();
  agentCooldowns.set(agent, now);

  const dedupKey = `${agent}:${(event.title || '').toLowerCase().trim()}`;
  dedupCache.set(dedupKey, now);

  // Clean old dedup entries periodically
  if (dedupCache.size > 1000) {
    cleanDedupCache();
  }
}

/**
 * Get the causal depth of an event by examining its metadata.
 * Events track depth in metadata.depth (set by the emitter).
 */
export function getEventDepth(event) {
  return (event.metadata && typeof event.metadata.depth === 'number')
    ? event.metadata.depth
    : 0;
}

/**
 * Compute the metadata for a reaction event (increments depth, sets causedBy).
 */
export function buildReactionMetadata(triggerEvent, extraMetadata = {}) {
  return {
    causedBy: triggerEvent.id,
    depth: getEventDepth(triggerEvent) + 1,
    triggeredBy: triggerEvent.type,
    ...extraMetadata,
  };
}

/**
 * Clean expired entries from dedup cache.
 */
function cleanDedupCache() {
  const now = Date.now();
  for (const [key, ts] of dedupCache) {
    if (now - ts > config.dedupWindowMs) {
      dedupCache.delete(key);
    }
  }
}

/**
 * Reset all tracking state (for testing).
 */
export function reset() {
  agentCooldowns.clear();
  dedupCache.clear();
  config = { ...DEFAULT_CONFIG };
}

/**
 * Get current state (for debugging).
 */
export function getState() {
  return {
    config,
    agentCooldowns: Object.fromEntries(agentCooldowns),
    dedupCacheSize: dedupCache.size,
  };
}

export default {
  configure,
  canReact,
  recordReaction,
  getEventDepth,
  buildReactionMetadata,
  reset,
  getState,
};
