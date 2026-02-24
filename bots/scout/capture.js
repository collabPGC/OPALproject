/**
 * Smart Capture Module for Scout Bot
 * - Channel-to-Board mapping
 * - AI-powered actionable item detection
 * - Auto-creates Focalboard cards and Jira issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addToResearchQueue, addToFollowUpQueue, incrementWeeklyStat } from './memory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Focalboard API helper
async function focalboardApi(endpoint, method = 'GET', body = null) {
  const url = `${config.mattermost.url}/plugins/focalboard/api/v2${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.mattermost.botToken}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Focalboard API error ${response.status}: ${error}`);
  }
  return response.json();
}

// Jira API helper
async function jiraApi(endpoint, method = 'GET', body = null) {
  if (!config.jira?.enabled) return null;

  const url = `${config.jira.instanceUrl}/rest/api/3${endpoint}`;
  const auth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira API error ${response.status}: ${error}`);
  }
  return response.json();
}

// Create a Focalboard card
export async function createCard(boardId, title, description = '', properties = {}) {
  try {
    const card = await focalboardApi(`/boards/${boardId}/cards`, 'POST', {
      title,
      properties,
      contentOrder: []
    });

    // Add description as content block if provided
    if (description && card.id) {
      await focalboardApi(`/boards/${boardId}/blocks`, 'POST', [{
        id: crypto.randomUUID(),
        boardId,
        parentId: card.id,
        type: 'text',
        title: description,
        fields: {}
      }]);
    }

    console.log(`[CAPTURE] Created card: ${title} on board ${boardId}`);
    return card;
  } catch (error) {
    console.error(`[CAPTURE] Failed to create card:`, error.message);
    return null;
  }
}

// Create a Jira issue
export async function createJiraIssue(summary, description, issueType = 'Task', epic = null) {
  if (!config.jira?.enabled) return null;

  try {
    const fields = {
      project: { key: config.jira.defaultProject },
      summary,
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }]
      },
      issuetype: { name: issueType }
    };

    // Link to epic if provided
    if (epic) {
      fields.parent = { key: epic };
    }

    const issue = await jiraApi('/issue', 'POST', { fields });
    console.log(`[CAPTURE] Created Jira issue: ${issue.key} - ${summary}`);
    return issue;
  } catch (error) {
    console.error(`[CAPTURE] Failed to create Jira issue:`, error.message);
    return null;
  }
}

// AI-powered detection of actionable items
export async function detectActionableItems(anthropic, message, channelName, username) {
  const prompt = `Analyze this message for actionable items that should be captured in a project management system.

MESSAGE from @${username} in #${channelName}:
"${message}"

Look for:
1. TASKS: Action items, to-dos, things that need to be done
2. DECISIONS: Choices made, agreements reached
3. BLOCKERS: Issues blocking progress, problems needing resolution
4. IDEAS: Feature ideas, improvements, suggestions
5. BUGS: Bug reports, errors, issues found
6. LINKS: Important resources, documentation, references shared
7. RESEARCH: Questions needing investigation, unknowns requiring analysis, items to evaluate
   - Keywords: "need to investigate", "should look into", "unclear", "TBD", "evaluate options", "figure out", "need to understand"
8. FOLLOW_UP: Items awaiting response/action, pending items, things to circle back on
   - Keywords: "waiting on", "pending", "follow up with", "circle back", "check back", "need response from", "will update when"

Respond with JSON only:
{
  "hasActionableItems": true/false,
  "items": [
    {
      "type": "task|decision|blocker|idea|bug|link|research|follow_up",
      "title": "Short title (max 80 chars)",
      "description": "Fuller description with context",
      "priority": "high|medium|low",
      "createJira": true/false,
      "dueContext": "any time-related context mentioned (optional)",
      "assignee": "person mentioned as responsible (optional)"
    }
  ],
  "summary": "One sentence summary of what was captured"
}

GUIDELINES:
- Only return items that are genuinely actionable or important to track
- Don't capture casual conversation, greetings, or acknowledgments
- For links/resources, capture them as reference items
- Set createJira=true for items that need formal tracking (bugs, blockers, critical tasks)
- RESEARCH items are questions or unknowns that need investigation before action can be taken
- FOLLOW_UP items are waiting on external input or have a future check-in date
- Be conservative - quality over quantity`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { hasActionableItems: false, items: [] };
  } catch (error) {
    console.error(`[CAPTURE] AI detection failed:`, error.message);
    return { hasActionableItems: false, items: [] };
  }
}

// Get board ID for a channel
export function getBoardForChannel(channelId) {
  const mapping = config.capture?.channelBoardMapping || {};
  return mapping[channelId] || null;
}

// Get epic for a channel (for Jira linking)
export function getEpicForChannel(channelId) {
  const mapping = config.capture?.channelEpicMapping || {};
  return mapping[channelId] || null;
}

// Main capture function - call this from handleMessage
export async function captureFromMessage(anthropic, post, channelInfo) {
  const channelId = post.channel_id;
  const message = post.message;
  const username = channelInfo.username || 'unknown';
  const channelName = channelInfo.channelName || 'unknown';

  // Check if capture is enabled for this channel
  const boardId = getBoardForChannel(channelId);
  if (!boardId && !config.capture?.enableGlobalCapture) {
    return null; // Channel not mapped and global capture disabled
  }

  // Skip short messages or commands
  if (message.length < 20 || message.startsWith('!')) {
    return null;
  }

  // AI detection
  const detection = await detectActionableItems(anthropic, message, channelName, username);

  if (!detection.hasActionableItems || !detection.items?.length) {
    return null;
  }

  const results = {
    cards: [],
    jiraIssues: [],
    researchItems: [],
    followUpItems: [],
    summary: detection.summary
  };

  const epicKey = getEpicForChannel(channelId);

  for (const item of detection.items) {
    // Create Focalboard card if board is mapped
    if (boardId) {
      const card = await createCard(
        boardId,
        `[${item.type.toUpperCase()}] ${item.title}`,
        `${item.description}\n\n_Source: #${channelName} (@${username})_`
      );
      if (card) {
        results.cards.push({ ...item, cardId: card.id });
      }
    }

    // Create Jira issue if flagged
    if (item.createJira && config.jira?.enabled) {
      const issueType = item.type === 'bug' ? 'Bug' : 'Task';
      const issue = await createJiraIssue(
        item.title,
        `${item.description}\n\n_Source: #${channelName} (@${username})_`,
        issueType,
        epicKey
      );
      if (issue) {
        results.jiraIssues.push({ ...item, issueKey: issue.key });
      }
    }

    // Add RESEARCH items to Scout's internal queue
    if (item.type === 'research') {
      addToResearchQueue(channelId, {
        title: item.title,
        description: item.description,
        priority: item.priority || 'medium',
        assignee: item.assignee || null,
        sourcePostId: post.id || null
      });
      results.researchItems.push(item);
    }

    // Add FOLLOW_UP items to Scout's internal queue
    if (item.type === 'follow_up') {
      addToFollowUpQueue(channelId, {
        title: item.title,
        description: item.description,
        dueContext: item.dueContext || null,
        assignee: item.assignee || null,
        sourcePostId: post.id || null
      });
      results.followUpItems.push(item);
    }

    // Track weekly stats
    const statMap = {
      task: 'tasks_created',
      decision: 'decisions_made',
      blocker: 'blockers_identified',
      idea: 'ideas_captured',
      research: 'research_items',
      follow_up: 'follow_ups'
    };
    if (statMap[item.type]) {
      incrementWeeklyStat(channelId, statMap[item.type]);
    }
  }

  return results;
}

// Format capture results for posting back to channel
export function formatCaptureMessage(results) {
  const totalItems = (results?.cards?.length || 0) +
                     (results?.jiraIssues?.length || 0) +
                     (results?.researchItems?.length || 0) +
                     (results?.followUpItems?.length || 0);

  if (!results || totalItems === 0) {
    return null;
  }

  let msg = `📋 **Captured ${totalItems} item(s)**\n`;

  if (results.cards?.length) {
    msg += `\n**Board Cards:**\n`;
    for (const card of results.cards) {
      msg += `• ${card.title}\n`;
    }
  }

  if (results.jiraIssues?.length) {
    msg += `\n**Jira Issues:**\n`;
    for (const issue of results.jiraIssues) {
      msg += `• [${issue.issueKey}] ${issue.title}\n`;
    }
  }

  if (results.researchItems?.length) {
    msg += `\n**🔬 Research Queue:**\n`;
    for (const item of results.researchItems) {
      msg += `• ${item.title}\n`;
    }
  }

  if (results.followUpItems?.length) {
    msg += `\n**📅 Follow-up Queue:**\n`;
    for (const item of results.followUpItems) {
      msg += `• ${item.title}${item.dueContext ? ` _(${item.dueContext})_` : ''}\n`;
    }
  }

  return msg;
}

// Store pending captures awaiting approval (postId -> captureData)
const pendingCaptures = new Map();

// Format approval request message
export function formatApprovalRequest(detection, channelName, boardName) {
  if (!detection.hasActionableItems || !detection.items?.length) {
    return null;
  }

  let msg = `📋 **Scout detected ${detection.items.length} actionable item(s):**\n\n`;

  for (const item of detection.items) {
    const typeEmoji = {
      task: '📌',
      decision: '✅',
      blocker: '🚫',
      idea: '💡',
      bug: '🐛',
      link: '🔗',
      research: '🔬',
      follow_up: '📅'
    }[item.type] || '📝';

    msg += `${typeEmoji} **[${item.type.toUpperCase()}]** ${item.title}\n`;
    if (item.description && item.description !== item.title) {
      msg += `   _${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}_\n`;
    }
    if (item.createJira) {
      msg += `   → Will also create Jira issue\n`;
    }
    msg += `\n`;
  }

  msg += `**Target Board:** ${boardName || 'Default'}\n\n`;
  msg += `React ✅ to capture these items, or ❌ to skip.`;

  return msg;
}

// Store a pending capture for approval
export function storePendingCapture(postId, captureData) {
  pendingCaptures.set(postId, {
    ...captureData,
    timestamp: Date.now()
  });

  // Clean up old pending captures (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, data] of pendingCaptures) {
    if (data.timestamp < oneHourAgo) {
      pendingCaptures.delete(id);
    }
  }
}

// Get and remove a pending capture
export function getPendingCapture(postId) {
  const data = pendingCaptures.get(postId);
  if (data) {
    pendingCaptures.delete(postId);
  }
  return data;
}

// Check if a post has pending capture
export function hasPendingCapture(postId) {
  return pendingCaptures.has(postId);
}

// Execute approved capture - actually create the cards/issues
export async function executeCapture(anthropic, pendingData) {
  const { detection, channelId, channelName, username } = pendingData;
  const boardId = getBoardForChannel(channelId);
  const epicKey = getEpicForChannel(channelId);

  const results = {
    cards: [],
    jiraIssues: [],
    researchItems: [],
    followUpItems: [],
    summary: detection.summary
  };

  for (const item of detection.items) {
    // Create Focalboard card if board is mapped
    if (boardId) {
      const card = await createCard(
        boardId,
        `[${item.type.toUpperCase()}] ${item.title}`,
        `${item.description}\n\n_Source: #${channelName} (@${username})_`
      );
      if (card) {
        results.cards.push({ ...item, cardId: card.id });
      }
    }

    // Create Jira issue if flagged
    if (item.createJira && config.jira?.enabled) {
      const issueType = item.type === 'bug' ? 'Bug' : 'Task';
      const issue = await createJiraIssue(
        item.title,
        `${item.description}\n\n_Source: #${channelName} (@${username})_`,
        issueType,
        epicKey
      );
      if (issue) {
        results.jiraIssues.push({ ...item, issueKey: issue.key });
      }
    }

    // Add RESEARCH items to Scout's internal queue for tracking
    if (item.type === 'research') {
      addToResearchQueue(channelId, {
        title: item.title,
        description: item.description,
        priority: item.priority || 'medium',
        assignee: item.assignee || null,
        sourcePostId: pendingData.sourcePostId || null
      });
      results.researchItems.push(item);
      console.log(`[CAPTURE] Added to research queue: ${item.title}`);
    }

    // Add FOLLOW_UP items to Scout's internal queue for tracking
    if (item.type === 'follow_up') {
      addToFollowUpQueue(channelId, {
        title: item.title,
        description: item.description,
        dueContext: item.dueContext || null,
        assignee: item.assignee || null,
        sourcePostId: pendingData.sourcePostId || null
      });
      results.followUpItems.push(item);
      console.log(`[CAPTURE] Added to follow-up queue: ${item.title}`);
    }

    // Track weekly stats by type
    const statMap = {
      task: 'tasks_created',
      decision: 'decisions_made',
      blocker: 'blockers_identified',
      idea: 'ideas_captured',
      research: 'research_items',
      follow_up: 'follow_ups'
    };
    if (statMap[item.type]) {
      incrementWeeklyStat(channelId, statMap[item.type]);
    }
  }

  return results;
}
