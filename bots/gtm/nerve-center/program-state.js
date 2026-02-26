/**
 * Program State - Workstream/milestone data model + CRUD + JSON persistence
 *
 * Manages the 7-workstream gap closure program with milestones,
 * cross-workstream dependencies, and health score tracking.
 */

import fs from 'fs';

const STATE_FILE = '/mnt/volume_nyc3_01/institutional-memory/program-state.json';

const DEFAULT_STATE = {
  version: 1,
  createdAt: null,
  updatedAt: null,
  workstreams: [],
  dependencies: [],
};

let state = null;

// ── Persistence ──

export function loadState() {
  if (state) return state;
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } else {
      state = { ...DEFAULT_STATE, createdAt: new Date().toISOString() };
      saveState();
    }
  } catch (err) {
    console.error('[program-state] Failed to load:', err.message);
    state = { ...DEFAULT_STATE, createdAt: new Date().toISOString() };
  }
  return state;
}

export function saveState() {
  if (!state) return;
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[program-state] Failed to save:', err.message);
  }
}

// ── Workstream CRUD ──

export function addWorkstream(ws) {
  loadState();
  const workstream = {
    id: ws.id,
    name: ws.name,
    tier: ws.tier,
    domains: ws.domains || [],
    status: ws.status || 'active',
    startWeek: ws.startWeek || 1,
    endWeek: ws.endWeek || 20,
    milestones: (ws.milestones || []).map(normalizeMilestone),
    createdAt: new Date().toISOString(),
  };
  state.workstreams.push(workstream);
  saveState();
  return workstream;
}

export function getWorkstream(wsId) {
  loadState();
  return state.workstreams.find(w => w.id === wsId) || null;
}

export function getAllWorkstreams() {
  loadState();
  return state.workstreams;
}

export function getWorkstreamStatus(wsId) {
  const ws = getWorkstream(wsId);
  if (!ws) return null;

  const total = ws.milestones.length;
  const completed = ws.milestones.filter(m => m.status === 'completed').length;
  const inProgress = ws.milestones.filter(m => m.status === 'in_progress').length;
  const blocked = ws.milestones.filter(m => m.status === 'blocked').length;
  const overdue = ws.milestones.filter(m => isMilestoneOverdue(m)).length;

  let health = 'green';
  if (overdue > 0 || blocked > 0) health = 'red';
  else if (inProgress === 0 && completed < total) health = 'yellow';

  return {
    wsId,
    name: ws.name,
    tier: ws.tier,
    total,
    completed,
    inProgress,
    blocked,
    overdue,
    health,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

// ── Milestone CRUD ──

function normalizeMilestone(m) {
  return {
    id: m.id,
    title: m.title,
    week: m.week,
    owner: m.owner || null,
    agents: m.agents || [],
    status: m.status || 'pending',
    completedAt: m.completedAt || null,
    notes: m.notes || '',
    blockedBy: m.blockedBy || [],
    deliverables: m.deliverables || [],
  };
}

export function getMilestone(msId) {
  loadState();
  for (const ws of state.workstreams) {
    const ms = ws.milestones.find(m => m.id === msId);
    if (ms) return { ...ms, wsId: ws.id, wsName: ws.name };
  }
  return null;
}

export function updateMilestone(msId, updates) {
  loadState();
  for (const ws of state.workstreams) {
    const idx = ws.milestones.findIndex(m => m.id === msId);
    if (idx !== -1) {
      ws.milestones[idx] = { ...ws.milestones[idx], ...updates };
      saveState();
      return { ...ws.milestones[idx], wsId: ws.id, wsName: ws.name };
    }
  }
  return null;
}

export function completeMilestone(msId, notes = '') {
  return updateMilestone(msId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    notes: notes || undefined,
  });
}

export function blockMilestone(msId, reason = '') {
  return updateMilestone(msId, {
    status: 'blocked',
    notes: reason || undefined,
  });
}

export function getMilestonesDueSoon(withinDays = 3) {
  loadState();
  const now = getCurrentWeek();
  const results = [];

  for (const ws of state.workstreams) {
    for (const ms of ws.milestones) {
      if (ms.status === 'pending' || ms.status === 'in_progress') {
        const weeksUntilDue = ms.week - now;
        if (weeksUntilDue >= 0 && weeksUntilDue * 7 <= withinDays) {
          results.push({ ...ms, wsId: ws.id, wsName: ws.name, weeksUntilDue });
        }
      }
    }
  }

  return results.sort((a, b) => a.week - b.week);
}

export function getOverdueMilestones() {
  loadState();
  const now = getCurrentWeek();
  const results = [];

  for (const ws of state.workstreams) {
    for (const ms of ws.milestones) {
      if (isMilestoneOverdue(ms)) {
        results.push({ ...ms, wsId: ws.id, wsName: ws.name, weeksBehind: now - ms.week });
      }
    }
  }

  return results.sort((a, b) => b.weeksBehind - a.weeksBehind);
}

function isMilestoneOverdue(ms) {
  if (ms.status === 'completed') return false;
  return ms.week < getCurrentWeek();
}

// ── Dependencies ──

export function addDependency(dep) {
  loadState();
  state.dependencies.push({
    from: dep.from,
    to: dep.to,
    description: dep.description || '',
  });
  saveState();
}

export function getDependencies(msId) {
  loadState();
  return {
    blockedBy: state.dependencies.filter(d => d.to === msId),
    blocks: state.dependencies.filter(d => d.from === msId),
  };
}

export function checkUnblocked(msId) {
  loadState();
  const deps = state.dependencies.filter(d => d.to === msId);
  for (const dep of deps) {
    const upstream = getMilestone(dep.from);
    if (upstream && upstream.status !== 'completed') {
      return { unblocked: false, blockedBy: dep.from };
    }
  }
  return { unblocked: true };
}

// ── Health Scores ──

export function getProgramHealth() {
  loadState();
  const wsStatuses = state.workstreams.map(ws => getWorkstreamStatus(ws.id));
  const totalMs = wsStatuses.reduce((s, w) => s + w.total, 0);
  const completedMs = wsStatuses.reduce((s, w) => s + w.completed, 0);
  const overdueMs = wsStatuses.reduce((s, w) => s + w.overdue, 0);
  const blockedMs = wsStatuses.reduce((s, w) => s + w.blocked, 0);

  return {
    workstreams: wsStatuses,
    overall: {
      totalMilestones: totalMs,
      completedMilestones: completedMs,
      overdueMilestones: overdueMs,
      blockedMilestones: blockedMs,
      progress: totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0,
    },
  };
}

// ── Blockers ──

export function getAllBlockers() {
  loadState();
  const blockers = [];

  for (const ws of state.workstreams) {
    for (const ms of ws.milestones) {
      if (ms.status === 'blocked') {
        blockers.push({
          milestoneId: ms.id,
          milestoneTitle: ms.title,
          wsId: ws.id,
          wsName: ws.name,
          reason: ms.notes,
          blockedBy: ms.blockedBy,
        });
      }
    }
  }

  // Cross-workstream dependency blockers
  for (const dep of state.dependencies) {
    const upstream = getMilestone(dep.from);
    const downstream = getMilestone(dep.to);
    if (upstream && downstream &&
        upstream.status !== 'completed' &&
        (downstream.status === 'pending' || downstream.status === 'in_progress')) {
      blockers.push({
        type: 'dependency',
        upstream: { id: dep.from, title: upstream.title, wsId: upstream.wsId },
        downstream: { id: dep.to, title: downstream.title, wsId: downstream.wsId },
        description: dep.description,
      });
    }
  }

  return blockers;
}

// ── Utility ──

function getCurrentWeek() {
  // Program start: 2026-02-24 (today)
  const programStart = new Date('2026-02-24T00:00:00Z');
  const now = new Date();
  const diffMs = now - programStart;
  return Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

export function resetState() {
  state = { ...DEFAULT_STATE, createdAt: new Date().toISOString() };
  saveState();
}

export default {
  loadState,
  saveState,
  addWorkstream,
  getWorkstream,
  getAllWorkstreams,
  getWorkstreamStatus,
  getMilestone,
  updateMilestone,
  completeMilestone,
  blockMilestone,
  getMilestonesDueSoon,
  getOverdueMilestones,
  addDependency,
  getDependencies,
  checkUnblocked,
  getProgramHealth,
  getAllBlockers,
  resetState,
};
