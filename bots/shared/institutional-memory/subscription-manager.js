/**
 * Subscription Manager - Pattern-based event routing for agent coordination
 *
 * Agents subscribe to event patterns. When matching events are emitted,
 * the subscription handler fires. Supports cooldowns and agent exclusions.
 */

import { randomUUID } from 'crypto';

const subscriptions = new Map();

/**
 * Subscribe to events matching a pattern.
 *
 * @param {Object} pattern
 * @param {string[]} [pattern.types] - Match any of these event types
 * @param {string[]} [pattern.domains] - Match any of these domains
 * @param {string[]} [pattern.agents] - Match any of these agents (null = any)
 * @param {string[]} [pattern.excludeAgents] - Exclude events from these agents
 * @param {string[]} [pattern.tags] - Match any of these tags
 * @param {Function} handler - async (event) => void
 * @param {Object} [options]
 * @param {string} [options.subscriber] - Name of the subscribing agent
 * @param {number} [options.cooldownMs] - Min time between handler calls (default 30000)
 * @returns {string} Subscription ID
 */
export function subscribe(pattern, handler, options = {}) {
  const id = `sub_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  subscriptions.set(id, {
    id,
    subscriber: options.subscriber || 'unknown',
    pattern: {
      types: pattern.types || null,
      domains: pattern.domains || null,
      agents: pattern.agents || null,
      excludeAgents: pattern.excludeAgents || [],
      tags: pattern.tags || null,
    },
    handler,
    cooldownMs: options.cooldownMs ?? 30000,
    lastFired: 0,
    fireCount: 0,
  });

  return id;
}

/**
 * Unsubscribe by ID.
 */
export function unsubscribe(id) {
  return subscriptions.delete(id);
}

/**
 * Unsubscribe all subscriptions for a given subscriber.
 */
export function unsubscribeAll(subscriber) {
  for (const [id, sub] of subscriptions) {
    if (sub.subscriber === subscriber) {
      subscriptions.delete(id);
    }
  }
}

/**
 * Check if an event matches a subscription pattern.
 */
export function matchEvent(event, pattern) {
  // Type filter
  if (pattern.types && !pattern.types.includes(event.type)) {
    return false;
  }

  // Domain filter
  if (pattern.domains && !pattern.domains.includes(event.domain)) {
    return false;
  }

  // Agent inclusion filter
  if (pattern.agents && !pattern.agents.includes(event.agent)) {
    return false;
  }

  // Agent exclusion filter
  if (pattern.excludeAgents && pattern.excludeAgents.includes(event.agent)) {
    return false;
  }

  // Tag filter (match any)
  if (pattern.tags && pattern.tags.length > 0) {
    const eventTags = event.tags || [];
    if (!pattern.tags.some(t => eventTags.includes(t))) {
      return false;
    }
  }

  return true;
}

/**
 * Fire all matching subscriptions for an event.
 * Respects cooldowns. Returns array of { subscriptionId, subscriber, fired, reason }.
 */
export async function fireSubscriptions(event, logger) {
  const results = [];
  const now = Date.now();

  for (const [id, sub] of subscriptions) {
    // Check pattern match
    if (!matchEvent(event, sub.pattern)) {
      continue;
    }

    // Check cooldown
    if (now - sub.lastFired < sub.cooldownMs) {
      results.push({
        subscriptionId: id,
        subscriber: sub.subscriber,
        fired: false,
        reason: 'cooldown',
      });
      continue;
    }

    // Fire handler
    try {
      sub.lastFired = now;
      sub.fireCount++;
      await sub.handler(event);
      results.push({
        subscriptionId: id,
        subscriber: sub.subscriber,
        fired: true,
        reason: null,
      });
    } catch (error) {
      if (logger) {
        logger('error', 'Subscription handler failed', {
          subscriptionId: id,
          subscriber: sub.subscriber,
          eventId: event.id,
          error: error.message,
        });
      }
      results.push({
        subscriptionId: id,
        subscriber: sub.subscriber,
        fired: false,
        reason: `error: ${error.message}`,
      });
    }
  }

  return results;
}

/**
 * Get all active subscriptions (for debugging).
 */
export function listSubscriptions() {
  return [...subscriptions.values()].map(sub => ({
    id: sub.id,
    subscriber: sub.subscriber,
    pattern: sub.pattern,
    cooldownMs: sub.cooldownMs,
    lastFired: sub.lastFired,
    fireCount: sub.fireCount,
  }));
}

/**
 * Get subscription count.
 */
export function getSubscriptionCount() {
  return subscriptions.size;
}

/**
 * Clear all subscriptions.
 */
export function clearAll() {
  subscriptions.clear();
}

export default {
  subscribe,
  unsubscribe,
  unsubscribeAll,
  matchEvent,
  fireSubscriptions,
  listSubscriptions,
  getSubscriptionCount,
  clearAll,
};
