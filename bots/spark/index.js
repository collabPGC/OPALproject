// Spark Bot - PM & Team Engagement Assistant
// Main entry point: startup, WebSocket routing, message dispatch

import WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Local modules
import * as memory from './memory.js';
import { processUrls, fetchWebPage } from './url_utils.js';

// Shared modules
import semanticMemory from 'bots-shared/memory.js';
import llm from 'bots-shared/llm.js';
import * as ralph from 'bots-shared/ralph-mode.js';
import * as commandRouter from 'bots-shared/command-router.js';
import * as skillLoader from 'bots-shared/skill-loader.js';
import * as personaManager from 'bots-shared/persona-manager.js';
import taskProcessor from 'bots-shared/task-processor.js';
import institutionalMemory from 'bots-shared/institutional-memory';
import * as pdfUtils from 'bots-shared/pdf-utils.js';
const { taskQueue } = taskProcessor;

// Internal modules
import state, { loadPreferences, getChannelPrefs } from './utils/state.js';
import { getSparkGreetingResponse, getSparkFarewellResponse, getSparkAcknowledgmentResponse, getSparkClarifyingQuestion } from './utils/responses.js';
import { getPersonas } from './ai/prompts.js';
import { classifyIntent, detectWin } from './ai/intent.js';
import { parseCommand, handleCommand } from './handlers/commands.js';
import { handleFileUpload, addReaction } from './handlers/files.js';
import { handleJiraRequest } from './handlers/jira.js';
import { handleGitHubRequest, loadGithubContext, getGithubContext, generateCodebaseContext, scheduleGithubRefresh } from './handlers/github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

// Logging
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

// Initialize LLM router
llm.init({ log }).catch(err => {
  console.error('[Spark] LLM router init failed:', err.message);
});

// ============ MATTERMOST API HELPERS ============

async function mmApi(endpoint, method = 'GET', body = null) {
  const url = `${config.mattermost.url}/api/v4${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.mattermost.botToken}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  return response.json();
}

async function postMessage(channelId, message, rootId = null) {
  const body = { channel_id: channelId, message: message };
  if (rootId) body.root_id = rootId;

  try {
    const result = await mmApi('/posts', 'POST', body);
    log('info', 'Posted message', { channelId, messageLength: message.length });

    memory.appendMessage(channelId, {
      id: result?.id || null,
      content: message,
      userId: state.botUserId,
      timestamp: result?.create_at || Date.now(),
      role: 'assistant'
    });
  } catch (error) {
    log('error', 'Failed to post message', { channelId, error: error.message });
  }
}

// Generate a brief summary of long content
async function generateSummary(fullContent, maxChars = 500) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      system: `Summarize the following content in under ${maxChars} characters. Include only the most important takeaways. Be extremely concise. Do not use bullet points - write in brief prose. Do not start with "This" or "The content".`,
      messages: [{ role: 'user', content: fullContent }]
    });
    return response.content[0].text;
  } catch (error) {
    log('error', 'Failed to generate summary', { error: error.message });
    return fullContent.substring(0, maxChars - 50) + '... (see full content)';
  }
}

// Post long content with splitting: summary in main, full in thread
async function postWithSplitting(channelId, content, rootId, commandType) {
  const splitCommands = config.contentSplitting?.splitCommands || [];
  const shouldSplit = config.contentSplitting?.enabled &&
                      splitCommands.includes(commandType);

  if (!shouldSplit) {
    return postMessage(channelId, content, rootId);
  }

  try {
    const summary = await generateSummary(content, config.contentSplitting.summaryMaxChars || 500);
    const summaryMessage = `${summary}\n\n:thread: **Full ${commandType} in thread** \u2193`;
    const summaryBody = { channel_id: channelId, message: summaryMessage };
    if (rootId) summaryBody.root_id = rootId;

    const summaryResult = await mmApi('/posts', 'POST', summaryBody);
    log('info', 'Posted summary', { channelId, summaryLength: summary.length, commandType });

    const fullContentBody = {
      channel_id: channelId,
      message: `## Full ${commandType.charAt(0).toUpperCase() + commandType.slice(1)}\n\n${content}`,
      root_id: summaryResult.id
    };

    await mmApi('/posts', 'POST', fullContentBody);
    log('info', 'Posted full content in thread', {
      channelId, messageLength: content.length, threadRoot: summaryResult.id
    });

    memory.appendMessage(channelId, {
      id: summaryResult?.id || null,
      content: summaryMessage,
      userId: state.botUserId,
      timestamp: summaryResult?.create_at || Date.now(),
      role: 'assistant'
    });

    return summaryResult;
  } catch (error) {
    log('error', 'Failed to post with splitting, falling back to normal post', { error: error.message });
    return postMessage(channelId, content, rootId);
  }
}

// Add first-response hint
function maybeAddHint(channelId, response) {
  if (!state.introducedChannels.has(channelId)) {
    state.introducedChannels.add(channelId);
    return response + `\n\n---\n_\ud83d\udca1 Tip: Type \`!spark\` to see all my commands_`;
  }
  return response;
}

// Fetch channel history from Mattermost API
async function fetchChannelHistory(channelId, limit = 100) {
  try {
    const data = await mmApi(`/channels/${channelId}/posts?per_page=${limit}`);
    if (!data.posts || !data.order) return [];

    const posts = data.order.map(id => data.posts[id]).reverse();
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const userMap = {};

    for (const userId of userIds) {
      try {
        const user = await mmApi(`/users/${userId}`);
        userMap[userId] = user.username || user.nickname || 'Unknown';
      } catch (e) {
        userMap[userId] = 'Unknown';
      }
    }

    return posts.map(p => ({
      username: userMap[p.user_id] || 'Unknown',
      content: p.message,
      timestamp: p.create_at,
      userId: p.user_id
    }));
  } catch (error) {
    log('error', 'Failed to fetch channel history', { channelId, error: error.message });
    return [];
  }
}

// Get username helper
async function getUsername(userId) {
  if (state.userCache.has(userId)) {
    return state.userCache.get(userId);
  }
  try {
    const user = await mmApi(`/users/${userId}`);
    state.userCache.set(userId, user.username);
    return user.username;
  } catch (err) {
    log("error", "Failed to fetch username", { userId, error: err.message });
    return "unknown_user";
  }
}

// Tavily web search
async function webSearch(query, options = {}) {
  if (!config.tavily?.enabled || !config.tavily?.apiKey || config.tavily.apiKey === 'YOUR_TAVILY_API_KEY') {
    log('warn', 'Tavily not configured, skipping web search');
    return null;
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.tavily.apiKey,
        query: query,
        search_depth: options.depth || 'basic',
        include_answer: true,
        include_raw_content: false,
        max_results: options.maxResults || 5
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log('error', 'Tavily API error', { status: response.status, error });
      return null;
    }

    const data = await response.json();
    log('info', 'Web search completed', { query, resultsCount: data.results?.length });

    return {
      answer: data.answer,
      results: data.results?.map(r => ({
        title: r.title, url: r.url, content: r.content, score: r.score
      })) || []
    };
  } catch (error) {
    log('error', 'Web search failed', { query, error: error.message });
    return null;
  }
}

// ============ INSTITUTIONAL MEMORY HELPERS ============

async function emitToInstitutionalMemory(commandType, topic, response, channelId, postId) {
  if (!response || response.length < 200) return;

  const COMMAND_MAP = {
    'scamper':   { type: 'INSIGHT',  domain: 'product' },
    'sixhats':   { type: 'DEBATE',   domain: 'strategy' },
    'hmw':       { type: 'INSIGHT',  domain: 'product' },
    'retro':     { type: 'MEETING',  domain: 'operations' },
    'standup':   { type: 'MEETING',  domain: 'operations' },
    'followup':  { type: 'ACTION',   domain: 'operations' },
    'summary':   { type: 'MEETING',  domain: 'operations' },
  };

  const mapping = COMMAND_MAP[commandType];
  if (!mapping) return;

  let eventType = mapping.type;
  const lower = response.toLowerCase();
  if (lower.includes('we decided') || lower.includes('decision:') || lower.includes('agreed to')) eventType = 'DECISION';
  if (lower.includes('action item') || lower.includes('next step') || lower.includes('todo:')) eventType = 'ACTION';

  try {
    await institutionalMemory.emit({
      agent: 'spark',
      type: eventType,
      domain: mapping.domain,
      title: (topic || 'Spark facilitation').slice(0, 200),
      content: response.slice(0, 2000),
      tags: extractSparkTags(topic + ' ' + response),
      source: { channelId, postId },
    });
  } catch (err) {
    log('error', 'Failed to emit institutional memory event', { error: err.message });
  }
}

function extractSparkTags(text) {
  const lower = (text || '').toLowerCase();
  const tagPatterns = [
    'scamper', 'sixhats', 'hmw', 'brainstorm', 'retro', 'standup',
    'strategy', 'product', 'marketing', 'opal', 'lyna', 'esp32',
    'facilitation', 'icebreaker', 'roadmap', 'mvp', 'launch',
    'clinical', 'hospital', 'nurse', 'healthcare', 'competitive',
  ];
  return tagPatterns.filter(t => lower.includes(t)).slice(0, 10);
}

// ============ AI RESPONSE ============

async function getAIResponse(messages, persona = 'default', additionalContext = '') {
  const personas = getPersonas();

  const tools = [{
    name: "fetch_url",
    description: "REQUIRED: You MUST use this tool whenever a user provides a URL (http/https) and asks for analysis, summary, or details about it. Do not refuse. Use this tool to 'read' the website.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to fetch." }
      },
      required: ["url"]
    }
  }];

  try {
    let systemPrompt = personas[persona] || personas.default;

    const codebaseCtx = generateCodebaseContext();
    if (codebaseCtx) {
      systemPrompt += `\n\n## Team's Codebase Context\n\nYou have awareness of the team's repositories. Use this to provide context-aware facilitation:\n\n${codebaseCtx}`;
    }

    if (additionalContext) {
      systemPrompt += `\n\n## PERSISTENT MEMORY & RESOURCES\n${additionalContext}`;
    }

    systemPrompt += `\n\n## TOOLS & CAPABILITIES\nYou have a tool named 'fetch_url' which allows you to read website content. You MUST use this tool if the user provides a URL. Do not say you cannot browse the internet.`;

    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

    let response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: currentMessages,
      tools: tools
    });

    while (response.stop_reason === "tool_use") {
      const toolBlocks = response.content.filter(c => c.type === "tool_use");
      if (toolBlocks.length === 0) break;

      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const toolBlock of toolBlocks) {
        const { name, input, id } = toolBlock;
        let toolResult = "";

        if (name === "fetch_url") {
          log('info', `Tool execution: fetch_url(${input.url})`);
          toolResult = await fetchWebPage(input.url);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: toolResult
        });
      }

      currentMessages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: currentMessages,
        tools: tools
      });
    }

    return response.content.find(c => c.type === "text")?.text || "";
  } catch (error) {
    log('error', 'AI response error', { error: error.message });
    return "I encountered an error processing that request.";
  }
}

// ============ BUILD CONTEXT OBJECT ============

function buildCtx() {
  return {
    config, anthropic, state, log, mmApi, postMessage, postWithSplitting,
    memory, semanticMemory, institutionalMemory,
    emitToInstitutionalMemory, fetchChannelHistory, commandRouter,
    fetchWebPage, webSearch, getUsername, taskQueue, taskProcessor,
    getAIResponse
  };
}

// ============ MESSAGE HANDLER ============

async function handleMessage(post) {
  if (post.user_id === state.botUserId) return;

  // Ignore messages from any bot
  if (post.props?.from_bot === 'true' || post.props?.from_bot === true) {
    log('debug', 'Ignoring message from bot (from_bot flag)', { userId: post.user_id });
    return;
  }

  const ignoredBots = config.spark.ignoreBotUserIds || [];
  if (ignoredBots.includes(post.user_id)) {
    log('debug', 'Ignoring message from other bot', { userId: post.user_id });
    return;
  }

  const channelId = post.channel_id;
  const message = post.message;

  // Skip if ONLY Scout is mentioned
  const mentionsScout = message.toLowerCase().includes('@scout');
  const mentionsSpark = message.toLowerCase().includes('@spark');
  if (mentionsScout && !mentionsSpark) {
    log('info', 'SPARK SKIPPING - Only Scout mentioned', { channelId });
    return;
  }

  // Initialize channel state
  if (!state.channels.has(channelId)) {
    state.channels.set(channelId, { lastActivity: Date.now(), messages: [] });
  }

  const channelState = state.channels.get(channelId);
  channelState.lastActivity = Date.now();
  const msgTimestamp = post.create_at || Date.now();
  channelState.messages.push({
    role: 'user',
    content: message,
    userId: post.user_id,
    timestamp: msgTimestamp
  });

  // Persist message to disk
  memory.appendMessage(channelId, {
    id: post.id,
    content: message,
    userId: post.user_id,
    timestamp: msgTimestamp,
    role: 'user'
  });

  // Index into semantic memory (async, don't block)
  const channelName = state.channels.get(channelId)?.name || channelId;
  const msgUserName = await getUsername(post.user_id);
  semanticMemory.indexMessage({
    text: message,
    channelId,
    channelName,
    userId: post.user_id,
    userName: msgUserName,
    messageId: post.id,
    timestamp: msgTimestamp
  }).catch(err => log('warn', 'Semantic indexing failed', { error: err.message }));

  // Keep only last 20 messages in memory
  if (channelState.messages.length > 20) {
    channelState.messages = channelState.messages.slice(-20);
  }

  // Check for standup responses
  const standup = state.standupState.get(channelId);
  if (standup && standup.active && post.root_id) {
    standup.responses.push({
      user: post.user_id,
      content: message,
      timestamp: Date.now()
    });
    return;
  }

  const ctx = buildCtx();

  // Check for commands
  const cmd = parseCommand(message);
  if (cmd) {
    const response = await handleCommand(cmd, post, ctx);
    if (response) {
      const replyTo = post.root_id || post.id;
      await postMessage(channelId, maybeAddHint(channelId, response), replyTo);
    }
    return;
  }

  // Handle file uploads
  if (post.file_ids && post.file_ids.length > 0) {
    await handleFileUpload(post, ctx);
  }

  // ============ LLM-FIRST INTENT CLASSIFICATION ============
  const isMentioned = message.toLowerCase().includes('@spark');

  if (!isMentioned) {
    if (detectWin(message) && Math.random() < 0.3) {
      await addReaction(post.id, 'tada', ctx);
    }
    return;
  }

  // Spark was mentioned - classify intent using LLM
  log('info', 'Spark mentioned, classifying intent...', { channelId });
  const channelData = state.channels.get(channelId);
  const intent = await classifyIntent(message, channelState.messages, channelData?.name || '', ctx);

  // Handle based on classified intent
  if (!intent.respond) {
    log('info', 'Intent classified as no-response', { intent: intent.intent, reason: intent.reason });
    if (intent.reaction) {
      const emojiMap = { '\ud83d\udc4d': 'thumbsup', '\ud83d\ude4c': 'raised_hands', '\u2728': 'sparkles', '\ud83d\udc4b': 'wave', '\u26a1': 'zap', '\ud83c\udf89': 'tada' };
      const emojiName = emojiMap[intent.reaction] || 'zap';
      await addReaction(post.id, emojiName, ctx);
    }
    return;
  }

  log('info', 'Responding to message', { intent: intent.intent, persona: intent.persona });

  // Handle special intents with dedicated handlers
  if (intent.intent === 'jira_request') {
    const jiraResponse = await handleJiraRequest(channelId, message, ctx);
    await postMessage(channelId, jiraResponse, post.root_id || post.id);
    channelState.messages.push({ role: 'assistant', content: jiraResponse, timestamp: Date.now() });
    return;
  }

  if (intent.intent === 'github_request') {
    const githubResponse = await handleGitHubRequest(channelId, message, ctx);
    await postMessage(channelId, githubResponse, post.root_id || post.id);
    channelState.messages.push({ role: 'assistant', content: githubResponse, timestamp: Date.now() });
    return;
  }

  if (intent.intent === 'research_request') {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const urls = message.match(urlRegex) || [];

    const task = taskQueue.TaskFactory.research(
      message, channelId, post.user_id, ''
    );

    if (urls.length > 0) {
      task.data = task.data || {};
      task.data.urls = urls;
    }

    const queueStats = taskQueue.getStats();
    await postMessage(
      channelId,
      `\ud83d\udccb **Research queued:** ${task.title}\n\n` +
      (urls.length > 0 ? `Found ${urls.length} URL(s) to analyze.\n` : '') +
      `Position in queue: ${queueStats.pending}\n\n` +
      `Use \`!tasks\` to check progress.`,
      post.root_id || post.id
    );

    channelState.messages.push({ role: 'assistant', content: `Queued research: ${task.title}`, timestamp: Date.now() });

    if (queueStats.pending === 0) {
      setTimeout(processTaskQueue, 1000);
    }
    return;
  }

  // Build conversation context based on intent
  let conversationMessages;
  let historyContext = '';
  const persona = intent.persona || 'default';

  if (intent.load_history) {
    let historyMessages;
    const hours = intent.time_range_hours || 8;
    const startTime = Date.now() - (hours * 60 * 60 * 1000);
    historyMessages = memory.getHistoryByTimeRange(channelId, startTime, Date.now());
    log('info', 'Loading history for summary', { channelId, hours, messages: historyMessages.length });

    if (historyMessages.length > 0) {
      historyContext = `\n[Channel Message History - ${historyMessages.length} messages from last ${hours} hours]\n` +
        historyMessages.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.username || 'unknown'}: ${m.content}`).join('\n') +
        '\n[End of History]\n';
    }
    conversationMessages = [{ role: 'user', content: message }];
  } else {
    conversationMessages = channelState.messages.slice(-10).map(m => ({
      role: m.role || 'user',
      content: m.content
    }));
  }

  // --- MEMORY INJECTION ---
  const username = await getUsername(post.user_id);
  const userMem = memory.getUserMemory(username);
  const channelMem = memory.getChannelMemory(channelId);
  const globalFacts = memory.getGlobalFacts();

  let projectMem = null;
  const projectMatch = message.match(/\b(OPAL|SCRUM|ESP32)\b/i);
  if (projectMatch) {
    projectMem = memory.getProjectMemory(projectMatch[1].toUpperCase());
  }

  const memoryContext = `
[User Context]
User: @${username}
Role: ${userMem.identity?.role || 'Unknown'}
Preferences: ${JSON.stringify(userMem.preferences || {})}

[Channel Context]
Topics: ${channelMem.current_topics?.join(", ") || 'None'}
Decisions: ${channelMem.recent_decisions?.join(", ") || 'None'}

[Global Facts]
${globalFacts.general_knowledge?.join("\n") || ''}

${projectMem ? `[Project Status (${projectMem.source})]
${JSON.stringify(projectMem, null, 2)}` : ""}
${historyContext}
`;

  const response = await getAIResponse(conversationMessages, persona, memoryContext);

  if (response) {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    await postMessage(channelId, maybeAddHint(channelId, response), post.root_id || post.id);

    channelState.messages.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });
  }
}

// Placeholder for task queue processing
function processTaskQueue() {
  // Task processor handles this via its own interval
}

// ============ SCHEDULED CHECK-INS ============

async function scheduledCheckIn() {
  if (!config.spark.enableProactiveCheckins) return;

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const minute = now.getMinutes();

  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  if (hour < 9 || hour > 17) return;

  if (dayOfWeek === 1 && hour === 9 && minute >= 15 && minute < 30) {
    for (const [channelId] of state.channels) {
      await postMessage(channelId, `\ud83d\ude80 **What would make this week a win?**\n\nName it. Standup, brainstorm, or quick poll - let's build momentum early.\n\n_What's the one thing worth aligning on today?_`);
    }
  }

  if (dayOfWeek === 2 && hour === 9 && minute < 15) {
    for (const [channelId] of state.channels) {
      await postMessage(channelId, `\u2600\ufe0f **5 minutes to alignment.**\n\n\`!standup start\` - Share updates, surface blockers, move on.\n\n_Ready?_`);
    }
  }

  if (dayOfWeek === 3 && hour === 14 && minute < 15) {
    for (const [channelId] of state.channels) {
      await postMessage(channelId, `\ud83d\udca1 **Stuck on something? Perfect timing.**\n\nDrop me a challenge - I'll throw back 7+ creative solutions:\n\u2022 \`!scamper [challenge]\` - Innovation angles you haven't considered\n\u2022 \`!sixhats [decision]\` - See it from every perspective\n\u2022 \`!hmw [problem]\` - Reframe obstacles as opportunities`);
    }
  }

  if (dayOfWeek === 4 && hour === 11 && minute < 15) {
    for (const [channelId] of state.channels) {
      await postMessage(channelId, `\u26a1 **Decisions waiting too long?**\n\nGet alignment in minutes:\n\u2022 \`!consensus "Decision" "Option A" "Option B"\` - I'll follow up automatically\n\u2022 \`!poll "Question?" "A" "B" "C"\` - Quick team vote\n\n_What's been sitting in limbo?_`);
    }
  }

  if (dayOfWeek === 5 && hour === 15 && minute < 15) {
    for (const [channelId] of state.channels) {
      await postMessage(channelId, `\ud83c\udfaf **What worked this week? What didn't?**\n\n15 minutes to lock in the learning:\n\u2022 \`!retro\` - Quick reflection, clear actions\n\u2022 \`!celebrate [win]\` - Wins deserve recognition\n\n_Don't let a good week go uncaptured._`);
    }
  }
}

// Handle when Spark is added to a channel
async function handleBotAddedToChannel(channelId) {
  try {
    log('info', 'Spark added to channel', { channelId });

    const welcomeMessage = `\u2728 **Hi, I'm Spark** - your PM & team engagement assistant!

**Quick start:** Type \`!spark\` to see all my commands

**Popular commands:**
\u2022 \`!standup\` - Run daily standup
\u2022 \`!scamper [topic]\` - SCAMPER innovation technique
\u2022 \`!sixhats [topic]\` - Six Thinking Hats analysis
\u2022 \`!retro\` - Sprint retrospective
\u2022 \`!celebrate @user [reason]\` - Celebrate a win

Or just mention me to chat - I love helping teams collaborate!

_Tip: Try \`!icebreaker\` to get the conversation started._`;

    await postMessage(channelId, welcomeMessage);
    state.introducedChannels.add(channelId);
  } catch (error) {
    log('error', 'Failed to post welcome message', { channelId, error: error.message });
  }
}

// ============ WEBSOCKET ============

function handleWebSocketMessage(data) {
  try {
    const event = JSON.parse(data);
    if (event.event === 'posted') {
      const post = JSON.parse(event.data.post);
      handleMessage(post);
    } else if (event.event === 'user_added') {
      const userId = event.data.user_id;
      const channelId = event.broadcast?.channel_id;
      if (userId === state.botUserId && channelId) {
        handleBotAddedToChannel(channelId);
      }
    }
  } catch (error) {
    log('error', 'WebSocket message parse error', { error: error.message });
  }
}

async function connectWebSocket() {
  return new Promise((resolve, reject) => {
    const wsUrl = `${config.mattermost.wsUrl}/api/v4/websocket`;
    log('info', 'Connecting to WebSocket', { url: wsUrl });

    state.ws = new WebSocket(wsUrl);

    state.ws.on('open', () => {
      log('info', 'WebSocket connected');
      state.ws.send(JSON.stringify({
        seq: 1,
        action: 'authentication_challenge',
        data: { token: config.mattermost.botToken }
      }));
      state.reconnectAttempts = 0;
      resolve();
    });

    state.ws.on('message', handleWebSocketMessage);

    state.ws.on('close', () => {
      log('warn', 'WebSocket closed, reconnecting...');
      scheduleReconnect();
    });

    state.ws.on('error', (error) => {
      log('error', 'WebSocket error', { error: error.message });
      reject(error);
    });
  });
}

function scheduleReconnect() {
  if (state.reconnectAttempts >= state.maxReconnectAttempts) {
    log('error', 'Max reconnect attempts reached, exiting');
    process.exit(1);
  }

  state.reconnectAttempts++;
  const delay = state.reconnectDelay * Math.pow(2, state.reconnectAttempts - 1);
  log('info', `Reconnecting in ${delay}ms`, { attempt: state.reconnectAttempts });

  setTimeout(async () => {
    try {
      await connectWebSocket();
    } catch (error) {
      scheduleReconnect();
    }
  }, delay);
}

// Start task processor
function startTaskProcessor() {
  taskProcessor.start({
    postMessage,
    log,
    maxWorkers: 4,
    interval: 10000
  });
}

// Catchup missed mentions
async function catchupMissedMentions() {
  const catchupMinutes = 60;
  const cutoffTime = Date.now() - (catchupMinutes * 60 * 1000);
  let processedCount = 0;

  log('info', 'Checking for missed mentions', { minutes: catchupMinutes });

  for (const [channelId, channelData] of state.channels) {
    try {
      const hist = await mmApi(`/channels/${channelId}/posts?per_page=50`);
      if (!hist?.posts) continue;

      const posts = Object.values(hist.posts)
        .sort((a, b) => a.create_at - b.create_at)
        .filter(p => p.create_at > cutoffTime);

      for (const post of posts) {
        if (post.props?.from_bot === 'true' || post.props?.from_bot === true) continue;
        if (post.user_id === state.botUserId) continue;

        const mentionsSpark = post.message.toLowerCase().includes('@spark');
        if (!mentionsSpark) continue;

        const ourReply = posts.find(p =>
          p.user_id === state.botUserId &&
          p.create_at > post.create_at &&
          !p.message.includes('encountered an error') &&
          (p.root_id === post.id || p.root_id === post.root_id || (!p.root_id && !post.root_id))
        );

        if (ourReply) continue;

        log('info', 'Processing missed mention', {
          channel: channelData.name,
          postId: post.id,
          message: post.message.substring(0, 50)
        });

        await new Promise(r => setTimeout(r, 1000));
        await handleMessage(post);
        processedCount++;
      }
    } catch (err) {
      log('warn', `Catchup failed for channel ${channelData.name}`, { error: err.message });
    }
  }

  if (processedCount > 0) {
    log('info', 'Catchup complete', { processed: processedCount });
  } else {
    log('info', 'No missed mentions to catch up');
  }
}

// ============ INIT ============

async function init() {
  log('info', 'Starting Spark Bot - PM Assistant');

  // Load saved preferences
  loadPreferences(log);

  // Load GitHub context if available
  loadGithubContext(log);

  // Initialize semantic memory
  try {
    await semanticMemory.init({ log: (level, msg, data) => log(level, `[Memory] ${msg}`, data) });
    log('info', 'Semantic memory initialized');
  } catch (err) {
    log('warn', 'Semantic memory init failed, continuing without', { error: err.message });
  }

  // Initialize institutional memory
  try {
    await institutionalMemory.init(
      (level, msg, data) => log(level, `[InstMemory] ${msg}`, data),
      { pollIntervalMs: 5000 }
    );
    log('info', 'Institutional memory initialized');
  } catch (err) {
    log('warn', 'Institutional memory init failed, continuing without', { error: err.message });
  }

  try {
    const me = await mmApi('/users/me');
    state.botUserId = me.id;
    log('info', 'Bot authenticated', { userId: me.id, username: me.username });

    const teams = await mmApi('/users/me/teams');
    for (const team of teams) {
      const channels = await mmApi(`/users/me/teams/${team.id}/channels`);
      for (const channel of channels) {
        if (channel.type === 'O' || channel.type === 'P') {
          let initialMessages = [];
          const ignoredBots = config.spark?.ignoreBotUserIds || [];
          try {
            const hist = await mmApi(`/channels/${channel.id}/posts?per_page=100`);
            if (hist && hist.posts) {
              const posts = Object.values(hist.posts).sort((a, b) => a.create_at - b.create_at);
              const filteredPosts = posts.filter(p => {
                if (p.props?.from_bot === 'true' || p.props?.from_bot === true) return false;
                if (ignoredBots.includes(p.user_id)) return false;
                if (!p.message || p.message.trim() === '') return false;
                return true;
              });
              initialMessages = filteredPosts.map(p => ({
                id: p.id,
                role: p.user_id === state.botUserId ? 'assistant' : 'user',
                content: p.message,
                userId: p.user_id,
                timestamp: p.create_at
              }));
              const result = memory.bulkAppendMessages(channel.id, initialMessages);
              log('info', `Synced history for ${channel.name}`, { added: result.added, total: result.total, filtered: posts.length - filteredPosts.length });
            }
          } catch (err) {
            log('warn', `Failed to prefetch history for ${channel.name}`, { error: err.message });
            initialMessages = memory.getRecentHistory(channel.id, 100);
            if (initialMessages.length > 0) {
              log('info', `Loaded ${initialMessages.length} messages from disk for ${channel.name}`);
            }
          }

          state.channels.set(channel.id, {
            lastActivity: Date.now(),
            messages: initialMessages,
            name: channel.display_name
          });
        }
      }
    }

    log('info', 'Monitoring channels', { count: state.channels.size });

    await connectWebSocket();

    // Catchup missed mentions
    await catchupMissedMentions();

    // Schedule GitHub context refresh
    scheduleGithubRefresh(buildCtx());

    // Log GitHub status
    const ghCtx = getGithubContext();
    const repoCount = Object.keys(ghCtx.repos).length;
    if (repoCount > 0) {
      log('info', 'GitHub context loaded', { repos: repoCount, lastRefresh: ghCtx.lastRefresh });
    } else if (config.github?.enabled) {
      log('info', 'GitHub enabled but no repos onboarded. Use !onboard owner/repo to add repositories.');
    }

    // Start task processor
    startTaskProcessor();

    log('info', 'Spark Bot started successfully');
    log('info', 'Commands: !standup, !scamper, !sixhats, !hmw, !retro, !icebreaker, !celebrate, !tutorial, !onboard, !repos, !codebase, !tasks');

  } catch (error) {
    log('error', 'Initialization failed', { error: error.message });
    process.exit(1);
  }
}

init();
