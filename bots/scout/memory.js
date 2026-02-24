import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const MEMORY_ROOT = "/opt/mattermost/bot-memory";

// --- Helper: Safe Read/Write ---

function loadYaml(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, "utf8");
      return yaml.load(content) || {};
    }
  } catch (err) {
    console.error(`Failed to load memory from ${filepath}:`, err);
  }
  return null; // Return null if file missing
}

function saveYaml(filepath, data) {
  try {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filepath, yaml.dump(data), "utf8");
    return true;
  } catch (err) {
    console.error(`Failed to save memory to ${filepath}:`, err);
    return false;
  }
}

// --- User Memory ---

export function getUserMemory(username) {
  // Handle @ prefix if present
  const cleanName = username.replace(/^@/, "");
  const filepath = path.join(MEMORY_ROOT, "users", `@${cleanName}.yaml`);
  
  let data = loadYaml(filepath);
  if (!data) {
    // Initialize new user memory
    data = {
      identity: { username: cleanName, role: "Unknown" },
      preferences: { verbosity: "normal" },
      active_context: {},
      memory_bank: []
    };
    saveYaml(filepath, data);
  }
  return data;
}

export function updateUserMemory(username, updateFn) {
  const cleanName = username.replace(/^@/, "");
  const filepath = path.join(MEMORY_ROOT, "users", `@${cleanName}.yaml`);
  let data = getUserMemory(cleanName);
  
  // Apply update
  const newData = updateFn(data);
  saveYaml(filepath, newData);
  return newData;
}

// --- Channel Memory ---

export function getChannelMemory(channelName) {
  const filepath = path.join(MEMORY_ROOT, "channels", channelName, "context.yaml");

  let data = loadYaml(filepath);
  if (!data) {
    data = {
      current_topics: [],
      active_participants: [],
      pinned_items: [],
      recent_decisions: [],
      research_queue: [],
      follow_up_queue: [],
      weekly_stats: {
        messages_count: 0,
        tasks_created: 0,
        decisions_made: 0,
        blockers_identified: 0,
        ideas_captured: 0,
        research_items: 0,
        follow_ups: 0,
        last_reset: Date.now()
      }
    };
    saveYaml(filepath, data);
  }
  // Ensure new fields exist for existing channels
  if (!data.research_queue) data.research_queue = [];
  if (!data.follow_up_queue) data.follow_up_queue = [];
  if (!data.weekly_stats) {
    data.weekly_stats = {
      messages_count: 0,
      tasks_created: 0,
      decisions_made: 0,
      blockers_identified: 0,
      ideas_captured: 0,
      research_items: 0,
      follow_ups: 0,
      last_reset: Date.now()
    };
  }
  return data;
}

export function updateChannelMemory(channelName, updateFn) {
  const filepath = path.join(MEMORY_ROOT, "channels", channelName, "context.yaml");
  let data = getChannelMemory(channelName);
  const newData = updateFn(data);
  saveYaml(filepath, newData);
  return newData;
}

// --- Project Memory ---

export function getProjectMemory(projectKey) {
  // Try Jira first
  let filepath = path.join(MEMORY_ROOT, "ecosystem", "jira", `${projectKey}-board.yaml`);
  let data = loadYaml(filepath);
  
  if (data) return { source: "jira", ...data };
  
  // Try GitHub (assuming projectKey might match a repo name)
  filepath = path.join(MEMORY_ROOT, "ecosystem", "github", `${projectKey}-repo.yaml`);
  data = loadYaml(filepath);
  
  if (data) return { source: "github", ...data };
  
  return null;
}

// --- Global Facts ---

export function getGlobalFacts() {
  const filepath = path.join(MEMORY_ROOT, "global", "facts.yaml");
  return loadYaml(filepath) || { general_knowledge: [] };
}

// --- Persistent Message History ---

const MAX_HISTORY_SIZE = 10000; // Max messages per channel

function getHistoryPath(channelId) {
  return path.join(MEMORY_ROOT, "channels", channelId, "history.json");
}

function loadJson(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, "utf8"));
    }
  } catch (err) {
    console.error(`Failed to load JSON from ${filepath}:`, err);
  }
  return null;
}

function saveJson(filepath, data) {
  try {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`Failed to save JSON to ${filepath}:`, err);
    return false;
  }
}

// Append a message to channel history
export function appendMessage(channelId, message) {
  const filepath = getHistoryPath(channelId);
  let history = loadJson(filepath) || [];

  // Avoid duplicates by checking timestamp + content
  const isDuplicate = history.some(m =>
    m.timestamp === message.timestamp && m.content === message.content
  );

  if (!isDuplicate) {
    history.push({
      id: message.id || null,
      timestamp: message.timestamp || Date.now(),
      userId: message.userId,
      username: message.username || null,
      content: message.content,
      role: message.role || 'user'
    });

    // Trim if exceeds max size (keep most recent)
    if (history.length > MAX_HISTORY_SIZE) {
      history = history.slice(-MAX_HISTORY_SIZE);
    }

    saveJson(filepath, history);
  }
  return history.length;
}

// Bulk append messages (for init sync)
export function bulkAppendMessages(channelId, messages) {
  const filepath = getHistoryPath(channelId);
  let history = loadJson(filepath) || [];

  const existingTimestamps = new Set(history.map(m => `${m.timestamp}-${m.content?.substring(0, 50)}`));

  let added = 0;
  for (const msg of messages) {
    const key = `${msg.timestamp}-${msg.content?.substring(0, 50)}`;
    if (!existingTimestamps.has(key)) {
      history.push({
        id: msg.id || null,
        timestamp: msg.timestamp || Date.now(),
        userId: msg.userId,
        username: msg.username || null,
        content: msg.content,
        role: msg.role || 'user'
      });
      existingTimestamps.add(key);
      added++;
    }
  }

  // Sort by timestamp
  history.sort((a, b) => a.timestamp - b.timestamp);

  // Trim if exceeds max
  if (history.length > MAX_HISTORY_SIZE) {
    history = history.slice(-MAX_HISTORY_SIZE);
  }

  if (added > 0) {
    saveJson(filepath, history);
  }

  return { total: history.length, added };
}

// Get recent messages from history
export function getRecentHistory(channelId, count = 100) {
  const filepath = getHistoryPath(channelId);
  const history = loadJson(filepath) || [];
  return history.slice(-count);
}

// Get messages within a time range
export function getHistoryByTimeRange(channelId, startTime, endTime) {
  const filepath = getHistoryPath(channelId);
  const history = loadJson(filepath) || [];
  return history.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
}

// Search history by content
export function searchHistory(channelId, query, limit = 50) {
  const filepath = getHistoryPath(channelId);
  const history = loadJson(filepath) || [];
  const lowerQuery = query.toLowerCase();

  const matches = history.filter(m =>
    m.content && m.content.toLowerCase().includes(lowerQuery)
  );

  // Return most recent matches
  return matches.slice(-limit);
}

// Get messages by user
export function getHistoryByUser(channelId, userId, limit = 100) {
  const filepath = getHistoryPath(channelId);
  const history = loadJson(filepath) || [];
  return history.filter(m => m.userId === userId).slice(-limit);
}

// Get full history (use sparingly)
export function getFullHistory(channelId) {
  const filepath = getHistoryPath(channelId);
  return loadJson(filepath) || [];
}

// Get history stats
export function getHistoryStats(channelId) {
  const filepath = getHistoryPath(channelId);
  const history = loadJson(filepath) || [];

  if (history.length === 0) {
    return { count: 0, oldest: null, newest: null, users: [] };
  }

  const userCounts = {};
  for (const msg of history) {
    userCounts[msg.userId] = (userCounts[msg.userId] || 0) + 1;
  }

  return {
    count: history.length,
    oldest: history[0]?.timestamp,
    newest: history[history.length - 1]?.timestamp,
    users: Object.entries(userCounts).map(([userId, count]) => ({ userId, count }))
  };
}

// --- Research Queue Management ---

export function addToResearchQueue(channelId, item) {
  return updateChannelMemory(channelId, (data) => {
    if (!data.research_queue) data.research_queue = [];
    data.research_queue.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`,
      title: item.title,
      description: item.description || '',
      priority: item.priority || 'medium',
      status: 'open',
      created_at: Date.now(),
      source_post_id: item.sourcePostId || null,
      assignee: item.assignee || null
    });
    // Increment weekly stats
    if (!data.weekly_stats) data.weekly_stats = {};
    data.weekly_stats.research_items = (data.weekly_stats.research_items || 0) + 1;
    return data;
  });
}

export function getResearchQueue(channelId, status = null) {
  const data = getChannelMemory(channelId);
  const queue = data.research_queue || [];
  if (status) {
    return queue.filter(item => item.status === status);
  }
  return queue;
}

export function updateResearchItem(channelId, itemId, updates) {
  return updateChannelMemory(channelId, (data) => {
    if (!data.research_queue) return data;
    const item = data.research_queue.find(r => r.id === itemId);
    if (item) {
      Object.assign(item, updates, { updated_at: Date.now() });
    }
    return data;
  });
}

// --- Follow-up Queue Management ---

export function addToFollowUpQueue(channelId, item) {
  return updateChannelMemory(channelId, (data) => {
    if (!data.follow_up_queue) data.follow_up_queue = [];
    data.follow_up_queue.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}`,
      title: item.title,
      description: item.description || '',
      due_context: item.dueContext || null,
      status: 'pending',
      created_at: Date.now(),
      source_post_id: item.sourcePostId || null,
      assignee: item.assignee || null
    });
    // Increment weekly stats
    if (!data.weekly_stats) data.weekly_stats = {};
    data.weekly_stats.follow_ups = (data.weekly_stats.follow_ups || 0) + 1;
    return data;
  });
}

export function getFollowUpQueue(channelId, status = null) {
  const data = getChannelMemory(channelId);
  const queue = data.follow_up_queue || [];
  if (status) {
    return queue.filter(item => item.status === status);
  }
  return queue;
}

export function updateFollowUpItem(channelId, itemId, updates) {
  return updateChannelMemory(channelId, (data) => {
    if (!data.follow_up_queue) return data;
    const item = data.follow_up_queue.find(f => f.id === itemId);
    if (item) {
      Object.assign(item, updates, { updated_at: Date.now() });
    }
    return data;
  });
}

// --- Weekly Stats Management ---

export function incrementWeeklyStat(channelId, statName) {
  return updateChannelMemory(channelId, (data) => {
    if (!data.weekly_stats) {
      data.weekly_stats = { last_reset: Date.now() };
    }
    data.weekly_stats[statName] = (data.weekly_stats[statName] || 0) + 1;
    return data;
  });
}

export function getWeeklyStats(channelId) {
  const data = getChannelMemory(channelId);
  return data.weekly_stats || {};
}

export function resetWeeklyStats(channelId) {
  return updateChannelMemory(channelId, (data) => {
    data.weekly_stats = {
      messages_count: 0,
      tasks_created: 0,
      decisions_made: 0,
      blockers_identified: 0,
      ideas_captured: 0,
      research_items: 0,
      follow_ups: 0,
      last_reset: Date.now()
    };
    return data;
  });
}

// --- Get all channels ---

export function getAllChannelIds() {
  const channelsDir = path.join(MEMORY_ROOT, "channels");
  try {
    if (fs.existsSync(channelsDir)) {
      return fs.readdirSync(channelsDir).filter(name => {
        const stat = fs.statSync(path.join(channelsDir, name));
        return stat.isDirectory();
      });
    }
  } catch (err) {
    console.error("Failed to list channels:", err);
  }
  return [];
}

