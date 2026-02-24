/**
 * Observation Mode - Passive conversation tracking for the GTM advisory board
 *
 * Watches conversations even when not mentioned, extracts topics,
 * notes gaps, and stores observations for daily digest.
 */

import { DOMAIN_FRAMEWORKS } from './domain-frameworks.js';

// Channel weight categories
export const CHANNEL_WEIGHT = {
  AUTHORITATIVE: 'authoritative', // Data room, decisions - high confidence
  OPERATIONAL: 'operational',     // Day-to-day work - medium confidence
  EXPLORATORY: 'exploratory',     // Brainstorming - low confidence, flagged
};

// Observation state
const state = {
  // Ring buffer of recent messages per channel
  messageBuffer: new Map(), // channelId -> [{message, userId, timestamp, topics, weight}]

  // Topics detected in recent conversations
  topicsDiscussed: new Map(), // topic -> {count, lastSeen, channelIds}

  // Gaps noted during observation (for digest)
  observedGaps: [],

  // Noteworthy items per persona
  noteworthyItems: new Map(), // personaKey -> [{observation, timestamp, channelId, type, weight}]

  // Channels being observed with their weights
  observedChannels: new Map(), // channelId -> { name, weight, addedBy, addedAt }

  // Configuration
  config: {
    bufferWindowHours: 24,
    maxBufferPerChannel: 100,
    topicDecayHours: 48,
    maxNoteworthyPerPersona: 20,
  },
};

// Topic extraction patterns (fast, rule-based)
const TOPIC_PATTERNS = {
  pricing: /pric(e|ing)|cost|margin|\$\d|revenue model/i,
  product: /feature|mvp|roadmap|user story|sprint|backlog/i,
  marketing: /launch|campaign|audience|content|social media|pr\b/i,
  regulatory: /fda|fcc|ce mark|certification|compliance|regulatory/i,
  finance: /runway|burn|fundrais|investor|valuation|series [a-c]/i,
  competitive: /competitor|vs\.?|alternative|differentiat|market share/i,
  timeline: /deadline|launch date|milestone|q[1-4]|by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  technical: /architect|api|integration|system design|scalab/i,
  security: /hipaa|security|privacy|encrypt|auth|access control/i,
  clinical: /clinical|clinician|physician|nurse|patient|workflow/i,
  ai_ml: /ml\b|machine learning|model|inference|training|ai\b/i,
  ehr: /ehr|emr|epic|cerner|fhir|hl7|interop/i,
  cloud: /aws|azure|gcp|cloud|kubernetes|serverless/i,
  manufacturing: /supply chain|manufacturing|factory|bom|3pl/i,
};

// Gap trigger patterns (things that suggest missing context)
const GAP_TRIGGERS = [
  { pattern: /how (do|should|would) we/i, type: 'question', severity: 'medium' },
  { pattern: /we (haven't|havent|don't|dont) have/i, type: 'missing', severity: 'high' },
  { pattern: /need to (figure out|decide|determine)/i, type: 'undecided', severity: 'high' },
  { pattern: /not sure (about|how|what|if)/i, type: 'uncertainty', severity: 'medium' },
  { pattern: /anyone know/i, type: 'question', severity: 'low' },
  { pattern: /what('s| is) our (strategy|approach|plan) for/i, type: 'missing-strategy', severity: 'high' },
  { pattern: /who('s| is) (responsible|handling|owning)/i, type: 'ownership', severity: 'high' },
  { pattern: /deadline|by when|timeline for/i, type: 'timeline', severity: 'medium' },
];

/**
 * Initialize observation mode with config.
 */
export function init(config = {}) {
  if (config.bufferWindowHours) state.config.bufferWindowHours = config.bufferWindowHours;
  if (config.maxBufferPerChannel) state.config.maxBufferPerChannel = config.maxBufferPerChannel;
  if (config.topicDecayHours) state.config.topicDecayHours = config.topicDecayHours;

  // Load observed channels from config
  if (config.channels) {
    for (const ch of config.channels) {
      state.observedChannels.set(ch.id, {
        name: ch.name,
        weight: ch.weight || CHANNEL_WEIGHT.OPERATIONAL,
        addedBy: 'config',
        addedAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * Check if a channel is being observed.
 */
export function isObserving(channelId) {
  return state.observedChannels.has(channelId);
}

/**
 * Add a channel to observation.
 */
export function addChannel(channelId, name, weight = CHANNEL_WEIGHT.OPERATIONAL, addedBy = 'unknown') {
  state.observedChannels.set(channelId, {
    name,
    weight,
    addedBy,
    addedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Remove a channel from observation.
 */
export function removeChannel(channelId) {
  return state.observedChannels.delete(channelId);
}

/**
 * Get channel weight.
 */
export function getChannelWeight(channelId) {
  const ch = state.observedChannels.get(channelId);
  return ch?.weight || null;
}

/**
 * List all observed channels.
 */
export function listObservedChannels() {
  const channels = [];
  for (const [id, info] of state.observedChannels.entries()) {
    channels.push({ id, ...info });
  }
  return channels;
}

/**
 * Observe a message (called for every message, not just mentions).
 */
export function observeMessage(post, channelId, userId) {
  // Only observe whitelisted channels
  if (!state.observedChannels.has(channelId)) {
    return;
  }

  const channelInfo = state.observedChannels.get(channelId);
  const weight = channelInfo.weight;
  const message = post.message || '';
  const timestamp = Date.now();

  // Skip very short messages
  if (message.length < 10) return;

  // 1. Extract topics
  const topics = extractTopics(message);

  // 2. Add to message buffer
  addToBuffer(channelId, {
    message: message.slice(0, 500), // Truncate for storage
    userId,
    timestamp,
    topics,
    weight,
  });

  // 3. Update topic tracker
  for (const topic of topics) {
    updateTopicTracker(topic, channelId);
  }

  // 4. Check for gaps
  const gaps = detectGaps(message, topics);
  if (gaps.length > 0) {
    for (const gap of gaps) {
      addObservedGap({
        ...gap,
        channelId,
        channelName: channelInfo.name,
        weight,
        messagePreview: message.slice(0, 200),
        timestamp,
      });
    }
  }

  // 5. Check persona relevance
  checkPersonaRelevance(message, topics, channelId, timestamp, weight);
}

/**
 * Extract topics from message text (fast, rule-based).
 */
function extractTopics(text) {
  const topics = [];
  const lower = text.toLowerCase();

  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(lower)) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Add message to channel buffer.
 */
function addToBuffer(channelId, entry) {
  if (!state.messageBuffer.has(channelId)) {
    state.messageBuffer.set(channelId, []);
  }

  const buffer = state.messageBuffer.get(channelId);
  buffer.push(entry);

  // Trim to max size
  while (buffer.length > state.config.maxBufferPerChannel) {
    buffer.shift();
  }

  // Remove old entries
  const cutoff = Date.now() - (state.config.bufferWindowHours * 60 * 60 * 1000);
  while (buffer.length > 0 && buffer[0].timestamp < cutoff) {
    buffer.shift();
  }
}

/**
 * Update topic frequency tracker.
 */
function updateTopicTracker(topic, channelId) {
  if (!state.topicsDiscussed.has(topic)) {
    state.topicsDiscussed.set(topic, {
      count: 0,
      lastSeen: null,
      channelIds: new Set(),
    });
  }

  const tracker = state.topicsDiscussed.get(topic);
  tracker.count++;
  tracker.lastSeen = Date.now();
  tracker.channelIds.add(channelId);
}

/**
 * Detect gaps in message based on patterns.
 */
function detectGaps(message, topics) {
  const gaps = [];

  for (const trigger of GAP_TRIGGERS) {
    const match = message.match(trigger.pattern);
    if (match) {
      gaps.push({
        type: trigger.type,
        severity: trigger.severity,
        matchedText: match[0],
        relatedTopics: topics,
      });
    }
  }

  return gaps;
}

/**
 * Add an observed gap.
 */
function addObservedGap(gap) {
  state.observedGaps.push(gap);

  // Keep only recent gaps
  const cutoff = Date.now() - (48 * 60 * 60 * 1000); // 48 hours
  state.observedGaps = state.observedGaps.filter(g => g.timestamp > cutoff);

  // Limit total
  if (state.observedGaps.length > 100) {
    state.observedGaps = state.observedGaps.slice(-100);
  }
}

/**
 * Check if message is relevant to specific personas and note it.
 */
function checkPersonaRelevance(message, topics, channelId, timestamp, weight) {
  for (const [personaKey, framework] of Object.entries(DOMAIN_FRAMEWORKS)) {
    // Check if any topic matches this persona's patterns
    for (const pattern of framework.topicPatterns || []) {
      if (pattern.pattern.test(message)) {
        addNoteworthyItem(personaKey, {
          type: 'topic_match',
          category: pattern.category,
          messagePreview: message.slice(0, 150),
          channelId,
          timestamp,
          weight,
        });
        break; // Only one noteworthy item per persona per message
      }
    }
  }
}

/**
 * Add a noteworthy item for a persona.
 */
function addNoteworthyItem(personaKey, item) {
  if (!state.noteworthyItems.has(personaKey)) {
    state.noteworthyItems.set(personaKey, []);
  }

  const items = state.noteworthyItems.get(personaKey);
  items.push(item);

  // Limit per persona
  while (items.length > state.config.maxNoteworthyPerPersona) {
    items.shift();
  }
}

/**
 * Get top topics discussed recently.
 */
export function getTopTopics(limit = 10) {
  const cutoff = Date.now() - (state.config.topicDecayHours * 60 * 60 * 1000);

  const topics = [];
  for (const [topic, tracker] of state.topicsDiscussed.entries()) {
    if (tracker.lastSeen > cutoff) {
      topics.push({
        name: topic,
        count: tracker.count,
        lastSeen: tracker.lastSeen,
        channelCount: tracker.channelIds.size,
      });
    }
  }

  // Sort by count descending
  topics.sort((a, b) => b.count - a.count);

  return topics.slice(0, limit);
}

/**
 * Get observed gaps.
 */
export function getObservedGaps(options = {}) {
  const { severity, limit = 20, since } = options;

  let gaps = [...state.observedGaps];

  if (severity) {
    gaps = gaps.filter(g => g.severity === severity);
  }

  if (since) {
    gaps = gaps.filter(g => g.timestamp > since);
  }

  // Sort by severity then timestamp
  const severityOrder = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    if (sevDiff !== 0) return sevDiff;
    return b.timestamp - a.timestamp;
  });

  return gaps.slice(0, limit);
}

/**
 * Get noteworthy items for a persona.
 */
export function getNoteworthyItems(personaKey) {
  return state.noteworthyItems.get(personaKey) || [];
}

/**
 * Get and clear noteworthy items (for digest).
 */
export function getAndClearNoteworthyItems() {
  const items = new Map(state.noteworthyItems);
  state.noteworthyItems.clear();
  return items;
}

/**
 * Get recent messages for a channel.
 */
export function getRecentMessages(channelId, limit = 20) {
  const buffer = state.messageBuffer.get(channelId) || [];
  return buffer.slice(-limit);
}

/**
 * Get observation summary for digest.
 */
export function getSummary() {
  return {
    topTopics: getTopTopics(5),
    gapCount: state.observedGaps.length,
    highSeverityGaps: state.observedGaps.filter(g => g.severity === 'high').length,
    channelsObserved: state.messageBuffer.size,
    messagesTracked: Array.from(state.messageBuffer.values()).reduce((sum, buf) => sum + buf.length, 0),
  };
}

/**
 * Clear all observation state (for testing).
 */
export function clearState() {
  state.messageBuffer.clear();
  state.topicsDiscussed.clear();
  state.observedGaps = [];
  state.noteworthyItems.clear();
}

export default {
  init,
  observeMessage,
  isObserving,
  addChannel,
  removeChannel,
  getChannelWeight,
  listObservedChannels,
  getTopTopics,
  getObservedGaps,
  getNoteworthyItems,
  getAndClearNoteworthyItems,
  getRecentMessages,
  getSummary,
  clearState,
  CHANNEL_WEIGHT,
};
