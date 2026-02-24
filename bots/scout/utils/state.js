// Shared state object for Scout bot
// Import this wherever you need access to bot state

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prefsFile = path.join(__dirname, '..', 'preferences.json');

const state = {
  ws: null,
  botUserId: null,
  channels: new Map(),
  userCache: new Map(),
  conversationHistory: new Map(), // channelId -> messages for summarization
  channelPreferences: new Map(), // channelId -> preferences
  introducedChannels: new Set(), // Track channels where we've shown the hint this session
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 5000
};

// Load preferences from file
export function loadPreferences(log) {
  try {
    if (fs.existsSync(prefsFile)) {
      const data = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
      for (const [channelId, prefs] of Object.entries(data)) {
        state.channelPreferences.set(channelId, prefs);
      }
      log('info', 'Loaded channel preferences', { count: Object.keys(data).length });
    }
  } catch (error) {
    log('error', 'Failed to load preferences', { error: error.message });
  }
}

// Save preferences to file
export function savePreferences(log) {
  try {
    const data = {};
    for (const [channelId, prefs] of state.channelPreferences) {
      data[channelId] = prefs;
    }
    fs.writeFileSync(prefsFile, JSON.stringify(data, null, 2));
  } catch (error) {
    log('error', 'Failed to save preferences', { error: error.message });
  }
}

// Get channel preferences with defaults
export function getChannelPrefs(channelId) {
  if (!state.channelPreferences.has(channelId)) {
    state.channelPreferences.set(channelId, {
      checkInFrequency: 'normal', // quiet, normal, active
      focusTopics: [], // topics to prioritize
      researchDepth: 'standard', // quick, standard, deep
      proactiveLevel: 'medium', // low, medium, high
      reminderTopics: [], // topics to revisit
      feedback: [] // user feedback for improvement
    });
  }
  return state.channelPreferences.get(channelId);
}

export default state;
