/**
 * Company State Model - Tracks organizational objectives, initiatives, and domain status
 *
 * Persists to JSON file for durability across restarts.
 * Used by daily digest to understand current company context.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const STATE_FILE = '/mnt/volume_nyc3_01/institutional-memory/company-state.json';

// Default state structure
const DEFAULT_STATE = {
  objectives: [],
  initiatives: [],
  domainStatus: {
    strategy: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    product: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    gtm: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    finance: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    compliance: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    operations: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    engineering: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    'healthcare-systems': { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    security: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    infrastructure: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    'healthcare-industry': { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    clinical: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    'ai-ml': { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
    regulatory: { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null },
  },
  lastFullUpdate: null,
  version: 1,
};

let state = null;

/**
 * Load state from file or create default.
 */
export function loadState() {
  if (state) return state;

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(data);
      // Merge with defaults to ensure all fields exist
      state = { ...DEFAULT_STATE, ...state };
    } else {
      state = { ...DEFAULT_STATE };
      saveState();
    }
  } catch (err) {
    console.error('[company-state] Failed to load state:', err.message);
    state = { ...DEFAULT_STATE };
  }

  return state;
}

/**
 * Save state to file.
 */
export function saveState() {
  if (!state) return;

  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    state.lastFullUpdate = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[company-state] Failed to save state:', err.message);
  }
}

/**
 * Generate a unique ID for objectives/initiatives/gaps.
 */
function generateId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// ── Objectives ──

/**
 * Add a new objective.
 */
export function addObjective(objective) {
  loadState();

  const obj = {
    id: objective.id || generateId('obj'),
    title: objective.title,
    description: objective.description || '',
    status: objective.status || 'active', // active, achieved, abandoned
    domains: objective.domains || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedEvents: objective.linkedEvents || [],
    linkedInitiatives: objective.linkedInitiatives || [],
  };

  state.objectives.push(obj);
  saveState();
  return obj;
}

/**
 * Update an objective.
 */
export function updateObjective(id, updates) {
  loadState();

  const idx = state.objectives.findIndex(o => o.id === id);
  if (idx === -1) return null;

  state.objectives[idx] = {
    ...state.objectives[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveState();
  return state.objectives[idx];
}

/**
 * Get active objectives.
 */
export function getActiveObjectives() {
  loadState();
  return state.objectives.filter(o => o.status === 'active');
}

/**
 * Get all objectives.
 */
export function getAllObjectives() {
  loadState();
  return state.objectives;
}

// ── Initiatives ──

/**
 * Add a new initiative.
 */
export function addInitiative(initiative) {
  loadState();

  const init = {
    id: initiative.id || generateId('init'),
    title: initiative.title,
    description: initiative.description || '',
    objectiveId: initiative.objectiveId || null,
    domain: initiative.domain,
    status: initiative.status || 'planned', // planned, in_progress, blocked, completed
    owner: initiative.owner || null, // persona key
    priority: initiative.priority || 'medium', // critical, high, medium, low
    blockers: initiative.blockers || [],
    dependencies: initiative.dependencies || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedEvents: initiative.linkedEvents || [],
  };

  state.initiatives.push(init);
  saveState();
  return init;
}

/**
 * Update an initiative.
 */
export function updateInitiative(id, updates) {
  loadState();

  const idx = state.initiatives.findIndex(i => i.id === id);
  if (idx === -1) return null;

  state.initiatives[idx] = {
    ...state.initiatives[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveState();
  return state.initiatives[idx];
}

/**
 * Get active initiatives.
 */
export function getActiveInitiatives(domain = null) {
  loadState();
  let inits = state.initiatives.filter(i =>
    i.status === 'in_progress' || i.status === 'planned'
  );
  if (domain) {
    inits = inits.filter(i => i.domain === domain);
  }
  return inits;
}

/**
 * Get blocked initiatives.
 */
export function getBlockedInitiatives() {
  loadState();
  return state.initiatives.filter(i => i.status === 'blocked');
}

// ── Domain Status ──

/**
 * Get domain status.
 */
export function getDomainStatus(domain) {
  loadState();
  return state.domainStatus[domain] || null;
}

/**
 * Update domain status.
 */
export function updateDomainStatus(domain, updates) {
  loadState();

  if (!state.domainStatus[domain]) {
    state.domainStatus[domain] = { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null };
  }

  state.domainStatus[domain] = {
    ...state.domainStatus[domain],
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  saveState();
  return state.domainStatus[domain];
}

/**
 * Record a gap in a domain.
 */
export function recordGap(domain, gap) {
  loadState();

  if (!state.domainStatus[domain]) {
    state.domainStatus[domain] = { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null };
  }

  const gapEntry = {
    id: gap.id || generateId('gap'),
    item: gap.item,
    category: gap.category || 'general',
    severity: gap.severity || 'medium', // critical, high, medium, low
    identifiedAt: new Date().toISOString(),
    identifiedBy: gap.identifiedBy || 'system',
    status: 'open', // open, addressed, deferred
    suggestedAction: gap.suggestedAction || null,
  };

  state.domainStatus[domain].knownGaps.push(gapEntry);
  state.domainStatus[domain].lastUpdated = new Date().toISOString();
  saveState();

  return gapEntry;
}

/**
 * Record a concern in a domain.
 */
export function recordConcern(domain, concern) {
  loadState();

  if (!state.domainStatus[domain]) {
    state.domainStatus[domain] = { lastUpdated: null, knownGaps: [], concerns: [], healthScore: null };
  }

  const concernEntry = {
    id: concern.id || generateId('concern'),
    description: concern.description,
    severity: concern.severity || 'medium',
    raisedAt: new Date().toISOString(),
    raisedBy: concern.raisedBy || 'system',
    status: 'active', // active, resolved, monitoring
  };

  state.domainStatus[domain].concerns.push(concernEntry);
  state.domainStatus[domain].lastUpdated = new Date().toISOString();
  saveState();

  return concernEntry;
}

/**
 * Mark a gap as addressed.
 */
export function addressGap(domain, gapId) {
  loadState();

  if (!state.domainStatus[domain]) return null;

  const gap = state.domainStatus[domain].knownGaps.find(g => g.id === gapId);
  if (gap) {
    gap.status = 'addressed';
    gap.addressedAt = new Date().toISOString();
    saveState();
  }

  return gap;
}

/**
 * Get open gaps across all domains or for a specific domain.
 */
export function getOpenGaps(domain = null) {
  loadState();

  const gaps = [];

  const domains = domain ? [domain] : Object.keys(state.domainStatus);
  for (const d of domains) {
    if (state.domainStatus[d]?.knownGaps) {
      for (const gap of state.domainStatus[d].knownGaps) {
        if (gap.status === 'open') {
          gaps.push({ ...gap, domain: d });
        }
      }
    }
  }

  return gaps;
}

/**
 * Get a summary suitable for daily digest.
 */
export function getSummary() {
  loadState();

  const activeObjectives = getActiveObjectives();
  const activeInitiatives = getActiveInitiatives();
  const blockedInitiatives = getBlockedInitiatives();
  const openGaps = getOpenGaps();
  const criticalGaps = openGaps.filter(g => g.severity === 'critical');

  return {
    objectives: activeObjectives.slice(0, 5),
    initiatives: {
      active: activeInitiatives.length,
      blocked: blockedInitiatives.length,
      blockedList: blockedInitiatives.slice(0, 3),
    },
    gaps: {
      total: openGaps.length,
      critical: criticalGaps.length,
      criticalList: criticalGaps.slice(0, 5),
    },
    lastUpdate: state.lastFullUpdate,
  };
}

/**
 * Clear state (for testing).
 */
export function clearState() {
  state = { ...DEFAULT_STATE };
  saveState();
}

export default {
  loadState,
  saveState,
  addObjective,
  updateObjective,
  getActiveObjectives,
  getAllObjectives,
  addInitiative,
  updateInitiative,
  getActiveInitiatives,
  getBlockedInitiatives,
  getDomainStatus,
  updateDomainStatus,
  recordGap,
  recordConcern,
  addressGap,
  getOpenGaps,
  getSummary,
  clearState,
};
