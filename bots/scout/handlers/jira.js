// Scout Jira integration - CRUD operations and natural language handling

import { detectJiraIntent } from '../ai/intent.js';

// Jira API helper
export async function jiraApi(endpoint, method = 'GET', body = null, ctx) {
  const { config, log } = ctx;
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

export async function createJiraIssue(summary, description, issueType = null, project = null, ctx) {
  const { config } = ctx;
  const projectKey = project || config.jira.defaultProject;
  const type = issueType || config.jira.defaultIssueType;

  const body = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      description: {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
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

export async function createJiraStory(summary, description, acceptanceCriteria = '', ctx) {
  const fullDescription = acceptanceCriteria
    ? `${description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`
    : description;
  return createJiraIssue(summary, fullDescription, 'Story', null, ctx);
}

export async function createJiraBug(summary, description, stepsToReproduce = '', ctx) {
  const fullDescription = stepsToReproduce
    ? `${description}\n\n**Steps to Reproduce:**\n${stepsToReproduce}`
    : description;
  return createJiraIssue(summary, fullDescription, 'Bug', null, ctx);
}

export async function createJiraTask(summary, description, ctx) {
  return createJiraIssue(summary, description, 'Task', null, ctx);
}

export async function searchJiraIssues(jql, maxResults = 50, ctx) {
  const { log } = ctx;
  try {
    const result = await jiraApi(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`, 'GET', null, ctx);
    return result.issues || [];
  } catch (error) {
    log('error', 'Jira search failed', { jql, error: error.message });
    return [];
  }
}

export async function getJiraBacklog(project = null, ctx) {
  const { config } = ctx;
  const projectKey = project || config.jira.defaultProject;
  const jql = `project = ${projectKey} AND status != Done ORDER BY created DESC`;
  return searchJiraIssues(jql, 50, ctx);
}

export async function getJiraIssue(issueKey, ctx) {
  const { log } = ctx;
  try {
    return await jiraApi(`/issue/${issueKey}`, 'GET', null, ctx);
  } catch (error) {
    log('error', 'Failed to get Jira issue', { issueKey, error: error.message });
    return null;
  }
}

export async function updateJiraIssue(issueKey, updates, ctx) {
  const { config } = ctx;
  const body = { fields: {} };
  if (updates.summary) body.fields.summary = updates.summary;
  if (updates.description) {
    body.fields.description = {
      type: 'doc', version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: updates.description }] }]
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

export async function deleteJiraIssue(issueKey, ctx) {
  try {
    await jiraApi(`/issue/${issueKey}`, 'DELETE', null, ctx);
    return { success: true, key: issueKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getJiraTransitions(issueKey, ctx) {
  const { log } = ctx;
  try {
    const result = await jiraApi(`/issue/${issueKey}/transitions`, 'GET', null, ctx);
    return result.transitions || [];
  } catch (error) {
    log('error', 'Failed to get transitions', { issueKey, error: error.message });
    return [];
  }
}

export async function transitionJiraIssue(issueKey, transitionName, ctx) {
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

export async function checkForDuplicates(newSummary, existingIssues, ctx) {
  const { anthropic, config } = ctx;
  if (!existingIssues || existingIssues.length === 0) {
    return { isDuplicate: false, duplicates: [] };
  }

  const existingList = existingIssues.map(i =>
    `- ${i.key}: ${i.fields.summary}`
  ).join('\n');

  const systemPrompt = `You are checking for duplicate Jira issues.
Compare the NEW issue summary against EXISTING issues.
Output JSON: {"isDuplicate": true/false, "duplicateKeys": ["SCRUM-123"], "confidence": "high"/"medium"/"low", "reason": "brief explanation"}`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: `NEW ISSUE: "${newSummary}"\n\nEXISTING ISSUES:\n${existingList}` }]
    });

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (error) {
    ctx.log('error', 'Duplicate check failed', { error: error.message });
  }

  return { isDuplicate: false, duplicates: [] };
}

export async function generateJiraIssue(naturalLanguage, issueType = 'Task', ctx) {
  const { anthropic, config, log } = ctx;
  const systemPrompt = `You are a skilled product manager creating Jira backlog items.
Given a natural language request, create a well-structured Jira issue.
Output as JSON: {"summary": "...", "description": "...", "acceptanceCriteria": "..." (stories only), "stepsToReproduce": "..." (bugs only)}`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Create a ${issueType} from this request:\n\n${naturalLanguage}` }]
    });

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('Could not parse AI response');
  } catch (error) {
    log('error', 'Failed to generate Jira issue', { error: error.message });
    return null;
  }
}

export async function extractAndCreateJiraIssues(discussionText, summaryText, ctx) {
  const { anthropic, config, log } = ctx;
  if (!config.jira?.enabled) {
    log('info', 'Jira not enabled, skipping auto-creation');
    return [];
  }

  const systemPrompt = `You are analyzing a discussion to extract actionable items for a backlog.
Extract items as JSON array: [{"type": "Task", "summary": "...", "description": "...", "owner": "..."}]
Only include ACTIONABLE items. If none, return empty array: []`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Discussion:\n${discussionText}\n\nSummary:\n${summaryText}\n\nExtract actionable items for Jira:` }]
    });

    const jsonMatch = response.content[0].text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items) || items.length === 0) return [];

    log('info', 'Extracting Jira issues from discussion', { count: items.length });

    const existingIssues = await getJiraBacklog(null, ctx);
    const results = [];
    const skipped = [];

    for (const item of items) {
      try {
        const dupCheck = await checkForDuplicates(item.summary, existingIssues, ctx);
        if (dupCheck.isDuplicate && dupCheck.confidence !== 'low') {
          skipped.push({ summary: item.summary, duplicateOf: dupCheck.duplicateKeys, reason: dupCheck.reason });
          continue;
        }

        const description = item.owner
          ? `${item.description}\n\n**Assigned to:** ${item.owner}`
          : item.description;

        const result = await createJiraIssue(item.summary, description, item.type, null, ctx);
        if (result && result.success) {
          results.push({ ...result, summary: item.summary });
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

// Handle natural language Jira request
export async function handleJiraRequest(channelId, message, ctx) {
  const { config, log, anthropic, fetchChannelHistory } = ctx;

  if (!config.jira?.enabled) {
    return "\u{1F4CB} Jira integration isn't configured yet. Ask your admin to set it up!";
  }

  log('info', 'Processing natural language Jira request', { channelId });
  const intent = detectJiraIntent(message);
  log('info', 'Detected Jira intent', intent);

  switch (intent.action) {
    case 'list': {
      const issues = await getJiraBacklog(null, ctx);
      if (!issues || issues.length === 0) return "\u{1F4CB} **Backlog is empty!** No open issues found.";
      const issueList = issues.slice(0, 15).map(i => {
        const status = i.fields.status?.name || 'Unknown';
        const type = i.fields.issuetype?.name || 'Task';
        return `\u2022 **${i.key}** [${type}] ${i.fields.summary} _(${status})_`;
      }).join('\n');
      return `\u{1F4CB} **Current Backlog** (${issues.length} issues):\n\n${issueList}${issues.length > 15 ? '\n\n_...and ' + (issues.length - 15) + ' more_' : ''}`;
    }

    case 'delete': {
      if (!intent.issueKey) return "\u{1F5D1}\uFE0F Which issue should I delete? Please mention the issue key (e.g., SCRUM-123).";
      const result = await deleteJiraIssue(intent.issueKey, ctx);
      return result.success
        ? `\u{1F5D1}\uFE0F **Deleted ${intent.issueKey}** - Issue has been removed.`
        : `\u274C Couldn't delete ${intent.issueKey}: ${result.error}`;
    }

    case 'update': {
      if (!intent.issueKey) return "\u270F\uFE0F Which issue should I update? Please mention the issue key.";
      try {
        const response = await anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 256,
          system: `Extract what should be updated in Jira issue ${intent.issueKey}. Output JSON: {"summary": "new title or null", "description": "new description or null", "priority": "High/Medium/Low or null"}`,
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
            return `\u270F\uFE0F I couldn't determine what to update.`;
          }

          const result = await updateJiraIssue(intent.issueKey, filtered, ctx);
          return result.success
            ? `\u2705 **Updated ${intent.issueKey}**\nChanges: ${Object.keys(filtered).join(', ')}\n[View Issue](${result.url})`
            : `\u274C Couldn't update ${intent.issueKey}: ${result.error}`;
        }
      } catch (e) {
        log('error', 'Update extraction failed', { error: e.message });
      }
      return `\u270F\uFE0F I couldn't understand what to update.`;
    }

    case 'transition': {
      if (!intent.issueKey) return `\u{1F4CA} Which issue should I mark as ${intent.status}?`;
      const result = await transitionJiraIssue(intent.issueKey, intent.status, ctx);
      return result.success
        ? `\u2705 **${intent.issueKey}** is now **${result.newStatus}**`
        : `\u274C Couldn't change status: ${result.error}`;
    }

    case 'create':
    default: {
      const channelHistory = await fetchChannelHistory(channelId, 100);
      if (!channelHistory || channelHistory.length < 2) {
        return "I don't see enough conversation history to analyze.";
      }

      const messageText = channelHistory.map(m => `[${m.username}]: ${m.content}`).join('\n');

      try {
        const summaryResponse = await anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 512,
          system: `Summarize this team discussion concisely. Keep it under 150 words.`,
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
            response += `\u{1F4CB} **Created ${jiraResults.created.length} issue${jiraResults.created.length > 1 ? 's' : ''}:**\n\n${jiraSection}`;
          }
          if (jiraResults.skipped && jiraResults.skipped.length > 0) {
            const skippedSection = jiraResults.skipped.map(s =>
              `\u2022 "${s.summary}" \u2192 duplicate of ${s.duplicateOf.join(', ')}`
            ).join('\n');
            response += `\n\n\u26A0\uFE0F **Skipped ${jiraResults.skipped.length} duplicate${jiraResults.skipped.length > 1 ? 's' : ''}:**\n${skippedSection}`;
          }
          if (response) return response + `\n\n**Summary:**\n${summary}`;
        }

        if (jiraResults && Array.isArray(jiraResults) && jiraResults.length > 0) {
          const jiraSection = jiraResults.map(r =>
            `\u2022 **${r.key}**: ${r.summary} ([View](${r.url}))`
          ).join('\n');
          return `\u{1F4CB} **Created ${jiraResults.length} issue${jiraResults.length > 1 ? 's' : ''}:**\n\n${jiraSection}\n\n**Summary:**\n${summary}`;
        }

        return `\u{1F4DD} **Summary:**\n${summary}\n\n_No specific actionable items found._`;
      } catch (error) {
        log('error', 'Failed to process Jira request', { error: error.message });
        return "Sorry, I had trouble analyzing the conversation.";
      }
    }
  }
}
