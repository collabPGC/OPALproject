// Shared Jira integration module
import { log } from './logger.js';

let config = null;
let anthropic = null;

export function init(cfg, anthropicClient) {
  config = cfg;
  anthropic = anthropicClient;
}

// Jira API helper
export async function jiraApi(endpoint, method = 'GET', body = null) {
  if (!config.jira?.enabled) {
    throw new Error('Jira integration not configured. Set jira.enabled=true in config.json');
  }

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
  const text = await response.text();

  if (!response.ok) {
    log('error', 'Jira API error', { status: response.status, body: text });
    throw new Error(`Jira API error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

// Create Jira issue
export async function createJiraIssue(summary, description, issueType = null, project = null) {
  const projectKey = project || config.jira.defaultProject;
  const type = issueType || config.jira.defaultIssueType;

  const body = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }]
      },
      issuetype: { name: type }
    }
  };

  try {
    const result = await jiraApi('/issue', 'POST', body);
    const issueUrl = `${config.jira.instanceUrl}/browse/${result.key}`;
    return { success: true, key: result.key, url: issueUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create Story with acceptance criteria
export async function createJiraStory(summary, description, acceptanceCriteria = '') {
  const fullDescription = acceptanceCriteria
    ? `${description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`
    : description;

  return createJiraIssue(summary, fullDescription, 'Story');
}

// Create Bug
export async function createJiraBug(summary, description, stepsToReproduce = '') {
  const fullDescription = stepsToReproduce
    ? `${description}\n\n**Steps to Reproduce:**\n${stepsToReproduce}`
    : description;

  return createJiraIssue(summary, fullDescription, 'Bug');
}

// Create Task
export async function createJiraTask(summary, description) {
  return createJiraIssue(summary, description, 'Task');
}

// Search Jira issues with JQL
export async function searchJiraIssues(jql, maxResults = 50) {
  try {
    const result = await jiraApi(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
    return result.issues || [];
  } catch (error) {
    log('error', 'Jira search failed', { jql, error: error.message });
    return [];
  }
}

// Get backlog issues for the project
export async function getJiraBacklog(project = null) {
  const projectKey = project || config.jira.defaultProject;
  const jql = `project = ${projectKey} AND status != Done ORDER BY created DESC`;
  return searchJiraIssues(jql);
}

// Get a specific Jira issue
export async function getJiraIssue(issueKey) {
  try {
    return await jiraApi(`/issue/${issueKey}`);
  } catch (error) {
    log('error', 'Failed to get Jira issue', { issueKey, error: error.message });
    return null;
  }
}

// Update a Jira issue
export async function updateJiraIssue(issueKey, updates) {
  const body = { fields: {} };

  if (updates.summary) {
    body.fields.summary = updates.summary;
  }

  if (updates.description) {
    body.fields.description = {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: updates.description }]
      }]
    };
  }

  if (updates.priority) {
    body.fields.priority = { name: updates.priority };
  }

  try {
    await jiraApi(`/issue/${issueKey}`, 'PUT', body);
    return { success: true, key: issueKey, url: `${config.jira.instanceUrl}/browse/${issueKey}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete a Jira issue
export async function deleteJiraIssue(issueKey) {
  try {
    await jiraApi(`/issue/${issueKey}`, 'DELETE');
    return { success: true, key: issueKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get available transitions for an issue
export async function getJiraTransitions(issueKey) {
  try {
    const result = await jiraApi(`/issue/${issueKey}/transitions`);
    return result.transitions || [];
  } catch (error) {
    log('error', 'Failed to get transitions', { issueKey, error: error.message });
    return [];
  }
}

// Transition a Jira issue (change status)
export async function transitionJiraIssue(issueKey, transitionName) {
  try {
    const transitions = await getJiraTransitions(issueKey);
    const transition = transitions.find(t =>
      t.name.toLowerCase() === transitionName.toLowerCase() ||
      t.to.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!transition) {
      const available = transitions.map(t => t.name).join(', ');
      return { success: false, error: `Transition "${transitionName}" not found. Available: ${available}` };
    }

    await jiraApi(`/issue/${issueKey}/transitions`, 'POST', { transition: { id: transition.id } });
    return { success: true, key: issueKey, newStatus: transition.to.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check for duplicate issues using AI
export async function checkForDuplicates(newSummary, existingIssues) {
  if (!existingIssues || existingIssues.length === 0) {
    return { isDuplicate: false, duplicates: [] };
  }

  const existingList = existingIssues.map(i =>
    `- ${i.key}: ${i.fields.summary}`
  ).join('\n');

  const systemPrompt = `You are checking for duplicate Jira issues.

Compare the NEW issue summary against EXISTING issues. An issue is a duplicate if:
1. It describes the same task/bug/feature
2. It has very similar wording or intent
3. Completing one would essentially complete the other

Output JSON:
{
  "isDuplicate": true/false,
  "duplicateKeys": ["SCRUM-123"], // keys of duplicate issues, empty if none
  "confidence": "high"/"medium"/"low",
  "reason": "brief explanation"
}`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `NEW ISSUE: "${newSummary}"\n\nEXISTING ISSUES:\n${existingList}`
      }]
    });

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    log('error', 'Duplicate check failed', { error: error.message });
  }

  return { isDuplicate: false, duplicates: [] };
}

// AI-enhanced: Generate well-structured Jira issue from natural language
export async function generateJiraIssue(naturalLanguage, issueType = 'Task') {
  const systemPrompt = `You are a skilled product manager creating Jira backlog items.

Given a natural language request, create a well-structured Jira issue with:
1. **Summary**: Clear, concise title (max 100 chars)
2. **Description**: Detailed description with context
3. **Acceptance Criteria** (for Stories): Bullet points of "Given/When/Then" or checkboxes
4. **Steps to Reproduce** (for Bugs): Numbered steps

Output as JSON:
{
  "summary": "...",
  "description": "...",
  "acceptanceCriteria": "..." (only for stories),
  "stepsToReproduce": "..." (only for bugs)
}`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create a ${issueType} from this request:\n\n${naturalLanguage}`
      }]
    });

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse AI response');
  } catch (error) {
    log('error', 'Failed to generate Jira issue', { error: error.message });
    return null;
  }
}

// Detect Jira intent from natural language
export function detectJiraIntent(message) {
  const lowerMsg = message.toLowerCase();

  // Check for issue key pattern (e.g., SCRUM-123)
  const issueKeyMatch = message.match(/\b([A-Z]+-\d+)\b/);
  const issueKey = issueKeyMatch ? issueKeyMatch[1] : null;

  // Detect intent
  if (lowerMsg.includes('show') && (lowerMsg.includes('backlog') || lowerMsg.includes('issues') || lowerMsg.includes('tickets'))) {
    return { action: 'list', issueKey };
  }
  if (lowerMsg.includes('delete') || lowerMsg.includes('remove')) {
    return { action: 'delete', issueKey };
  }
  if (lowerMsg.includes('update') || lowerMsg.includes('change') || lowerMsg.includes('modify') || lowerMsg.includes('edit')) {
    return { action: 'update', issueKey };
  }
  if (lowerMsg.includes('done') || lowerMsg.includes('complete') || lowerMsg.includes('finish') || lowerMsg.includes('close')) {
    return { action: 'transition', status: 'Done', issueKey };
  }
  if (lowerMsg.includes('in progress') || lowerMsg.includes('start') || lowerMsg.includes('working on')) {
    return { action: 'transition', status: 'In Progress', issueKey };
  }
  if (lowerMsg.includes('reopen') || lowerMsg.includes('todo') || lowerMsg.includes('to do')) {
    return { action: 'transition', status: 'To Do', issueKey };
  }

  // Default: create from conversation
  return { action: 'create', issueKey };
}

// Extract and create Jira issues from discussion text
export async function extractAndCreateJiraIssues(discussionText, summaryText, fetchHistoryFn) {
  if (!config.jira?.enabled) {
    log('info', 'Jira not enabled, skipping auto-creation');
    return [];
  }

  const systemPrompt = `You are analyzing a discussion to extract actionable items for a backlog.

Extract items that should become Jira issues. For each item, determine:
1. Type: "Task" (general work), "Story" (user-facing feature), or "Bug" (defect)
2. Summary: Clear, concise title (max 80 chars)
3. Description: Context from the discussion
4. Owner: Who was assigned (if mentioned)

Output as JSON array:
[
  {"type": "Task", "summary": "...", "description": "...", "owner": "..."},
  ...
]

Only include ACTIONABLE items - not questions, decisions, or general discussion points.
If no actionable items, return empty array: []`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Discussion:\n${discussionText}\n\nSummary:\n${summaryText}\n\nExtract actionable items for Jira:`
      }]
    });

    const jsonMatch = response.content[0].text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { created: [], skipped: [] };
    }

    const items = JSON.parse(jsonMatch[0]);
    if (!items.length) {
      return { created: [], skipped: [] };
    }

    // Get existing backlog for duplicate checking
    const existingIssues = await getJiraBacklog();

    const created = [];
    const skipped = [];

    for (const item of items) {
      // Check for duplicates
      const dupCheck = await checkForDuplicates(item.summary, existingIssues);
      if (dupCheck.isDuplicate && dupCheck.confidence !== 'low') {
        log('info', 'Skipping duplicate issue', { summary: item.summary, duplicates: dupCheck.duplicateKeys });
        skipped.push({
          summary: item.summary,
          reason: `Duplicate of ${dupCheck.duplicateKeys.join(', ')}: ${dupCheck.reason}`
        });
        continue;
      }

      let result;
      switch (item.type) {
        case 'Story':
          result = await createJiraStory(item.summary, item.description);
          break;
        case 'Bug':
          result = await createJiraBug(item.summary, item.description);
          break;
        default:
          result = await createJiraTask(item.summary, item.description);
      }

      if (result.success) {
        created.push({
          key: result.key,
          url: result.url,
          type: item.type,
          summary: item.summary,
          owner: item.owner
        });
      }
    }

    return { created, skipped };
  } catch (error) {
    log('error', 'Failed to extract Jira issues', { error: error.message });
    return { created: [], skipped: [] };
  }
}

// Handle natural language Jira request
export async function handleJiraRequest(channelId, message, fetchHistoryFn) {
  if (!config.jira?.enabled) {
    return "Jira integration isn't configured yet. Ask your admin to set it up!";
  }

  log('info', 'Processing natural language Jira request', { channelId });

  const intent = detectJiraIntent(message);
  log('info', 'Detected Jira intent', intent);

  // Handle different intents
  switch (intent.action) {
    case 'list': {
      const issues = await getJiraBacklog();
      if (!issues || issues.length === 0) {
        return "**Backlog is empty!** No open issues found.";
      }
      const issueList = issues.slice(0, 15).map(i => {
        const status = i.fields.status?.name || 'Unknown';
        const type = i.fields.issuetype?.name || 'Task';
        return `- **${i.key}** [${type}] ${i.fields.summary} _(${status})_`;
      }).join('\n');
      return `**Current Backlog** (${issues.length} issues):\n\n${issueList}${issues.length > 15 ? '\n\n_...and ' + (issues.length - 15) + ' more_' : ''}`;
    }

    case 'delete': {
      if (!intent.issueKey) {
        return "Which issue should I delete? Please mention the issue key (e.g., SCRUM-123).";
      }
      const result = await deleteJiraIssue(intent.issueKey);
      if (result.success) {
        return `Deleted **${intent.issueKey}**`;
      }
      return `Failed to delete ${intent.issueKey}: ${result.error}`;
    }

    case 'update': {
      if (!intent.issueKey) {
        return "Which issue should I update? Please mention the issue key (e.g., SCRUM-123).";
      }
      // For updates, we need to parse what they want to change
      const updateMatch = message.match(/(?:summary|title)[:\s]+["']?([^"'\n]+)["']?/i);
      if (updateMatch) {
        const result = await updateJiraIssue(intent.issueKey, { summary: updateMatch[1].trim() });
        if (result.success) {
          return `Updated **${intent.issueKey}**: [View in Jira](${result.url})`;
        }
        return `Failed to update: ${result.error}`;
      }
      return `What would you like to update on ${intent.issueKey}? (e.g., "update SCRUM-123 summary: New title")`;
    }

    case 'transition': {
      if (!intent.issueKey) {
        return `Which issue should I mark as ${intent.status}? Please mention the issue key.`;
      }
      const result = await transitionJiraIssue(intent.issueKey, intent.status);
      if (result.success) {
        return `**${intent.issueKey}** is now **${result.newStatus}**`;
      }
      return `Failed to transition: ${result.error}`;
    }

    case 'create':
    default: {
      // Get channel history for context
      const history = await fetchHistoryFn(channelId);
      const discussionText = history.slice(-20).map(m => `${m.username}: ${m.content}`).join('\n');

      // Extract issues from conversation
      const result = await extractAndCreateJiraIssues(discussionText, message, fetchHistoryFn);

      if (result.created && result.created.length > 0) {
        const createdList = result.created.map(i =>
          `- **${i.key}** [${i.type}]: ${i.summary}${i.owner ? ` (${i.owner})` : ''}\n  [View in Jira](${i.url})`
        ).join('\n');

        let response = `Created ${result.created.length} issue(s):\n\n${createdList}`;

        if (result.skipped && result.skipped.length > 0) {
          const skippedList = result.skipped.map(s => `- ${s.summary}: ${s.reason}`).join('\n');
          response += `\n\n**Skipped duplicates:**\n${skippedList}`;
        }

        return response;
      } else if (result.skipped && result.skipped.length > 0) {
        const skippedList = result.skipped.map(s => `- ${s.summary}: ${s.reason}`).join('\n');
        return `All items already exist in backlog:\n${skippedList}`;
      }

      return "I couldn't find any actionable items to create. Try being more specific about what needs to be done.";
    }
  }
}

export default {
  init,
  jiraApi,
  createJiraIssue,
  createJiraStory,
  createJiraBug,
  createJiraTask,
  searchJiraIssues,
  getJiraBacklog,
  getJiraIssue,
  updateJiraIssue,
  deleteJiraIssue,
  getJiraTransitions,
  transitionJiraIssue,
  checkForDuplicates,
  generateJiraIssue,
  detectJiraIntent,
  extractAndCreateJiraIssues,
  handleJiraRequest
};
