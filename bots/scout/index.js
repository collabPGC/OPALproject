// Scout Bot - Research & PM Assistant (Refactored)
// Main entry point: WebSocket, message dispatch, core helpers, initialization

import WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Scout local modules
import * as memory from './memory.js';
import { processUrls, fetchWebPage } from './url_utils.js';
import * as capture from './capture.js';
import * as dashboard from './dashboard.js';

// Shared modules
import * as pdfUtils from 'bots-shared/pdf-utils.js';
import * as spreadsheetUtils from 'bots-shared/spreadsheet-utils.js';
import * as crew from 'bots-shared/crew';
import * as fileIndex from 'bots-shared/file-index.js';
import * as taskQueue from 'bots-shared/task-queue.js';
import semanticMemory from 'bots-shared/memory.js';
import llm from 'bots-shared/llm.js';
import { publishPDF } from 'bots-shared/publish-pdf.js';
import * as ralph from 'bots-shared/ralph-mode.js';
import * as commandRouter from 'bots-shared/command-router.js';
import * as skillLoader from 'bots-shared/skill-loader.js';
import * as personaManager from 'bots-shared/persona-manager.js';
import institutionalMemory from 'bots-shared/institutional-memory';
import { createReminderManager } from 'bots-shared/reminders.js';

// Refactored modules
import state, { loadPreferences, savePreferences, getChannelPrefs } from './utils/state.js';
import { getGreetingResponse, getFarewellResponse, getAcknowledgmentResponse, getClarifyingQuestion, getCheerMessage, commandOfferings, getRandomOffering } from './utils/responses.js';
import { scoutPreamble, getPersonas } from './ai/prompts.js';
import { classifyIntent, detectWin, isGreeting, isFarewell, isAcknowledgment } from './ai/intent.js';
import { generateDeepAnalysis, generateAnalysisPDF, uploadFileToMattermost } from './pdf/export.js';
import { parseCommand, handleCommand, parseDashboardArgs } from './handlers/commands.js';
import { downloadFile, handleFileUpload, addReaction } from './handlers/files.js';
import { handleJiraRequest } from './handlers/jira.js';
import { handleGitHubRequest } from './handlers/github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Initialize Anthropic client (kept for backward compatibility)
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

// ============ LOGGING ============

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

// Initialize LLM router (deferred until log function is defined)
llm.init({ log }).catch(err => {
  console.error('[Scout] LLM router init failed:', err.message);
});

// ============ MATTERMOST API & MESSAGING ============

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
  const body = {
    channel_id: channelId,
    message: message
  };
  if (rootId) body.root_id = rootId;

  log('debug', 'Attempting to post', { channelId, rootId, messageLength: message.length });

  try {
    const result = await mmApi('/posts', 'POST', body);
    log('info', 'Posted message', { channelId, messageLength: message.length });

    // Persist bot response to disk
    memory.appendMessage(channelId, {
      id: result?.id || null,
      content: message,
      userId: state.botUserId,
      timestamp: result?.create_at || Date.now(),
      role: 'assistant'
    });

    return result;
  } catch (error) {
    log('error', 'Failed to post message', { channelId, error: error.message });
  }
}

// Generate a brief summary of long content using fast/cheap model
async function generateSummary(fullContent, maxChars = 500) {
  try {
    const result = await llm.summarize([
      { role: 'user', content: fullContent }
    ], {
      system: `Summarize the following content in under ${maxChars} characters. Include only the most important takeaways. Be extremely concise. Do not use bullet points - write in brief prose. Do not start with "This" or "The content".`,
      maxTokens: 200
    });

    log('debug', 'Summary generated via router', { model: result.model });
    return result.text;
  } catch (error) {
    log('error', 'Failed to generate summary', { error: error.message });
    return fullContent.substring(0, maxChars - 50) + '... (see full content)';
  }
}

// Post long content with splitting: summary as main post, full content in thread
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
    const summaryBody = {
      channel_id: channelId,
      message: summaryMessage
    };
    if (rootId) summaryBody.root_id = rootId;

    const summaryResult = await mmApi('/posts', 'POST', summaryBody);
    log('info', 'Posted summary', { channelId, summaryLength: summary.length, commandType });

    const fullContentBody = {
      channel_id: channelId,
      message: `## Full ${commandType.charAt(0).toUpperCase() + commandType.slice(1)}\n\n${content}`,
      root_id: summaryResult.id
    };

    const fullResult = await mmApi('/posts', 'POST', fullContentBody);
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
    log('error', 'Failed to post with splitting, falling back to normal post', {
      error: error.message
    });
    return postMessage(channelId, content, rootId);
  }
}

// Add first-response hint if this is the first interaction in channel this session
function maybeAddHint(channelId, response) {
  if (!state.introducedChannels.has(channelId)) {
    state.introducedChannels.add(channelId);
    return response + `\n\n---\n_\u{1F4A1} Tip: Type \`!scout\` to see all my commands_`;
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

// ============ TAVILY WEB SEARCH ============

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

// ============ USERNAME LOOKUP ============

async function getUsername(userId) {
  if (state.userCache.has(userId)) {
    return state.userCache.get(userId);
  }
  try {
    const user = await mmApi(`/users/${userId}`);
    state.userCache.set(userId, user.username);
    return user.username;
  } catch (err) {
    log('error', 'Failed to fetch username', { userId, error: err.message });
    return 'unknown_user';
  }
}

// ============ REMINDERS (shared module) ============

let _reminderManager = null;
function setReminder(channelId, userId, timeStr, message) {
  if (!_reminderManager) {
    _reminderManager = createReminderManager(postMessage);
  }
  return _reminderManager.setReminder(channelId, userId, timeStr, message);
}

// ============ AI RESPONSE (getAIResponse) ============

async function getAIResponse(messages, persona = 'default', additionalContext = '') {
  const personas = getPersonas();

  const tools = [{
    name: "fetch_url",
    description: "REQUIRED: You MUST use this tool whenever a user provides a URL (http/https) and asks for analysis, summary, or details about it. Do not refuse or say you cannot access URLs. Use this tool to read the website content.",
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

    if (additionalContext) {
      systemPrompt += `\n\n## CONTEXT & MEMORY\n${additionalContext}`;
    }

    systemPrompt += `\n\n## TOOLS & CAPABILITIES\nYou have a tool named 'fetch_url' which allows you to read website content. You MUST use this tool if the user provides a URL and wants information about it. Do not say you cannot browse the internet - you CAN fetch URLs.`;

    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

    let response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: currentMessages,
      tools: tools
    });

    while (response.stop_reason === "tool_use") {
      const toolBlock = response.content.find(c => c.type === "tool_use");
      if (!toolBlock) break;

      const { name, input, id } = toolBlock;
      let toolResult = "";

      if (name === "fetch_url") {
        log('info', `Tool execution: fetch_url(${input.url})`);
        toolResult = await fetchWebPage(input.url);
      }

      currentMessages.push({ role: "assistant", content: response.content });
      currentMessages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: id, content: toolResult }]
      });

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

// ============ INSTITUTIONAL MEMORY HELPERS ============

async function emitToInstitutionalMemory(commandType, topic, response, channelId, postId) {
  if (!response || response.length < 200) return;

  const COMMAND_MAP = {
    'research':       { type: 'INSIGHT',   domain: 'product' },
    'brainstorm':     { type: 'INSIGHT',   domain: 'strategy' },
    'crew-research':  { type: 'INSIGHT',   domain: 'product' },
    'crew-brainstorm':{ type: 'INSIGHT',   domain: 'strategy' },
    'crew-dialectic': { type: 'DEBATE',    domain: 'strategy' },
    'crew-analysis':  { type: 'INSIGHT',   domain: 'product' },
    'summary':        { type: 'MEETING',   domain: 'operations' },
    'analyze':        { type: 'ARTIFACT',  domain: 'product' },
  };

  const mapping = COMMAND_MAP[commandType];
  if (!mapping) return;

  let eventType = mapping.type;
  const lower = response.toLowerCase();
  if (lower.includes('we decided') || lower.includes('decision:') || lower.includes('agreed to')) eventType = 'DECISION';
  if (lower.includes('action item') || lower.includes('next step') || lower.includes('todo:')) eventType = 'ACTION';
  if (lower.includes('predict') || lower.includes('forecast') || lower.includes('we expect')) eventType = 'PREDICTION';

  try {
    await institutionalMemory.emit({
      agent: 'scout',
      type: eventType,
      domain: mapping.domain,
      title: (topic || 'Scout analysis').slice(0, 200),
      content: response.slice(0, 2000),
      tags: extractScoutTags(topic + ' ' + response),
      source: { channelId, postId },
    });
  } catch (err) {
    log('error', 'Failed to emit institutional memory event', { error: err.message });
  }
}

function extractScoutTags(text) {
  const lower = (text || '').toLowerCase();
  const tagPatterns = [
    'pricing', 'strategy', 'product', 'marketing', 'sales', 'finance',
    'research', 'brainstorm', 'analysis', 'competitive', 'roadmap',
    'opal', 'lyna', 'esp32', 'hardware', 'firmware', 'manufacturing',
    'investor', 'crowdfunding', 'partnership', 'mvp', 'beta', 'launch',
    'clinical', 'hospital', 'nurse', 'healthcare', 'vocera', 'patent',
  ];
  return tagPatterns.filter(t => lower.includes(t)).slice(0, 10);
}

// ============ BUILD CONTEXT OBJECT ============

function buildCtx() {
  return {
    config,
    anthropic,
    state,
    log,
    mmApi,
    postMessage,
    postWithSplitting,
    memory,
    semanticMemory,
    institutionalMemory,
    emitToInstitutionalMemory,
    fetchChannelHistory,
    fetchWebPage,
    webSearch,
    getUsername,
    getAIResponse,
    setReminder,
    commandRouter,
    dashboard,
    taskQueue,
    fileIndex,
    pdfUtils,
    crew
  };
}

// ============ HANDLE MESSAGE ============

async function handleMessage(post) {
  if (post.user_id === state.botUserId) return;

  // Ignore messages from any bot
  if (post.props?.from_bot === 'true' || post.props?.from_bot === true) {
    log('debug', 'Ignoring message from bot (from_bot flag)', { userId: post.user_id });
    return;
  }

  const ignoredBots = config.scout.ignoreBotUserIds || [];
  if (ignoredBots.includes(post.user_id)) {
    log('debug', 'Ignoring message from other bot', { userId: post.user_id });
    return;
  }

  const channelId = post.channel_id;
  const message = post.message;

  // Skip if ONLY Spark is mentioned
  const mentionsScout = message.toLowerCase().includes('@scout');
  const mentionsSpark = message.toLowerCase().includes('@spark');
  if (mentionsSpark && !mentionsScout) {
    log('info', 'SCOUT SKIPPING - Only Spark mentioned', { channelId });
    return;
  }

  // Initialize channel state
  if (!state.channels.has(channelId)) {
    state.channels.set(channelId, { lastActivity: Date.now(), messages: [] });
  }
  if (!state.conversationHistory.has(channelId)) {
    state.conversationHistory.set(channelId, []);
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

  // Store for summarization (keep last 100 messages)
  const history = state.conversationHistory.get(channelId);
  history.push({ content: message, userId: post.user_id, timestamp: Date.now() });
  if (history.length > 100) {
    state.conversationHistory.set(channelId, history.slice(-100));
  }

  // Keep only last 20 messages for context
  if (channelState.messages.length > 20) {
    channelState.messages = channelState.messages.slice(-20);
  }

  // Smart Capture: Detect actionable items and ask for approval
  if (config.capture?.enabled) {
    try {
      const boardId = capture.getBoardForChannel(channelId);
      if (!boardId && !config.capture?.enableGlobalCapture) {
        // Channel not mapped, skip capture
      } else if (message.length >= 20 && !message.startsWith('!')) {
        let username = 'unknown';
        try {
          const user = await mmApi(`/users/${post.user_id}`);
          username = user.username;
        } catch (e) { /* ignore */ }

        const capChannelName = config.capture.channelNames?.[channelId] || 'unknown';
        const boardName = config.capture.boardNames?.[boardId] || 'Project Board';

        const detection = await capture.detectActionableItems(anthropic, message, capChannelName, username);

        if (detection.hasActionableItems && detection.items?.length) {
          const approvalMsg = capture.formatApprovalRequest(detection, capChannelName, boardName);
          if (approvalMsg) {
            const captureReplyTo = post.root_id || post.id;
            const approvalPost = await postMessage(channelId, approvalMsg, captureReplyTo);

            if (approvalPost?.id) {
              capture.storePendingCapture(approvalPost.id, {
                detection, channelId, channelName: capChannelName,
                username, originalPostId: post.id
              });
              log('info', 'Capture approval requested', { postId: approvalPost.id, items: detection.items.length });
            }
          }
        }
      }
    } catch (captureError) {
      log('error', 'Capture detection failed', { error: captureError.message });
    }
  }

  const ctx = buildCtx();

  // Check for commands first
  const cmd = parseCommand(message);
  if (cmd) {
    const cmdResponse = await handleCommand(cmd, post, ctx);

    if (cmdResponse) {
      const replyTo = post.root_id || post.id;
      await postMessage(channelId, maybeAddHint(channelId, cmdResponse), replyTo);
    }
    return;
  }

  // Handle file uploads - analyze images if @scout was mentioned
  if (post.file_ids && post.file_ids.length > 0) {
    const shouldAnalyzeImages = message.toLowerCase().includes('@scout');
    await handleFileUpload(post, shouldAnalyzeImages, ctx);
  }

  // ============ LLM-FIRST INTENT CLASSIFICATION ============
  const isMentioned = message.toLowerCase().includes('@scout');

  if (!isMentioned) {
    // Not mentioned - only do passive reactions
    if (detectWin(message) && Math.random() < 0.3) {
      await addReaction(post.id, 'tada', ctx);
    }
    return;
  }

  // Scout was mentioned - classify intent using LLM
  log('info', 'Scout mentioned, classifying intent...', { channelId });
  const channelData = state.channels.get(channelId);
  const intent = await classifyIntent(message, channelState.messages, channelData?.name || '', ctx);

  // Handle based on classified intent
  if (!intent.respond) {
    log('info', 'Intent classified as no-response', { intent: intent.intent, reason: intent.reason });
    if (intent.reaction) {
      const emojiMap = { '\u{1F44D}': 'thumbsup', '\u{1F64C}': 'raised_hands', '\u2728': 'sparkles', '\u{1F44B}': 'wave', '\u{1F389}': 'tada' };
      const emojiName = emojiMap[intent.reaction] || 'thumbsup';
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

  // Detect target channel override
  let targetChannelId = channelId;
  const channelMention = message.match(/#([a-z0-9_-]+)/i);
  if (channelMention) {
    const targetName = channelMention[1].toLowerCase();
    for (const [id, data] of state.channels) {
      if ((data.name || '').toLowerCase() === targetName) {
        targetChannelId = id;
        break;
      }
    }
  }
  const activeChannelMem = (targetChannelId === channelId) ? channelMem : memory.getChannelMemory(targetChannelId);

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
Topics: ${activeChannelMem.current_topics?.join(", ") || 'None'}
Decisions: ${activeChannelMem.recent_decisions?.join(", ") || 'None'}

[Global Facts]
${globalFacts.general_knowledge?.join("\n") || ''}

${projectMem ? `[Project Status (${projectMem.source})]
${JSON.stringify(projectMem, null, 2)}` : ""}
${historyContext}
`;

  const aiResponse = await getAIResponse(conversationMessages, persona, memoryContext);

  if (aiResponse) {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    await postMessage(channelId, maybeAddHint(channelId, aiResponse), post.root_id || post.id);

    channelState.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: Date.now()
    });
  }
}

// ============ PROACTIVE FEATURES ============

async function checkSilentChannels() {
  if (!config.scout.enableSilenceBreaking) return;

  const now = Date.now();
  const silenceThreshold = config.scout.silenceThresholdMinutes * 60 * 1000;

  for (const [channelId, channelState] of state.channels) {
    const safeName = (channelState.name || channelId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const channelMem = memory.getChannelMemory(safeName);
    const freq = channelMem.preferences?.checkInFrequency || getChannelPrefs(channelId).checkInFrequency || 'normal';

    if (freq === 'quiet') continue;

    const silenceDuration = now - channelState.lastActivity;

    if (silenceDuration > silenceThreshold) {
      if (!channelState.lastCheckIn || (now - channelState.lastCheckIn) > silenceThreshold * 2) {
        const prompts = [
          "Hey team! It's been quiet here. Anyone working on something interesting they'd like to share? \u{1F4AC}",
          "Quick check-in: How's everyone doing? Any wins to celebrate or challenges to discuss? \u{1F3AF}",
          "Hello! Just checking in. Need any help with research, brainstorming, or GitHub updates? Use `!research`, `!brainstorm`, or `!github` commands!",
          "The channel's been quiet - hope that means great focus time! Let me know if you need anything. \u{1F680}",
          "Any updates, blockers, or topics you'd like to explore? I can help with `!research [topic]` for deep analysis or `!brainstorm [topic]` for creative ideas!"
        ];

        const msg = prompts[Math.floor(Math.random() * prompts.length)];
        await postMessage(channelId, msg);

        channelState.lastCheckIn = now;
        channelState.lastActivity = now;

        log('info', 'Sent silence-breaking message', { channelId, silenceDuration });
      }
    }
  }
}

async function scheduledCheckIn() {
  if (!config.scout.enableProactiveCheckins) return;

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const minute = now.getMinutes();

  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  if (hour < 9 || hour > 17) return;

  let msg = null;

  if (hour === 9 && minute < 15) {
    msg = `\u2600\uFE0F **What's the one thing worth exploring today?**\n\nDrop me a topic - research, brainstorm, or summary. I'll deliver insights in minutes.\n\n_Example: "Scout, research best practices for remote team communication"_`;
  } else if ((dayOfWeek === 2 || dayOfWeek === 4) && hour === 11 && minute < 15) {
    msg = `\u{1F4A1} **Got a question that's been nagging you?**\n\nThrow it my way. You'll have 5 hypotheses with probabilities before lunch.\n\nTry: \n!research [your question]`;
  } else if (dayOfWeek === 3 && hour === 12 && minute < 15) {
    msg = `\u{1F52C} **What's blocking progress this week?**\n\nName the challenge. McKinsey-quality analysis, delivered in minutes.\n\n!research [your biggest blocker]`;
  } else if (hour === 16 && minute < 15) {
    msg = `\u{1F305} **Before you sign off - anything worth capturing?**\n\n\u2022 !summary - Today's discussions, distilled\n\u2022 !savelast [name] - Lock in that research for later\n\n_Don't let good insights slip away._`;
  } else if (dayOfWeek === 5 && hour === 15 && minute < 15) {
    msg = `\u{1F3AF} **What do you know now that you wish you knew Monday?**\n\nLet's turn it into next week's advantage:\n\u2022 !summary 168 - This week's key discussions\n\u2022 !research [a lesson learned] - Go deeper on what worked (or didn't)`;
  }

  if (msg) {
    for (const [channelId, channelData] of state.channels) {
      const safeName = (channelData.name || channelId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const channelMem = memory.getChannelMemory(safeName);
      const freq = channelMem.preferences?.checkInFrequency || 'normal';

      if (freq === 'quiet') {
        log('info', `Skipping check-in for ${channelData.name} (quiet mode)`);
        continue;
      }

      await postMessage(channelId, msg);
    }
  }
}

// ============ REACTION / CAPTURE HANDLING ============

async function handleReaction(reaction) {
  const postId = reaction.post_id;
  const emojiName = reaction.emoji_name;
  const userId = reaction.user_id;

  if (userId === state.botUserId) return;

  if (!capture.hasPendingCapture(postId)) return;

  if (emojiName !== 'white_check_mark' && emojiName !== 'heavy_check_mark' &&
      emojiName !== '+1' && emojiName !== 'x' && emojiName !== '-1') {
    return;
  }

  const pendingData = capture.getPendingCapture(postId);
  if (!pendingData) return;

  const isApproved = emojiName === 'white_check_mark' ||
                     emojiName === 'heavy_check_mark' ||
                     emojiName === '+1';

  if (isApproved) {
    log('info', 'Capture approved', { postId, userId });
    try {
      const results = await capture.executeCapture(anthropic, pendingData);
      const resultMsg = capture.formatCaptureMessage(results);
      if (resultMsg) {
        await postMessage(pendingData.channelId, `\u2705 **Captured!**\n\n${resultMsg}`, postId);
      }
    } catch (err) {
      log('error', 'Failed to execute approved capture', { error: err.message });
      await postMessage(pendingData.channelId, `\u274C Failed to capture items: ${err.message}`, postId);
    }
  } else {
    log('info', 'Capture rejected', { postId, userId });
    await postMessage(pendingData.channelId, `\u{1F44D} No problem - skipped capture.`, postId);
  }
}

// ============ CHANNEL ONBOARDING ============

const CHANNEL_ADD_LOCK_DIR = '/opt/mattermost/bots-v2/shared/data/channel-locks';

async function handleBotAddedToChannel(channelId) {
  try {
    const lockFile = `${CHANNEL_ADD_LOCK_DIR}/${channelId}.lock`;
    try {
      if (!fs.existsSync(CHANNEL_ADD_LOCK_DIR)) {
        fs.mkdirSync(CHANNEL_ADD_LOCK_DIR, { recursive: true });
      }
      if (fs.existsSync(lockFile)) {
        const lockTime = fs.statSync(lockFile).mtimeMs;
        if (Date.now() - lockTime < 30000) return;
      }
      fs.writeFileSync(lockFile, Date.now().toString());
    } catch (lockErr) {
      return;
    }

    if (state.introducedChannels.has(channelId)) return;

    log('info', 'Scout added to channel', { channelId });

    const welcomeMessage = `\u{1F44B} **Hi, I'm Scout** - your research & PM assistant!

**Quick start:** Type \`!scout\` to see all my commands

**Popular commands:**
\u2022 \`!research [topic]\` - Deep analysis with web search
\u2022 \`!brainstorm [idea]\` - Probabilistic brainstorming
\u2022 \`!dashboard\` - Project status overview
\u2022 \`!jira [type] [title]\` - Create Jira issues

Or just ask me a question naturally - I'm always listening!

_Tip: Use \`!setdepth deep\` for more thorough research._`;

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
    } else if (event.event === 'reaction_added') {
      const reaction = JSON.parse(event.data.reaction);
      handleReaction(reaction);
    } else if (event.event === 'channel_viewed') {
      const channelId = event.data.channel_id;
      if (state.channels.has(channelId)) {
        state.channels.get(channelId).lastActivity = Date.now();
      }
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

// ============ TASK QUEUE PROCESSOR ============

let taskProcessorRunning = false;

async function processTaskQueue() {
  if (taskProcessorRunning) return;
  taskProcessorRunning = true;

  try {
    const task = taskQueue.getNextTask();
    if (!task) {
      taskProcessorRunning = false;
      return;
    }

    log('info', 'Processing task', { id: task.id, type: task.type, title: task.title });
    taskQueue.startTask(task.id);

    try {
      switch (task.type) {
        case taskQueue.TASK_TYPE.FILE_PROCESS: {
          const { fileId, fileName } = task.data;
          const fileInfo = fileIndex.getFile(fileId);

          if (!fileInfo) throw new Error(`File not found in index: ${fileId}`);

          const ctx = buildCtx();
          const buffer = await downloadFile(fileId, ctx);
          if (!buffer) throw new Error('Failed to download file');

          const result = await fileIndex.processFile(fileInfo, buffer, { log });
          if (!result.success) throw new Error(result.error || 'Processing failed');

          // Store in channel memory
          const chState = state.channels.get(task.channelId);
          if (chState) {
            chState.messages.push({
              role: 'system',
              content: `[${result.type.toUpperCase()}: ${result.name}]\n${result.context.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }

          // Index for vector search
          const indexContent = {
            text: result.context,
            chunks: [{ text: result.context, pageNum: 1, heading: result.name }]
          };
          await pdfUtils.indexDocument(indexContent, result.name, task.channelId, log);

          // Generate comprehensive AI analysis
          if (task.channelId) {
            let summaryLines = [];
            if (result.type === 'spreadsheet') {
              summaryLines = [
                `- **Sheets**: ${result.summary.sheets}`,
                `- **Rows**: ${result.summary.rows}`,
                `- **Formulas**: ${result.summary.formulas}`,
                result.summary.hasComplexFormulas ? `- **Complex formulas**: Yes` : null
              ].filter(Boolean);
            } else if (result.type === 'pdf' || result.type === 'document') {
              summaryLines = [
                `- **Pages**: ${result.summary.pages}`,
                `- **Chunks**: ${result.summary.chunks}`
              ];
            }

            try {
              await postMessage(task.channelId, `\u{1F4CA} **Analyzing ${fileName}**...\n\nPerforming deep analysis using McKinsey/HBS framework. This may take a moment.`);

              const fullContext = result.context.substring(0, 60000);

              await postMessage(task.channelId, `\u{1F50D} **Starting Deep Analysis**: ${result.name}\n\nThis will generate a comprehensive 30+ page report with:\n\u2022 Executive Summary & Business Overview\n\u2022 Financial Deep Dive\n\u2022 Strategic Recommendations & Risk Analysis\n\n_This may take 2-3 minutes..._`);

              const analysisText = await generateDeepAnalysis(fullContext, result.type, log);

              const pdfFileName = `Analysis_${result.name.replace(/\.[^.]+$/, '')}_${Date.now()}.pdf`;
              const pdfPath = path.join('/tmp', pdfFileName);

              try {
                await generateAnalysisPDF(`Deep Analysis: ${result.name}`, analysisText, pdfPath);
                const pdfSize = fs.statSync(pdfPath).size;
                log('info', 'Generated analysis PDF', { pdfPath, size: pdfSize });

                const uploadedFileId = await uploadFileToMattermost(pdfPath, task.channelId, pdfFileName, config);
                log('info', 'Uploaded analysis PDF', { fileId: uploadedFileId, fileName: pdfFileName });

                const execSummary = analysisText.split('---')[0].substring(0, 4000);

                const summaryMsg = `## \u{1F4CA} Deep Analysis Complete: ${result.name}\n\n**File Info:**\n${summaryLines.join('\n')}\n\n---\n\n**Executive Summary:**\n\n${execSummary}\n\n---\n\u{1F4CE} **Full ${Math.round(pdfSize / 1024)}KB analysis attached as PDF** (${Math.round(analysisText.length / 1000)}k characters)\n\n_The complete analysis includes Financial Deep Dive and Strategic Recommendations. File content is in memory for follow-up questions._`;

                const postBody = {
                  channel_id: task.channelId,
                  message: summaryMsg.length > 16000 ? summaryMsg.substring(0, 16000) + '\n\n...(see attached PDF for complete analysis)' : summaryMsg,
                  file_ids: [uploadedFileId]
                };

                const postResponse = await fetch(`${config.mattermost.url}/api/v4/posts`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${config.mattermost.botToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(postBody)
                });

                if (!postResponse.ok) throw new Error(`Post failed: ${postResponse.status}`);

                fs.unlinkSync(pdfPath);
                log('info', 'Posted deep AI analysis with PDF', { fileName, type: result.type, analysisLength: analysisText.length, pdfSize });

              } catch (pdfError) {
                log('error', 'PDF generation/upload failed, falling back to text', { error: pdfError.message });
                const analysisMsg = `## \u{1F4CA} Deep Analysis: ${result.name}\n\n**File Info:**\n${summaryLines.join('\n')}\n\n---\n\n${analysisText}\n\n---\n_Full file content is now in memory. Ask follow-up questions for deeper dives into specific areas._`;
                await postWithSplitting(task.channelId, analysisMsg, null, 'file-analysis');
              }
            } catch (aiError) {
              log('error', 'Deep analysis failed, posting raw summary', { error: aiError.message });
              const basicMsg = `## \u{1F4C4} File Processed: ${result.name}\n\n**Summary:**\n${summaryLines.join('\n')}\n\n_File content is now in memory for questions. Ask "@scout analyze the spreadsheet" for deep analysis._`;
              await postMessage(task.channelId, basicMsg);
            }
          }

          taskQueue.completeTask(task.id, { type: result.type, summary: result.summary });
          break;
        }

        case taskQueue.TASK_TYPE.FILE_SCAN: {
          const result = await fileIndex.scanChannelFiles(task.channelId, mmApi, { log });

          const unprocessed = fileIndex.getChannelFiles(task.channelId, { unprocessedOnly: true });
          for (const file of unprocessed) {
            const fileType = fileIndex.getFileType(file);
            if (['spreadsheet', 'pdf', 'document'].includes(fileType)) {
              taskQueue.TaskFactory.fileProcess(file, task.channelId, 'scout');
            }
          }

          if (task.channelId) {
            await postMessage(task.channelId,
              `\u2705 **Scan Complete**: Found ${result.added} new files\n- Created ${unprocessed.length} processing tasks\n\nUse \`!tasks\` to see pending work.`
            );
          }

          taskQueue.completeTask(task.id, result);
          break;
        }

        case taskQueue.TASK_TYPE.REMINDER: {
          const { message } = task.data;
          if (task.channelId) {
            await postMessage(task.channelId, `\u23F0 **Reminder**: ${message}`);
          }
          taskQueue.completeTask(task.id);
          break;
        }

        case taskQueue.TASK_TYPE.FOLLOW_UP: {
          const { item } = task.data;
          if (task.channelId) {
            await postMessage(task.channelId,
              `\u{1F4CC} **Follow-up**: ${item}\n\n_This was scheduled for follow-up. Reply to discuss or use \`!task done ${task.id.substring(0, 8)}\` to mark complete._`
            );
          }
          taskQueue.completeTask(task.id);
          break;
        }

        case taskQueue.TASK_TYPE.CREW_PIPELINE: {
          const { pipelineType, topic } = task.data;

          let context = '';
          const chState = state.channels.get(task.channelId);
          if (chState) {
            context = chState.messages
              .slice(-30)
              .filter(m => m.content)
              .map(m => m.content)
              .join('\n');
          }

          await postMessage(task.channelId, `\u{1F916} **Starting Crew ${pipelineType}**: ${topic}...`);

          const result = await crew.runPipeline(pipelineType, topic, context, { log });

          await postWithSplitting(task.channelId,
            `## \u{1F916} Crew ${pipelineType}: ${topic}\n\n${result.finalOutput}`,
            null, `crew-${pipelineType}`
          );

          taskQueue.completeTask(task.id, { stages: result.stages.length });
          break;
        }

        default:
          log('warn', 'Unknown task type', { type: task.type });
          taskQueue.completeTask(task.id, { skipped: true });
      }
    } catch (err) {
      log('error', 'Task processing failed', { id: task.id, error: err.message });
      taskQueue.failTask(task.id, err.message);
    }
  } catch (err) {
    log('error', 'Task queue processor error', { error: err.message });
  } finally {
    taskProcessorRunning = false;
  }
}

async function populateTasksFromUnprocessedFiles() {
  try {
    let totalFiles = 0;

    for (const [channelId, channelData] of state.channels) {
      const scanResult = await fileIndex.scanChannelFiles(channelId, mmApi, { log, limit: 50 });
      totalFiles += scanResult.added;
      if (scanResult.added > 0) {
        log('info', 'Indexed files from channel', { channel: channelData.name, files: scanResult.added });
      }
    }

    const fileStats = fileIndex.getStats();
    const taskStats = taskQueue.getStats();

    log('info', 'Startup scan complete', {
      newFilesIndexed: totalFiles,
      totalFilesKnown: fileStats.totalFiles,
      pendingTasks: taskStats.pending
    });
  } catch (err) {
    log('error', 'Failed to scan files on startup', { error: err.message });
  }
}

// ============ DASHBOARD SCHEDULER ============

const dashboardState = {
  lastPostedDates: {}
};

async function checkDashboardSchedule() {
  if (!config.dashboard?.enabled) return;

  const schedules = config.dashboard.schedules || [];
  const targetChannel = config.dashboard.targetChannel;
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  for (const schedule of schedules) {
    const scheduleKey = `${schedule.dayOfWeek}-${schedule.hour}`;

    if (currentDay === schedule.dayOfWeek &&
        currentHour === schedule.hour &&
        dashboardState.lastPostedDates[scheduleKey] !== todayKey) {

      log('info', `Running scheduled dashboard: ${schedule.label || 'Weekly'}`);

      try {
        let channelId = null;
        for (const [id, data] of state.channels) {
          if (data.name && data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').includes(targetChannel.toLowerCase())) {
            channelId = id;
            break;
          }
        }

        if (!channelId) {
          const teams = await mmApi('/users/me/teams');
          for (const team of teams) {
            try {
              const channel = await mmApi(`/teams/${team.id}/channels/name/${targetChannel}`);
              if (channel) { channelId = channel.id; break; }
            } catch (e) { /* Channel not found in this team */ }
          }
        }

        if (channelId) {
          const dashboardData = await dashboard.generateDashboard(
            config.dashboard.timeRangeDays || 7,
            schedule.label || 'Weekly'
          );

          await postMessage(channelId, dashboardData.formatted_text);

          if (config.dashboard.includeCharts && dashboardData.charts) {
            let chartMsg = '**Dashboard Charts:**\n\n';
            if (dashboardData.charts.flow_velocity) chartMsg += `[Flow Velocity](${dashboardData.charts.flow_velocity})\n`;
            if (dashboardData.charts.activity_trend) chartMsg += `[Activity Trend](${dashboardData.charts.activity_trend})\n`;
            if (dashboardData.charts.task_distribution) chartMsg += `[Task Distribution](${dashboardData.charts.task_distribution})\n`;
            await postMessage(channelId, chartMsg);
          }

          dashboardState.lastPostedDates[scheduleKey] = todayKey;
          log('info', `Dashboard posted to #${targetChannel}`);
        } else {
          log('warn', `Dashboard channel not found: ${targetChannel}`);
        }
      } catch (err) {
        log('error', 'Scheduled dashboard failed', { error: err.message });
      }
    }
  }
}

// ============ INITIALIZATION ============

async function init() {
  log('info', 'Starting Scout Bot - Research & PM Assistant');

  // Load saved preferences
  loadPreferences(log);

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
          const ignoredBots = config.scout?.ignoreBotUserIds || [];
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
          state.conversationHistory.set(channel.id, []);
        }
      }
    }

    log('info', 'Monitoring channels', { count: state.channels.size });

    await connectWebSocket();

    // Dashboard scheduler - check every 15 minutes
    if (config.dashboard?.enabled) {
      setInterval(checkDashboardSchedule, 15 * 60 * 1000);
      log('info', 'Dashboard scheduler enabled', {
        schedules: config.dashboard.schedules?.length || 0,
        targetChannel: config.dashboard.targetChannel
      });
    }

    // Task processor - check every 30 seconds
    setInterval(processTaskQueue, 30 * 1000);
    log('info', 'Task processor enabled', { interval: '30s' });

    // Populate task queue with unprocessed files on startup
    await populateTasksFromUnprocessedFiles();

    log('info', 'Scout Bot started successfully');
    log('info', 'Commands available: !research, !brainstorm, !github, !summary, !update, !issue, !dashboard, !files, !analyze, !tasks');

  } catch (error) {
    log('error', 'Initialization failed', { error: error.message });
    process.exit(1);
  }
}

init();
