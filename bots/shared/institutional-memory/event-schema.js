/**
 * Event Schema - MECE taxonomy for institutional memory events
 *
 * Event types are Mutually Exclusive, Collectively Exhaustive:
 * every organizational event fits exactly one category.
 */

import { randomUUID } from 'crypto';

// Event types (MECE)
export const EVENT_TYPE = {
  DECISION:       'DECISION',       // Strategic/tactical decisions made
  DEBATE:         'DEBATE',         // Arguments, counter-arguments, positions
  PREDICTION:     'PREDICTION',     // Forecasts with confidence and timeframe
  OUTCOME:        'OUTCOME',        // Results of predictions/actions (for calibration)
  ACTION:         'ACTION',         // Tasks, assignments, follow-ups
  INSIGHT:        'INSIGHT',        // Novel observations, connections, patterns
  ARTIFACT:       'ARTIFACT',       // Documents, reports, deliverables created
  MEETING:        'MEETING',        // Meeting notes, standups, reviews
  CONTEXT_CHANGE: 'CONTEXT_CHANGE', // Market shifts, team changes, pivots
  // New types for proactive advisory
  OBJECTIVE:      'OBJECTIVE',      // Company-level objective defined/updated
  INITIATIVE:     'INITIATIVE',     // Initiative/project created/updated/completed
  GAP:            'GAP',            // Gap identified in a domain
  OBSERVATION:    'OBSERVATION',    // Passive observation worth noting
  DIGEST:         'DIGEST',         // Daily/periodic digest summary
};

// Domains (MECE)
export const DOMAIN = {
  // Business domains
  STRATEGY:           'strategy',
  PRODUCT:            'product',
  GTM:                'gtm',
  FINANCE:            'finance',
  COMPLIANCE:         'compliance',
  OPERATIONS:         'operations',
  // Technical domains
  ENGINEERING:        'engineering',
  HEALTHCARE_SYSTEMS: 'healthcare-systems',
  SECURITY:           'security',
  INFRASTRUCTURE:     'infrastructure',
  HEALTHCARE_INDUSTRY:'healthcare-industry',
  CLINICAL:           'clinical',
  AI_ML:              'ai-ml',
  REGULATORY:         'regulatory',
};

// Relation types between events
export const RELATION_TYPE = {
  FOLLOWS_FROM: 'FOLLOWS_FROM', // Causal chain: this event follows from another
  REACTS_TO:    'REACTS_TO',    // Agent reaction to an event
  SUPERSEDES:   'SUPERSEDES',   // This event replaces a previous one
  SUPPORTS:     'SUPPORTS',     // This event supports/reinforces another
  CONTRADICTS:  'CONTRADICTS',  // This event contradicts another
};

const VALID_TYPES = new Set(Object.values(EVENT_TYPE));
const VALID_DOMAINS = new Set(Object.values(DOMAIN));
const VALID_RELATION_TYPES = new Set(Object.values(RELATION_TYPE));

/**
 * Generate a unique event ID
 */
export function generateEventId() {
  return `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Validate and normalize an event object.
 * Returns { valid: true, event } or { valid: false, errors: [] }
 */
export function validateEvent(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Event must be an object'] };
  }

  // Required fields
  if (!input.agent || typeof input.agent !== 'string') {
    errors.push('agent is required and must be a string');
  }
  if (!input.type || !VALID_TYPES.has(input.type)) {
    errors.push(`type must be one of: ${[...VALID_TYPES].join(', ')}`);
  }
  if (!input.domain || !VALID_DOMAINS.has(input.domain)) {
    errors.push(`domain must be one of: ${[...VALID_DOMAINS].join(', ')}`);
  }
  if (!input.title || typeof input.title !== 'string') {
    errors.push('title is required and must be a string');
  }
  if (input.title && input.title.length > 200) {
    errors.push('title must be 200 characters or fewer');
  }

  // Validate relations if present
  if (input.relations) {
    if (!Array.isArray(input.relations)) {
      errors.push('relations must be an array');
    } else {
      for (let i = 0; i < input.relations.length; i++) {
        const rel = input.relations[i];
        if (!rel.type || !VALID_RELATION_TYPES.has(rel.type)) {
          errors.push(`relations[${i}].type must be one of: ${[...VALID_RELATION_TYPES].join(', ')}`);
        }
        if (!rel.targetId || typeof rel.targetId !== 'string') {
          errors.push(`relations[${i}].targetId is required`);
        }
      }
    }
  }

  // Validate confidence if present
  if (input.confidence !== undefined && input.confidence !== null) {
    if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
      errors.push('confidence must be a number between 0.0 and 1.0');
    }
  }

  // Validate tags if present
  if (input.tags && !Array.isArray(input.tags)) {
    errors.push('tags must be an array of strings');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build normalized event
  const event = {
    id: input.id || generateEventId(),
    timestamp: input.timestamp || new Date().toISOString(),
    agent: input.agent,
    type: input.type,
    domain: input.domain,
    title: input.title.trim(),
    content: (input.content || '').trim(),
    relations: input.relations || [],
    tags: (input.tags || []).map(t => String(t).toLowerCase().trim()).filter(Boolean),
    confidence: input.confidence ?? null,
    requires_approval: input.requires_approval || false,
    approval_status: input.requires_approval ? 'pending' : null,
    approved_by: input.approved_by || null,
    source: input.source || null,
    metadata: input.metadata || {},
  };

  return { valid: true, event };
}

export default {
  EVENT_TYPE,
  DOMAIN,
  RELATION_TYPE,
  generateEventId,
  validateEvent,
};
