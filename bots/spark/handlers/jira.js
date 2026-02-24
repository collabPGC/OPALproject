// Jira integration handlers for Spark

// Jira API helper
async function jiraApi(endpoint, method, body, ctx) {
  const { config, log } = ctx;

  if (!config.jira?.enabled) {
    throw new Error('Jira integration not configured. Set jira.enabled=true in config.json');
  }

  const url = `${config.jira.instanceUrl}/rest/api/3${endpoint}`;
  const auth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');

  const options = {
    method: method || 'GET',
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
async function createJiraIssue(summary, description, issueType, project, ctx) {
  const { config } = ctx;
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
    const result = await jiraApi('/issue', 'POST', body, ctx);
    const issueUrl = `${config.jira.instanceUrl}/browse/${result.key}`;
    return { success: true, key: result.key, url: issueUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create Story with acceptance criteria
async function createJiraStory(summary, description, acceptanceCriteria, ctx) {
  const fullDescription = acceptanceCriteria
    ? `${description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`
    : description;
  return createJiraIssue(summary, fullDescription, 'Story', null, ctx);
}

// Create Bug
async function createJiraBug(summary, description, stepsToReproduce, ctx) {
  const fullDescription = stepsToReproduce
    ? `${description}\n\n**Steps to Reproduce:**\n${stepsToReproduce}`
    : description;
  return createJiraIssue(summary, fullDescription, 'Bug', null, ctx);
}

// Create Task
async function createJiraTask(summary, description, ctx) {
  return createJiraIssue(summary, description, 'Task', null, ctx);
}

// Search Jira issues with JQL
async function searchJiraIssues(jql, maxResults, ctx) {
  const { log } = ctx;
  try {
    const result = await jiraApi(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults || 50}`, 'GET', null, ctx);
    return result.issues || [];
  } catch (error) {
    log('error', 'Jira search failed', { jql, error: error.message });
    return [];
  }
}

// Get backlog issues for the project
async function getJiraBacklog(project, ctx) {
  const { config } = ctx;
  const projectKey = project || config.jira.defaultProject;
  const jql = `project = ${projectKey} AND status != Done ORDER BY created DESC`;
  return searchJiraIssues(jql, 50, ctx);
}

// Get a specific Jira issue
async function getJiraIssue(issueKey, ctx) {
  const { log } = ctx;
  try {
    return await jiraApi(`/issue/${issueKey}`, 'GET', null, ctx);
  } catch (error) {
    log('error', 'Failed to get Jira issue', { issueKey, error: error.message });
    return null;
  }
}

// Update a Jira issue
async function updateJiraIssue(issueKey, updates, ctx) {
  const { config } = ctx;
  const body = { fields: {} };

  if (updates.summary) body.fields.summary = updates.summary;
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
  if (updates.priority) body.fields.priority = { name: updates.priority };

  try {
    await jiraApi(`/issue/${issueKey}`, 'PUT', body, ctx);
    return { success: true, key: issueKey, url: `${config.jira.instanceUrl}/browse/${issueKey}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete a Jira issue
async function deleteJiraIssue(issueKey, ctx) {
  try {
    await jiraApi(`/issue/${issueKey}`, 'DELETE', null, ctx);
    return { success: true, key: issueKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get available transitions for an issue
async function getJiraTransitions(issueKey, ctx) {
  const { log } = ctx;
  try {
    const result = await jiraApi(`/issue/${issueKey}/transitions`, 'GET', null, ctx);
    return result.transitions || [];
  } catch (error) {
    log('error', 'Failed to get transitions', { issueKey, error: error.message });
    return [];
  }
}

// Transition a Jira issue (change status)
async function transitionJiraIssue(issueKey, transitionName, ctx) {
  try {
    const transitions = await getJiraTransitions(issueKey, ctx);
    const transition = transitions.find(t =>
      t.name.toLowerCase() === transitionName.toLowerCase() ||
      t.to.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!transition) {
      const available = transitions.map(t => t.name).join(', ');
      return { success: false, error: `Transition "${transitionName}" not found. Available: ${available}` };
    }

    await jiraApi(`/issue/${issueKey}/transitions`, 'POST', { transition: { id: transition.id } }, ctx);
    return { success: true, key: issueKey, newStatus: transition.to.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check for duplicate issues using AI
async function checkForDuplicates(newSummary, existingIssues, ctx) {
  const { anthropic, config, log } = ctx;

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
  "duplicateKeys": ["SCRUM-123"],
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
async function generateJiraIssue(naturalLanguage, issueType, ctx) {
  const { anthropic, config, log } = ctx;

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
        content: `Create a ${issueType || 'Task'} from this request:\n\n${naturalLanguage}`
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

// Extract action items and create Jira issues automatically
async function extractAndCreateJiraIssues(discussionText, summaryText, ctx) {
  const { anthropic, config, log } = ctx;

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
      log('info', 'No actionable items found for Jira');
      return [];
    }

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    log('info', 'Extracting Jira issues from discussion', { count: items.length });

    const existingIssues = await getJiraBacklog(null, ctx);
    log('info', 'Checking against existing backlog', { existingCount: existingIssues.length });

    const results = [];
    const skipped = [];

    for (const item of items) {
      try {
        const dupCheck = await checkForDuplicates(item.summary, existingIssues, ctx);

        if (dupCheck.isDuplicate && dupCheck.confidence !== 'low') {
          log('info', 'Skipping duplicate issue', { summary: item.summary, duplicates: dupCheck.duplicateKeys });
          skipped.push({
            summary: item.summary,
            duplicateOf: dupCheck.duplicateKeys,
            reason: dupCheck.reason
          });
          continue;
        }

        const description = item.owner
          ? `${item.description}\n\n**Assigned to:** ${item.owner}`
          : item.description;

        const result = await createJiraIssue(item.summary, description, item.type, null, ctx);
        if (result && result.success) {
          results.push({ ...result, summary: item.summary });
          log('info', 'Created Jira issue from discussion', { key: result.key, type: item.type });
        }
      } catch (err) {
        log('error', 'Failed to create Jira issue', { item: item.summary, error: err.message });
      }
    }

    return { created: results, skipped };
  } catch (error) {
    log('error', 'Failed to extract Jira items', { error: error.message });
    return [];
  }
}

// Detect Jira management intent from message
export function detectJiraIntent(message) {
  const lowerMsg = message.toLowerCase();

  const issueKeyMatch = message.match(/\b([A-Z]+-\d+)\b/);
  const issueKey = issueKeyMatch ? issueKeyMatch[1] : null;

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

  return { action: 'create', issueKey };
}

// Handle natural language Jira request
export async function handleJiraRequest(channelId, message, ctx) {
  const { config, anthropic, log, mmApi, fetchChannelHistory } = ctx;

  if (!config.jira?.enabled) {
    return "\ud83d\udccb Jira integration isn't configured yet. Ask your admin to set it up!";
  }

  log('info', 'Processing natural language Jira request', { channelId });

  const intent = detectJiraIntent(message);
  log('info', 'Detected Jira intent', intent);

  switch (intent.action) {
    case 'list': {
      const issues = await getJiraBacklog(null, ctx);
      if (!issues || issues.length === 0) {
        return "\ud83d\udccb **Backlog is empty!** No open issues found.";
      }
      const issueList = issues.slice(0, 15).map(i => {
        const status = i.fields.status?.name || 'Unknown';
        const type = i.fields.issuetype?.name || 'Task';
        return `\u2022 **${i.key}** [${type}] ${i.fields.summary} _(${status})_`;
      }).join('\n');
      return `\ud83d\udccb **Current Backlog** (${issues.length} issues):\n\n${issueList}${issues.length > 15 ? '\n\n_...and ' + (issues.length - 15) + ' more_' : ''}`;
    }

    case 'delete': {
      if (!intent.issueKey) {
        return "\ud83d\uddd1\ufe0f Which issue should I delete? Please mention the issue key (e.g., SCRUM-123).";
      }
      const result = await deleteJiraIssue(intent.issueKey, ctx);
      if (result.success) {
        return `\ud83d\uddd1\ufe0f **Deleted ${intent.issueKey}** - Issue has been removed from the backlog.`;
      }
      return `\u274c Couldn't delete ${intent.issueKey}: ${result.error}`;
    }

    case 'update': {
      if (!intent.issueKey) {
        return "\u270f\ufe0f Which issue should I update? Please mention the issue key (e.g., SCRUM-123) and what to change.";
      }
      const updatePrompt = `Extract what should be updated in Jira issue ${intent.issueKey} from this message.
Output JSON: {"summary": "new title or null", "description": "new description or null", "priority": "High/Medium/Low or null"}
Only include fields that should change.`;
      try {
        const response = await anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 256,
          system: updatePrompt,
          messages: [{ role: 'user', content: message }]
        });
        const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const updates = JSON.parse(jsonMatch[0]);
          const filtered = {};
          if (updates.summary) filtered.summary = updates.summary;
          if (updates.description) filtered.description = updates.description;
          if (updates.priority) filtered.priority = updates.priority;

          if (Object.keys(filtered).length === 0) {
            return `\u270f\ufe0f I couldn't determine what to update. Try: "update ${intent.issueKey} title to 'New Title'" or "change ${intent.issueKey} priority to High"`;
          }

          const result = await updateJiraIssue(intent.issueKey, filtered, ctx);
          if (result.success) {
            return `\u2705 **Updated ${intent.issueKey}**\n\nChanges applied: ${Object.keys(filtered).join(', ')}\n[View Issue](${result.url})`;
          }
          return `\u274c Couldn't update ${intent.issueKey}: ${result.error}`;
        }
      } catch (e) {
        log('error', 'Update extraction failed', { error: e.message });
      }
      return `\u270f\ufe0f I couldn't understand what to update. Try being more specific about what to change.`;
    }

    case 'transition': {
      if (!intent.issueKey) {
        return `\ud83d\udcca Which issue should I mark as ${intent.status}? Please mention the issue key (e.g., SCRUM-123).`;
      }
      const result = await transitionJiraIssue(intent.issueKey, intent.status, ctx);
      if (result.success) {
        return `\u2705 **${intent.issueKey}** is now **${result.newStatus}**`;
      }
      return `\u274c Couldn't change status: ${result.error}`;
    }

    case 'create':
    default: {
      const channelHistory = await fetchChannelHistory(channelId, 100);

      if (!channelHistory || channelHistory.length < 2) {
        return "I don't see enough conversation history to analyze. Have a discussion first, then ask me to create backlog items!";
      }

      log('info', 'Fetched channel history for Jira analysis', { messageCount: channelHistory.length });

      const messageText = channelHistory.map(m =>
        `[${m.username}]: ${m.content}`
      ).join('\n');

      const summaryPrompt = `Summarize this team discussion concisely, highlighting:
1. Key decisions made
2. Action items identified
3. Open questions

Keep it under 150 words.`;

      try {
        const summaryResponse = await anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 512,
          system: summaryPrompt,
          messages: [{ role: 'user', content: messageText }]
        });
        const summary = summaryResponse.content[0].text;

        const jiraResults = await extractAndCreateJiraIssues(messageText, summary, ctx);

        if (jiraResults && jiraResults.created) {
          let response = '';

          if (jiraResults.created.length > 0) {
            const jiraSection = jiraResults.created.map(r =>
              `\u2022 **${r.key}**: ${r.summary} ([View](${r.url}))`
            ).join('\n');
            response += `\ud83d\udccb **Created ${jiraResults.created.length} issue${jiraResults.created.length > 1 ? 's' : ''}:**\n\n${jiraSection}`;
          }

          if (jiraResults.skipped && jiraResults.skipped.length > 0) {
            const skippedSection = jiraResults.skipped.map(s =>
              `\u2022 "${s.summary}" \u2192 duplicate of ${s.duplicateOf.join(', ')}`
            ).join('\n');
            response += `\n\n\u26a0\ufe0f **Skipped ${jiraResults.skipped.length} duplicate${jiraResults.skipped.length > 1 ? 's' : ''}:**\n${skippedSection}`;
          }

          if (response) {
            return response + `\n\n**Summary:**\n${summary}`;
          }
        }

        if (jiraResults && Array.isArray(jiraResults) && jiraResults.length > 0) {
          const jiraSection = jiraResults.map(r =>
            `\u2022 **${r.key}**: ${r.summary} ([View](${r.url}))`
          ).join('\n');
          return `\ud83d\udccb **Created ${jiraResults.length} issue${jiraResults.length > 1 ? 's' : ''}:**\n\n${jiraSection}\n\n**Summary:**\n${summary}`;
        }

        return `\ud83d\udcdd **Summary:**\n${summary}\n\n_I didn't find specific actionable items to create as Jira issues. If you have specific tasks in mind, just tell me what to create!_`;
      } catch (error) {
        log('error', 'Failed to process Jira request', { error: error.message });
        return "Sorry, I had trouble analyzing the conversation. Try again in a moment.";
      }
    }
  }
}

// Export the helper functions for use by commands.js
export {
  generateJiraIssue,
  createJiraStory,
  createJiraBug,
  createJiraTask,
  createJiraIssue,
  getJiraBacklog,
  searchJiraIssues
};
