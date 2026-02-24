import WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as memory from './memory.js';
import { processUrls, fetchWebPage } from './url_utils.js';
import * as pdfUtils from '../shared/pdf-utils.js';
import * as spreadsheetUtils from '../shared/spreadsheet-utils.js';
import semanticMemory from '../shared/memory.js';
import llm from '../shared/llm.js';
import * as ralph from '../shared/ralph-mode.js';
import * as commandRouter from '../shared/command-router.js';
import * as skillLoader from '../shared/skill-loader.js';
import * as personaManager from '../shared/persona-manager.js';
import taskProcessor from '../shared/task-processor.js';
const { taskQueue } = taskProcessor;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Initialize Anthropic client (kept for backward compatibility)
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

// LLM router initialized after log function is defined (see below)

// State management
const state = {
  ws: null,
  botUserId: null,
  channels: new Map(),
  userCache: new Map(),
  standupState: new Map(), // channelId -> { participants: [], responses: [] }
  channelPreferences: new Map(), // channelId -> preferences
  introducedChannels: new Set(), // Track channels where we've shown the hint this session
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 5000
};

// Preferences file path
const prefsFile = path.join(__dirname, 'preferences.json');

// ============ TAVILY WEB SEARCH ============

// Search the web using Tavily API
async function webSearch(query, options = {}) {
  if (!config.tavily?.enabled || !config.tavily?.apiKey || config.tavily.apiKey === 'YOUR_TAVILY_API_KEY') {
    log('warn', 'Tavily not configured, skipping web search');
    return null;
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score
      })) || []
    };
  } catch (error) {
    log('error', 'Web search failed', { query, error: error.message });
    return null;
  }
}

// Polls moved to Socialite bot

// Load preferences from file
function loadPreferences() {
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
function savePreferences() {
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
function getChannelPrefs(channelId) {
  if (!state.channelPreferences.has(channelId)) {
    state.channelPreferences.set(channelId, {
      standupTime: '9:00', // preferred standup time
      retroFormat: 'standard', // standard, starfish, sailboat
      brainstormStyle: 'mixed', // scamper, sixhats, hmw, mixed
      engagementLevel: 'medium', // low, medium, high
      icebreakersEnabled: true,
      celebrationsEnabled: true,
      feedback: []
    });
  }
  return state.channelPreferences.get(channelId);
}

// Logging
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

// Initialize LLM router (deferred until log function is defined)
llm.init({ log }).catch(err => {
  console.error('[Spark] LLM router init failed:', err.message);
});

// Mattermost API helper
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

// Post message to channel
async function postMessage(channelId, message, rootId = null) {
  const body = {
    channel_id: channelId,
    message: message
  };
  if (rootId) body.root_id = rootId;

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
  } catch (error) {
    log('error', 'Failed to post message', { channelId, error: error.message });
  }
}

// Generate a brief summary of long content using Claude Haiku
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
    // Fallback: truncate content
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
    // 1. Generate summary first
    const summary = await generateSummary(content, config.contentSplitting.summaryMaxChars || 500);

    // 2. Post summary as main message
    const summaryMessage = `${summary}\n\n:thread: **Full ${commandType} in thread** ↓`;
    const summaryBody = {
      channel_id: channelId,
      message: summaryMessage
    };
    if (rootId) summaryBody.root_id = rootId;

    const summaryResult = await mmApi('/posts', 'POST', summaryBody);
    log('info', 'Posted summary', { channelId, summaryLength: summary.length, commandType });

    // 3. Post full content as thread reply under the summary
    const fullContentBody = {
      channel_id: channelId,
      message: `## Full ${commandType.charAt(0).toUpperCase() + commandType.slice(1)}\n\n${content}`,
      root_id: summaryResult.id  // Thread under the summary
    };

    const fullResult = await mmApi('/posts', 'POST', fullContentBody);
    log('info', 'Posted full content in thread', {
      channelId,
      messageLength: content.length,
      threadRoot: summaryResult.id
    });

    // Persist to memory
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
    // Fallback to normal posting if splitting fails
    return postMessage(channelId, content, rootId);
  }
}

// Add first-response hint if this is the first interaction in channel this session
function maybeAddHint(channelId, response) {
  if (!state.introducedChannels.has(channelId)) {
    state.introducedChannels.add(channelId);
    return response + `\n\n---\n_💡 Tip: Type \`!spark\` to see all my commands_`;
  }
  return response;
}

// Fetch channel history from Mattermost API
async function fetchChannelHistory(channelId, limit = 100) {
  try {
    const data = await mmApi(`/channels/${channelId}/posts?per_page=${limit}`);
    if (!data.posts || !data.order) {
      return [];
    }

    // Sort posts by timestamp (oldest first for conversation flow)
    const posts = data.order.map(id => data.posts[id]).reverse();

    // Get user info for each unique user
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

    // Format messages with usernames
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

// ============ JIRA INTEGRATION ============

// Jira API helper
async function jiraApi(endpoint, method = 'GET', body = null) {
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
async function createJiraIssue(summary, description, issueType = null, project = null) {
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
async function createJiraStory(summary, description, acceptanceCriteria = '') {
  const fullDescription = acceptanceCriteria
    ? `${description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`
    : description;

  return createJiraIssue(summary, fullDescription, 'Story');
}

// Create Bug
async function createJiraBug(summary, description, stepsToReproduce = '') {
  const fullDescription = stepsToReproduce
    ? `${description}\n\n**Steps to Reproduce:**\n${stepsToReproduce}`
    : description;

  return createJiraIssue(summary, fullDescription, 'Bug');
}

// Create Task
async function createJiraTask(summary, description) {
  return createJiraIssue(summary, description, 'Task');
}

// Search Jira issues with JQL
async function searchJiraIssues(jql, maxResults = 50) {
  try {
    const result = await jiraApi(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
    return result.issues || [];
  } catch (error) {
    log('error', 'Jira search failed', { jql, error: error.message });
    return [];
  }
}

// Get backlog issues for the project
async function getJiraBacklog(project = null) {
  const projectKey = project || config.jira.defaultProject;
  const jql = `project = ${projectKey} AND status != Done ORDER BY created DESC`;
  return searchJiraIssues(jql);
}

// Get a specific Jira issue
async function getJiraIssue(issueKey) {
  try {
    return await jiraApi(`/issue/${issueKey}`);
  } catch (error) {
    log('error', 'Failed to get Jira issue', { issueKey, error: error.message });
    return null;
  }
}

// Update a Jira issue
async function updateJiraIssue(issueKey, updates) {
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
async function deleteJiraIssue(issueKey) {
  try {
    await jiraApi(`/issue/${issueKey}`, 'DELETE');
    return { success: true, key: issueKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get available transitions for an issue
async function getJiraTransitions(issueKey) {
  try {
    const result = await jiraApi(`/issue/${issueKey}/transitions`);
    return result.transitions || [];
  } catch (error) {
    log('error', 'Failed to get transitions', { issueKey, error: error.message });
    return [];
  }
}

// Transition a Jira issue (change status)
async function transitionJiraIssue(issueKey, transitionName) {
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
async function checkForDuplicates(newSummary, existingIssues) {
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
async function generateJiraIssue(naturalLanguage, issueType = 'Task') {
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

// ============ GITHUB INTEGRATION ============

// GitHub context storage
const githubContextFile = path.join(__dirname, 'github-context.json');
let githubContext = {
  repos: {},
  lastRefresh: null,
  summary: null
};

// Load GitHub context from file
function loadGithubContext() {
  try {
    if (fs.existsSync(githubContextFile)) {
      githubContext = JSON.parse(fs.readFileSync(githubContextFile, 'utf8'));
      log('info', 'Loaded GitHub context', {
        repoCount: Object.keys(githubContext.repos).length,
        lastRefresh: githubContext.lastRefresh
      });
    }
  } catch (error) {
    log('error', 'Failed to load GitHub context', { error: error.message });
  }
}

// Save GitHub context to file
function saveGithubContext() {
  try {
    fs.writeFileSync(githubContextFile, JSON.stringify(githubContext, null, 2));
    log('info', 'Saved GitHub context');
  } catch (error) {
    log('error', 'Failed to save GitHub context', { error: error.message });
  }
}

// GitHub API helper
async function githubApi(endpoint, method = 'GET') {
  if (!config.github?.enabled || !config.github?.token) {
    throw new Error('GitHub integration not configured');
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${config.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Spark-Bot'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${error}`);
  }

  return response.json();
}

// Fetch repository info
async function fetchRepoInfo(owner, repo) {
  try {
    const info = await githubApi(`/repos/${owner}/${repo}`);
    return {
      name: info.name,
      fullName: info.full_name,
      description: info.description,
      language: info.language,
      defaultBranch: info.default_branch,
      topics: info.topics || [],
      stars: info.stargazers_count,
      forks: info.forks_count,
      openIssues: info.open_issues_count,
      createdAt: info.created_at,
      updatedAt: info.updated_at,
      url: info.html_url
    };
  } catch (error) {
    log('error', 'Failed to fetch repo info', { owner, repo, error: error.message });
    return null;
  }
}

// Fetch directory tree (top-level + key directories)
async function fetchRepoTree(owner, repo, branch = 'main') {
  try {
    const tree = await githubApi(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

    // Build directory structure
    const structure = {
      directories: [],
      files: [],
      keyFiles: []
    };

    const keyFilePatterns = [
      'README.md', 'readme.md', 'README',
      'package.json', 'package-lock.json',
      'Cargo.toml', 'go.mod', 'requirements.txt', 'Pipfile',
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      '.env.example', 'config.json', 'config.yaml', 'config.yml',
      'tsconfig.json', 'webpack.config.js', 'vite.config.js',
      'Makefile', 'justfile',
      '.github/workflows'
    ];

    for (const item of tree.tree.slice(0, 500)) { // Limit to prevent huge repos
      if (item.type === 'tree' && item.path.split('/').length === 1) {
        structure.directories.push(item.path);
      } else if (item.type === 'blob') {
        if (item.path.split('/').length === 1) {
          structure.files.push(item.path);
        }
        if (keyFilePatterns.some(p => item.path.includes(p) || item.path === p)) {
          structure.keyFiles.push(item.path);
        }
      }
    }

    return structure;
  } catch (error) {
    log('error', 'Failed to fetch repo tree', { owner, repo, error: error.message });
    return null;
  }
}

// Fetch README content
async function fetchReadme(owner, repo) {
  try {
    const readme = await githubApi(`/repos/${owner}/${repo}/readme`);
    const content = Buffer.from(readme.content, 'base64').toString('utf8');
    // Truncate if too long
    return content.length > 4000 ? content.substring(0, 4000) + '\n...(truncated)' : content;
  } catch (error) {
    log('warn', 'No README found', { owner, repo });
    return null;
  }
}

// Fetch package.json or similar config
async function fetchPackageJson(owner, repo) {
  try {
    const file = await githubApi(`/repos/${owner}/${repo}/contents/package.json`);
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Fetch recent commits
async function fetchRecentCommits(owner, repo, limit = 50) {
  try {
    const commits = await githubApi(`/repos/${owner}/${repo}/commits?per_page=${limit}`);
    return commits.map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0], // First line only
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url
    }));
  } catch (error) {
    log('error', 'Failed to fetch commits', { owner, repo, error: error.message });
    return [];
  }
}

// Fetch open pull requests
async function fetchOpenPRs(owner, repo, limit = 20) {
  try {
    const prs = await githubApi(`/repos/${owner}/${repo}/pulls?state=open&per_page=${limit}`);
    return prs.map(pr => ({
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      draft: pr.draft,
      labels: pr.labels.map(l => l.name),
      url: pr.html_url,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref
    }));
  } catch (error) {
    log('error', 'Failed to fetch PRs', { owner, repo, error: error.message });
    return [];
  }
}

// Fetch open issues (excluding PRs)
async function fetchOpenIssues(owner, repo, limit = 30) {
  try {
    const issues = await githubApi(`/repos/${owner}/${repo}/issues?state=open&per_page=${limit}`);
    // Filter out pull requests (they appear in issues API too)
    return issues
      .filter(i => !i.pull_request)
      .map(i => ({
        number: i.number,
        title: i.title,
        author: i.user.login,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        labels: i.labels.map(l => l.name),
        assignees: i.assignees.map(a => a.login),
        url: i.html_url
      }));
  } catch (error) {
    log('error', 'Failed to fetch issues', { owner, repo, error: error.message });
    return [];
  }
}

// Fetch contributors
async function fetchContributors(owner, repo, limit = 20) {
  try {
    const contributors = await githubApi(`/repos/${owner}/${repo}/contributors?per_page=${limit}`);
    return contributors.map(c => ({
      login: c.login,
      contributions: c.contributions,
      url: c.html_url
    }));
  } catch (error) {
    log('error', 'Failed to fetch contributors', { owner, repo, error: error.message });
    return [];
  }
}

// Full repository onboarding
async function onboardRepository(repoFullName) {
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  log('info', 'Onboarding repository', { repoFullName });

  try {
    // Fetch all data in parallel
    const [info, tree, readme, packageJson, commits, prs, issues, contributors] = await Promise.all([
      fetchRepoInfo(owner, repo),
      fetchRepoTree(owner, repo).then(t => t || fetchRepoTree(owner, repo, 'master')), // Try main, then master
      fetchReadme(owner, repo),
      fetchPackageJson(owner, repo),
      fetchRecentCommits(owner, repo, config.github.maxCommits || 50),
      fetchOpenPRs(owner, repo, config.github.maxPRs || 20),
      fetchOpenIssues(owner, repo, config.github.maxIssues || 30),
      fetchContributors(owner, repo)
    ]);

    if (!info) {
      return { success: false, error: 'Could not access repository. Check the name and permissions.' };
    }

    // Detect tech stack from various signals
    const techStack = detectTechStack(info, tree, packageJson);

    // Store in context
    githubContext.repos[repoFullName] = {
      info,
      structure: tree,
      readme,
      packageJson,
      techStack,
      commits,
      prs,
      issues,
      contributors,
      onboardedAt: new Date().toISOString()
    };

    // Update config with repo if not already present
    if (!config.github.repos.includes(repoFullName)) {
      config.github.repos.push(repoFullName);
    }

    saveGithubContext();

    return {
      success: true,
      repo: repoFullName,
      summary: generateRepoSummary(repoFullName)
    };
  } catch (error) {
    log('error', 'Onboarding failed', { repoFullName, error: error.message });
    return { success: false, error: error.message };
  }
}

// ============ GITHUB WRITE FUNCTIONS ============

// GitHub API helper with body support for POST/PUT
async function githubApiWrite(endpoint, method, body = null) {
  if (!config.github?.enabled || !config.github?.token || config.github.token === 'YOUR_GITHUB_TOKEN') {
    throw new Error('GitHub integration not configured. Set github.token in config.json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Spark-Bot',
      'Content-Type': 'application/json'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

// Create a new branch
async function createGitHubBranch(owner, repo, branchName, fromBranch = 'main') {
  try {
    // Get SHA of source branch
    const ref = await githubApi(`/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`);
    const sha = ref.object.sha;

    // Create new branch
    const result = await githubApiWrite(`/repos/${owner}/${repo}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`,
      sha: sha
    });
    return { success: true, branch: branchName, sha };
  } catch (error) {
    log('error', 'Failed to create branch', { owner, repo, branchName, error: error.message });
    return { success: false, error: error.message };
  }
}

// Create a pull request
async function createGitHubPR(owner, repo, title, body, headBranch, baseBranch = 'main') {
  try {
    const result = await githubApiWrite(`/repos/${owner}/${repo}/pulls`, 'POST', {
      title,
      body,
      head: headBranch,
      base: baseBranch
    });
    return { success: true, number: result.number, url: result.html_url };
  } catch (error) {
    log('error', 'Failed to create PR', { owner, repo, error: error.message });
    return { success: false, error: error.message };
  }
}

// Create an issue
async function createGitHubIssue(owner, repo, title, body, labels = []) {
  try {
    const result = await githubApiWrite(`/repos/${owner}/${repo}/issues`, 'POST', {
      title,
      body,
      labels
    });
    return { success: true, number: result.number, url: result.html_url };
  } catch (error) {
    log('error', 'Failed to create issue', { owner, repo, error: error.message });
    return { success: false, error: error.message };
  }
}

// Comment on an issue or PR
async function commentOnGitHub(owner, repo, issueNumber, comment) {
  try {
    const result = await githubApiWrite(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, 'POST', {
      body: comment
    });
    return { success: true, id: result.id, url: result.html_url };
  } catch (error) {
    log('error', 'Failed to comment', { owner, repo, issueNumber, error: error.message });
    return { success: false, error: error.message };
  }
}

// Create or update a file
async function updateGitHubFile(owner, repo, filePath, content, commitMessage, branch = 'main') {
  try {
    // Check if file exists to get SHA
    let sha = null;
    try {
      const existing = await githubApi(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`);
      sha = existing.sha;
    } catch (e) {
      // File doesn't exist, that's fine
    }

    const body = {
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch
    };
    if (sha) body.sha = sha;

    const result = await githubApiWrite(`/repos/${owner}/${repo}/contents/${filePath}`, 'PUT', body);
    return { success: true, sha: result.content.sha, url: result.content.html_url };
  } catch (error) {
    log('error', 'Failed to update file', { owner, repo, filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

// Get file contents
async function getGitHubFileContent(owner, repo, filePath, branch = 'main') {
  try {
    const file = await githubApi(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`);
    return {
      success: true,
      content: Buffer.from(file.content, 'base64').toString('utf8'),
      sha: file.sha
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Detect tech stack from repo data
function detectTechStack(info, tree, packageJson) {
  const stack = {
    language: info?.language || 'Unknown',
    frameworks: [],
    tools: [],
    infrastructure: []
  };

  // From package.json dependencies
  if (packageJson?.dependencies) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Frameworks
    if (deps['react']) stack.frameworks.push('React');
    if (deps['vue']) stack.frameworks.push('Vue');
    if (deps['angular'] || deps['@angular/core']) stack.frameworks.push('Angular');
    if (deps['next']) stack.frameworks.push('Next.js');
    if (deps['nuxt']) stack.frameworks.push('Nuxt');
    if (deps['express']) stack.frameworks.push('Express');
    if (deps['fastify']) stack.frameworks.push('Fastify');
    if (deps['nestjs'] || deps['@nestjs/core']) stack.frameworks.push('NestJS');
    if (deps['svelte']) stack.frameworks.push('Svelte');

    // Tools
    if (deps['typescript']) stack.tools.push('TypeScript');
    if (deps['eslint']) stack.tools.push('ESLint');
    if (deps['prettier']) stack.tools.push('Prettier');
    if (deps['jest']) stack.tools.push('Jest');
    if (deps['vitest']) stack.tools.push('Vitest');
    if (deps['webpack']) stack.tools.push('Webpack');
    if (deps['vite']) stack.tools.push('Vite');
    if (deps['tailwindcss']) stack.tools.push('Tailwind CSS');
  }

  // From file structure
  if (tree?.keyFiles) {
    if (tree.keyFiles.some(f => f.includes('Dockerfile'))) stack.infrastructure.push('Docker');
    if (tree.keyFiles.some(f => f.includes('docker-compose'))) stack.infrastructure.push('Docker Compose');
    if (tree.keyFiles.some(f => f.includes('.github/workflows'))) stack.infrastructure.push('GitHub Actions');
    if (tree.keyFiles.some(f => f.includes('terraform'))) stack.infrastructure.push('Terraform');
    if (tree.keyFiles.some(f => f.includes('k8s') || f.includes('kubernetes'))) stack.infrastructure.push('Kubernetes');
  }

  return stack;
}

// Generate summary for a single repo
function generateRepoSummary(repoFullName) {
  const ctx = githubContext.repos[repoFullName];
  if (!ctx) return null;

  const { info, techStack, commits, prs, issues, contributors, structure } = ctx;

  let summary = `## ${info.fullName}\n`;
  summary += `${info.description || 'No description'}\n\n`;

  summary += `**Tech Stack:** ${techStack.language}`;
  if (techStack.frameworks.length) summary += ` | ${techStack.frameworks.join(', ')}`;
  if (techStack.tools.length) summary += ` | ${techStack.tools.join(', ')}`;
  summary += '\n\n';

  if (structure) {
    summary += `**Structure:** ${structure.directories.slice(0, 8).join(', ')}${structure.directories.length > 8 ? '...' : ''}\n\n`;
  }

  summary += `**Activity:**\n`;
  summary += `- ${prs.length} open PRs\n`;
  summary += `- ${issues.length} open issues\n`;
  summary += `- ${commits.length} recent commits\n`;
  summary += `- ${contributors.length} contributors\n\n`;

  if (prs.length > 0) {
    summary += `**Recent PRs:**\n`;
    prs.slice(0, 5).forEach(pr => {
      summary += `- #${pr.number}: ${pr.title} (by ${pr.author})\n`;
    });
    summary += '\n';
  }

  if (issues.length > 0) {
    summary += `**Open Issues:**\n`;
    issues.slice(0, 5).forEach(i => {
      summary += `- #${i.number}: ${i.title}\n`;
    });
  }

  return summary;
}

// Generate overall context summary for AI prompts
function generateCodebaseContext() {
  const repos = Object.keys(githubContext.repos);
  if (repos.length === 0) return null;

  let context = `## Codebase Context (${repos.length} repositories)\n\n`;

  for (const repoName of repos) {
    const ctx = githubContext.repos[repoName];
    if (!ctx) continue;

    const { info, techStack, prs, issues, commits } = ctx;

    context += `### ${repoName}\n`;
    context += `${info.description || 'No description'}\n`;
    context += `Stack: ${techStack.language}${techStack.frameworks.length ? ' + ' + techStack.frameworks.join(', ') : ''}\n`;
    context += `Activity: ${prs.length} PRs, ${issues.length} issues, ${commits.length} recent commits\n`;

    // Recent activity highlights
    if (prs.length > 0) {
      context += `Current PRs: ${prs.slice(0, 3).map(p => `#${p.number} ${p.title}`).join('; ')}\n`;
    }
    if (issues.length > 0) {
      const highPriority = issues.filter(i =>
        i.labels.some(l => l.toLowerCase().includes('bug') || l.toLowerCase().includes('critical'))
      );
      if (highPriority.length > 0) {
        context += `Priority issues: ${highPriority.slice(0, 3).map(i => `#${i.number} ${i.title}`).join('; ')}\n`;
      }
    }
    context += '\n';
  }

  return context;
}

// Refresh all repositories
async function refreshAllRepos() {
  log('info', 'Refreshing all GitHub repositories');

  const repos = config.github.repos || [];
  const results = [];

  for (const repo of repos) {
    const result = await onboardRepository(repo);
    results.push({ repo, ...result });
  }

  githubContext.lastRefresh = new Date().toISOString();
  githubContext.summary = generateCodebaseContext();
  saveGithubContext();

  return results;
}

// Schedule daily refresh
function scheduleGithubRefresh() {
  if (!config.github?.enabled) return;

  const intervalHours = config.github.refreshIntervalHours || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  setInterval(async () => {
    log('info', 'Running scheduled GitHub refresh');
    await refreshAllRepos();
  }, intervalMs);

  log('info', `GitHub refresh scheduled every ${intervalHours} hours`);
}

// ============ STANDUP FACILITATION ============
async function startStandup(channelId) {
  state.standupState.set(channelId, {
    active: true,
    startTime: Date.now(),
    participants: [],
    responses: []
  });

  const message = `**Daily Standup Time!**

Please share your update:
1. **Yesterday:** What did you accomplish?
2. **Today:** What are you working on?
3. **Blockers:** Anything blocking your progress?

Just reply in thread and I'll capture your updates!`;

  await postMessage(channelId, message);
}

async function endStandup(channelId) {
  const standup = state.standupState.get(channelId);
  if (!standup || !standup.active) {
    return "No active standup to end.";
  }

  standup.active = false;

  if (standup.responses.length === 0) {
    return "Standup ended. No updates were shared today.";
  }

  const systemPrompt = `You summarize standup updates concisely. Create a brief summary with:
1. Key accomplishments
2. Today's focus areas
3. Blockers that need attention
4. Action items if any

Keep it short and actionable.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Summarize these standup updates:\n\n${standup.responses.map(r => `**${r.user}:**\n${r.content}`).join('\n\n')}`
      }]
    });

    state.standupState.delete(channelId);
    return `**Standup Summary**\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Standup summary failed', { error: error.message });
    return "Standup ended. (Summary generation failed)";
  }
}

// ============ BRAINSTORMING TECHNIQUES - McKinsey/HBS Quality ============

// Quality preamble for all Spark prompts
const sparkQualityPreamble = `
## YOUR QUALITY STANDARDS (Always Apply)

You deliver McKinsey-quality thinking and Harvard Business School-caliber facilitation:

**Analytical Rigor:**
- MECE structure (Mutually Exclusive, Collectively Exhaustive)
- Evidence-based (cite examples, case studies, or sound logic)
- So-What focused (every insight has clear implications)
- First Principles thinking (break down to fundamentals)

**Communication Excellence:**
- Use vivid METAPHORS to make ideas tangible
  - Draw from: nature, sports, architecture, journeys, cooking, music
  - Example: "This feature is like a Swiss Army knife - versatile but needs the right context"
- Lead with the punchline
- Be crisp and actionable

**Conversation Variety (CRITICAL):**
- NEVER start multiple responses the same way - vary your openings
- Mix conversation styles:
  - Curious: "I'm curious about..." / "What puzzles me is..."
  - Provocative: "Devil's advocate here..." / "The contrarian view..."
  - Direct: "Here's the real question..." / "Let's cut to the chase..."
  - Collaborative: "Building on that..." / "What if we combined..."
  - Challenging: "Push back on me, but..." / "Convince me I'm wrong about..."
- Use unexpected parallels: "This reminds me of how Netflix..." / "It's like when SpaceX..."
- Ask questions that spark discussion, not just "What do you think?"

**Innovation Excellence:**
- Reference historical business parallels ("Apple did this when...")
- Include contrarian perspectives
- Connect to Jobs-to-be-Done framework where relevant
- Estimate probability/feasibility where appropriate

**Clifton StrengthsFinder Awareness:**
When facilitating teams, recognize and leverage the 4 strength domains:

*Strategic Thinking* (Analytical, Futuristic, Ideation, Learner, Strategic):
- These people need data, patterns, and the "why" - give them the big picture
- Engage them with "What patterns do you see?" / "How might this evolve?"

*Relationship Building* (Empathy, Harmony, Includer, Developer, Positivity):
- These people build team cohesion - ask about team dynamics and people impact
- Engage them with "How does this affect the team?" / "Who should we include?"

*Influencing* (Activator, Communication, Competition, Maximizer):
- These people drive action and persuade - give them wins and momentum
- Engage them with "What's the first move?" / "How do we rally people around this?"

*Executing* (Achiever, Discipline, Focus, Responsibility, Restorative):
- These people get things done - give them clear action items and ownership
- Engage them with "What's the concrete next step?" / "Who owns this?"

Tailor facilitation questions to engage all four domains in the room.
`;

async function brainstormSCAMPER(topic) {
  const systemPrompt = `${sparkQualityPreamble}

You are a senior IDEO design partner using the SCAMPER technique - a systematic innovation methodology used by Fortune 500 companies.

## SCAMPER Framework (Apply with McKinsey rigor)

For each element, provide:
1. **The Concept** - Brief definition
2. **Metaphor** - A vivid analogy to make it concrete
3. **3 Bold Ideas** - Specific, actionable innovations
4. **Best Idea Spotlight** - Which has highest potential and why
5. **Historical Parallel** - A company that succeeded with this approach

### S - Substitute
*Metaphor: "Like replacing the horse with the car - what's your combustion engine?"*

### C - Combine
*Metaphor: "Like the smartphone combining phone + camera + computer - what unexpected fusion creates magic?"*

### A - Adapt
*Metaphor: "Like Velcro adapted from burrs in nature - what can you borrow from another domain?"*

### M - Modify/Magnify
*Metaphor: "Like Apple making screens bigger or smaller to find new markets - what extremes reveal opportunities?"*

### P - Put to Other Uses
*Metaphor: "Like Slack pivoting from gaming to enterprise - where else does your solution solve problems?"*

### E - Eliminate
*Metaphor: "Like Southwest eliminating assigned seats - what sacred cow, if removed, creates simplicity?"*

### R - Rearrange/Reverse
*Metaphor: "Like Netflix reversing from DVDs to streaming - what if you flip the model entirely?"*

## Summary
- **Top 3 Ideas Overall** (with feasibility %)
- **Quick Win** (implement in 1 week)
- **Big Bet** (requires investment but transformational)
- **Contrarian Play** (what if the obvious answer is wrong?)`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Apply SCAMPER brainstorming to: ${topic}\n\nDeliver McKinsey-quality innovation analysis.`
      }]
    });
    return response.content[0].text;
  } catch (error) {
    log('error', 'SCAMPER brainstorm failed', { error: error.message });
    return null;
  }
}

async function brainstormSixHats(topic) {
  const systemPrompt = `${sparkQualityPreamble}

You are a senior facilitator trained in Edward de Bono's Six Thinking Hats, combining it with McKinsey analytical rigor.

## Six Thinking Hats Framework

*Overall Metaphor: "Like examining a diamond from six angles - each perspective reveals different facets of the truth."*

### 🎩 White Hat - Facts & Data
*Metaphor: "The scientist's lab coat - just the facts, ma'am"*
- What do we know for certain?
- What data is missing?
- What would a McKinsey data pack show?

### ❤️ Red Hat - Emotions & Intuition
*Metaphor: "The gut check - your inner CEO's instinct"*
- What's the emotional response?
- What does intuition say?
- What would customers feel?

### ⚫ Black Hat - Risks & Caution
*Metaphor: "The devil's advocate - finding the holes before your competitors do"*
- What could go wrong?
- What are the hidden risks?
- Why have others failed here?

### 💛 Yellow Hat - Benefits & Value
*Metaphor: "The optimist's telescope - seeing the treasure at the end"*
- What's the upside potential?
- What value could this create?
- Best case scenario?

### 💚 Green Hat - Creativity & Alternatives
*Metaphor: "The artist's palette - painting possibilities that don't exist yet"*
- What wild alternatives exist?
- What if we 10x'd or 1/10th'd it?
- What would a startup do?

### 💙 Blue Hat - Process & Synthesis
*Metaphor: "The conductor's baton - orchestrating all perspectives into harmony"*
- What's the synthesis?
- What's the decision framework?
- What are the next steps?

## Executive Summary
- **The Verdict:** [One sentence recommendation]
- **Key Insight:** [The non-obvious takeaway]
- **Biggest Risk:** [And how to mitigate]
- **Immediate Next Step:** [Specific, actionable]`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Apply Six Thinking Hats analysis to: ${topic}\n\nDeliver comprehensive multi-perspective analysis.`
      }]
    });
    return response.content[0].text;
  } catch (error) {
    log('error', 'Six Hats brainstorm failed', { error: error.message });
    return null;
  }
}

async function brainstormHMW(topic) {
  const systemPrompt = `${sparkQualityPreamble}

You are a senior design thinking facilitator from Stanford d.school, combining "How Might We" methodology with McKinsey strategic thinking.

## How Might We (HMW) Framework

*Overall Metaphor: "HMW questions are like keys - the right question unlocks doors you didn't know existed."*

### The Art of HMW Questions
- Not too broad ("How might we change the world?")
- Not too narrow ("How might we add a button?")
- The Goldilocks zone: Opens possibility while providing direction

*Metaphor: "Like Goldilocks - not too hot, not too cold, just right"*

### Generate 10 Powerful HMW Questions

For each question, provide:
1. **The HMW Question**
2. **Why This Matters** (Strategic importance)
3. **Reframe Level** (Problem / Solution / Paradigm shift)

Organize into:
- **Questions that challenge assumptions** (3)
- **Questions that explore extremes** (3)
- **Questions that flip the perspective** (2)
- **Questions that go meta** (2)

### Deep Dive: Top 3 Questions

For each top question:
1. **Why it's powerful** (What door does it open?)
2. **Historical Parallel** (Who answered a similar question successfully?)
3. **Quick Ideas** (3 rapid-fire solutions)
4. **MVP Test** (How to validate in 1 week?)

### Synthesis
- **The Killer Question:** [The one HMW that could transform everything]
- **The Contrarian Question:** [What if we asked the opposite?]
- **Recommended Focus:** [Which 2-3 questions to pursue and why]

*Remember: "The quality of your questions determines the quality of your solutions." - Einstein (paraphrased)*`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate How Might We questions for: ${topic}\n\nDeliver Stanford d.school quality design thinking.`
      }]
    });
    return response.content[0].text;
  } catch (error) {
    log('error', 'HMW brainstorm failed', { error: error.message });
    return null;
  }
}

// ============ RETROSPECTIVES ============
async function startRetro(channelId, format = 'standard') {
  const formats = {
    standard: {
      title: "Team Retrospective",
      prompts: [
        "**What went well?** Share wins and successes",
        "**What could be improved?** Identify areas for growth",
        "**Action items:** What will we do differently?"
      ]
    },
    starfish: {
      title: "Starfish Retrospective",
      prompts: [
        "**Keep doing:** What's working well?",
        "**Less of:** What should we reduce?",
        "**More of:** What should we increase?",
        "**Stop doing:** What should we eliminate?",
        "**Start doing:** What new things should we try?"
      ]
    },
    sailboat: {
      title: "Sailboat Retrospective",
      prompts: [
        "**Wind (propelling us forward):** What's helping us move fast?",
        "**Anchor (holding us back):** What's slowing us down?",
        "**Rocks (risks ahead):** What obstacles do we see coming?",
        "**Sun (our goal):** What are we working toward?"
      ]
    }
  };

  const retro = formats[format] || formats.standard;

  const message = `**${retro.title}**

Let's reflect on our recent work:\n\n${retro.prompts.join('\n\n')}

Share your thoughts in the thread!`;

  await postMessage(channelId, message);
}

// ============ TEAM ENGAGEMENT ============
async function generateIcebreaker() {
  const icebreakers = [
    "If you could have any superpower for one day, what would it be and why?",
    "What's the most interesting thing you learned this week (work or personal)?",
    "If you could instantly become an expert in something, what would you choose?",
    "What's a small win you've had recently that made you smile?",
    "If our team was a band, what genre would we play?",
    "What's your go-to productivity hack?",
    "If you could work from anywhere in the world for a month, where would you go?",
    "What's something on your bucket list?",
    "What was your favorite game to play as a kid?",
    "If you could have dinner with anyone (alive or historical), who would it be?"
  ];
  return icebreakers[Math.floor(Math.random() * icebreakers.length)];
}

async function celebrateWin(channelId, achievement) {
  const celebrations = ["", "", "", "", "", ""];
  const emoji = celebrations[Math.floor(Math.random() * celebrations.length)];

  const systemPrompt = `You are an enthusiastic team cheerleader. Write a brief, genuine celebration message for a team achievement. Be warm but not over-the-top. Include a follow-up question to encourage more sharing.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Celebrate this achievement: ${achievement}`
      }]
    });
    return `${emoji} ${response.content[0].text}`;
  } catch (error) {
    return `${emoji} That's awesome! Way to go team!`;
  }
}

// ============ TUTORIALS ============
async function generateTutorial(topic) {
  const systemPrompt = `You create concise, practical tutorials. Format with:
1. Brief intro (1-2 sentences)
2. Prerequisites (if any)
3. Step-by-step instructions (numbered)
4. Pro tips (2-3 bullet points)
5. Common pitfalls to avoid

Keep it scannable with headers and bullet points. Be specific and actionable.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create a tutorial for: ${topic}`
      }]
    });
    return `## Tutorial: ${topic}\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Tutorial generation failed', { error: error.message });
    return null;
  }
}

// ============ COMMAND PARSING ============
function parseCommand(message) {
  const commands = {
    standup: /^!standup\s*(start|end)?$/i,
    scamper: /^!scamper\s+(.+)/i,
    sixhats: /^!sixhats\s+(.+)/i,
    hmw: /^!hmw\s+(.+)/i,
    retro: /^!retro\s*(standard|starfish|sailboat)?$/i,
    icebreaker: /^!icebreaker$/i,
    celebrate: /^!celebrate\s+(.+)/i,
    tutorial: /^!tutorial\s+(.+)/i,
    help: /^!spark\s*help$/i,
    config: /^!config$/i,
    setengagement: /^!setengagement\s+(low|medium|high)$/i,
    setretro: /^!setretro\s+(standard|starfish|sailboat)$/i,
    setbrainstorm: /^!setbrainstorm\s+(scamper|sixhats|hmw|mixed)$/i,
    feedback: /^!feedback\s+(.+)/i,
    askme: /^!askme$/i,
    // Polls moved to Socialite bot - use !pollhelp
    remindme: /^!remindme\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days))\s+(.+)/i,
    teamremind: /^!teamremind\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days))\s+(.+)/i,
    followup: /^!followup\s+(.+)/i,
    cheer: /^!cheer\s+(.+)/i,
    pin: /^!pin$/i,
    // Jira
    story: /^!story\s+(.+)/i,
    bug: /^!bug\s+(.+)/i,
    task: /^!task\s+(.+)/i,
    jira: /^!jira\s+(.+)/i,
    backlog: /^!backlog\s+(.+)/i,
    // GitHub onboarding
    onboard: /^!onboard\s+(.+)/i,
    repos: /^!repos$/i,
    refresh: /^!refresh$/i,
    codebase: /^!codebase$/i,
    pr: /^!pr\s*(\d+)?/i,
    issues: /^!issues\s*(.*)/i,
    // Semantic memory
    memory: /^!memory(?:\s+(stats|search|graph)\s*(.*))?$/i
  };

  for (const [cmd, pattern] of Object.entries(commands)) {
    const match = message.match(pattern);
    if (match) {
      return { command: cmd, args: match.slice(1) };
    }
  }
  return null;
}

// Configuration handlers
function showConfig(channelId) {
  const prefs = getChannelPrefs(channelId);
  return `**Spark Configuration for this channel:**

**Engagement Level:** ${prefs.engagementLevel}
**Default Retro Format:** ${prefs.retroFormat}
**Brainstorm Style:** ${prefs.brainstormStyle}
**Icebreakers:** ${prefs.icebreakersEnabled ? 'Enabled' : 'Disabled'}
**Celebrations:** ${prefs.celebrationsEnabled ? 'Enabled' : 'Disabled'}

**Commands to customize:**
- \`!setengagement low|medium|high\` - How actively I engage
- \`!setretro standard|starfish|sailboat\` - Default retro format
- \`!setbrainstorm scamper|sixhats|hmw|mixed\` - Preferred brainstorm style
- \`!feedback [message]\` - Tell me what to improve
- \`!askme\` - I'll ask what you'd like me to do better`;
}

async function askForPreferences(channelId) {
  return `**I'd love to work better for your team!**

A few questions:
1. **How engaged should I be?** (low / medium / high)
2. **Preferred retro format?** (standard / starfish / sailboat)
3. **Favorite brainstorm technique?** (scamper / sixhats / hmw / mixed)
4. **What could I do better?** Any feedback on how I facilitate?

Just reply with any of these:
- \`!setengagement high\` - I'll be more actively involved
- \`!setretro starfish\` - I'll default to Starfish retros
- \`!setbrainstorm sixhats\` - I'll lean toward Six Hats technique
- \`!feedback shorter standups please\` - I'll adjust my approach

What would you like to tweak?`;
}

// Get AI response
async function getAIResponse(messages, persona = 'default', additionalContext = '') {
  const sparkQualityPreamble = `
## YOUR IDENTITY & STYLE
You are Spark, a friendly, high-energy Project Management Assistant. You channel the vibes of a world-class Scrum Master crossed with an IDEO design facilitator.

**Core Principles:**
- **Action-Oriented:** Always drive towards next steps, owners, and dates.
- **Empathetic:** Acknowledge team feelings and celebrate wins (big or small).
- **Structured:** Use frameworks (Scrum, Kanban, SCAMPER, Six Hats) to organize chaos.
- **Inclusive:** Ensure all voices (introverts/extroverts) are heard.

**Communication Style:**
- Use emojis effectively (⚡, 🚀, ✅) but professionally.
- Be concise but warm.
- Use metaphors related to construction, navigation, or sports.
`;

  const personas = {
    default: `${sparkQualityPreamble}
You are Spark, a friendly PM Assistant focused on team productivity and engagement.

Your specialties:
- Facilitating standups and retrospectives
- Running brainstorming sessions (SCAMPER, Six Hats, HMW)
- Creating tutorials and guides
- Team engagement and morale

Available commands:
- !standup start/end - Daily standup facilitation
- !scamper [topic] - SCAMPER brainstorming
- !sixhats [topic] - Six Thinking Hats analysis
- !hmw [topic] - How Might We questions
- !retro [format] - Start retrospective (standard/starfish/sailboat)
- !icebreaker - Get a fun icebreaker question
- !celebrate [win] - Celebrate a team achievement
- !tutorial [topic] - Generate a quick tutorial

Be warm, encouraging, and action-oriented. Vary your conversation style - be curious, provocative, challenging, or collaborative. End with an engaging follow-up question that sparks discussion.`,

    standup: `${sparkQualityPreamble}
You help facilitate daily standups. Keep things moving, celebrate wins, and note blockers that need attention.

When summarizing or following up:
- Acknowledge wins with genuine (not over-the-top) enthusiasm
- Flag blockers that might need cross-team attention
- Ask varied follow-up questions to different Clifton strength domains:
  - For Strategic thinkers: "What patterns are you noticing across these updates?"
  - For Relationship builders: "Who might be able to help with that blocker?"
  - For Influencers: "What's the one thing we need to nail today?"
  - For Executors: "What's the concrete next step to unblock this?"

Be concise, supportive, and engaging.`,

    brainstorm: `${sparkQualityPreamble}

You are a creative facilitator channeling IDEO and Stanford d.school energy.

When facilitating:
- Build on others' ideas ("Yes, and..." not "But...")
- Use metaphors to make abstract ideas concrete
- Celebrate wild ideas - they often lead to breakthroughs
- Help organize thoughts into themes

Engage different Clifton strengths:
- Challenge Strategic thinkers with "What's the counterintuitive angle here?"
- Ask Relationship builders "How would users feel about this?"
- Energize Influencers with "Which idea has the most viral potential?"
- Ground Executors with "Which is most feasible in 2 weeks?"

Be enthusiastic but focused. Keep the creative energy high.`
  };

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
    // Build system prompt with codebase context if available
    let systemPrompt = personas[persona] || personas.default;

    const codebaseCtx = generateCodebaseContext();
    if (codebaseCtx) {
      systemPrompt += `

## Team's Codebase Context

You have awareness of the team's repositories. Use this to provide context-aware facilitation:

${codebaseCtx}`;
    }

    if (additionalContext) {
        systemPrompt += `

## PERSISTENT MEMORY & RESOURCES
${additionalContext}`;
    }
    
    // FORCE TOOL AWARENESS
    systemPrompt += `

## TOOLS & CAPABILITIES
You have a tool named 'fetch_url' which allows you to read website content. You MUST use this tool if the user provides a URL. Do not say you cannot browse the internet.`;

    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));
    
    // Tool Loop
    let response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: currentMessages,
      tools: tools
    });

    while (response.stop_reason === "tool_use") {
        // Get ALL tool_use blocks from the response
        const toolBlocks = response.content.filter(c => c.type === "tool_use");
        if (toolBlocks.length === 0) break;

        // Add Assistant's Tool Use Request first
        currentMessages.push({ role: "assistant", content: response.content });

        // Process ALL tool_use blocks and collect results
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

        // Add ALL Tool Results in a single user message
        currentMessages.push({
            role: "user",
            content: toolResults
        });

        // Re-prompt LLM
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

// Polls moved to Socialite bot - use !pollhelp

// ============ REMINDERS ============
const reminders = new Map();

function parseTimeString(timeStr) {
  const match = timeStr.match(/(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)/i);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return num * 60 * 1000;
  if (unit.startsWith('h')) return num * 60 * 60 * 1000;
  if (unit.startsWith('d')) return num * 24 * 60 * 60 * 1000;
  return null;
}

async function setReminder(channelId, userId, timeStr, message) {
  const delay = parseTimeString(timeStr);
  if (!delay) {
    return "I couldn't understand that time. Try: `!remindme 30m Review standup notes` or `!remindme 2h Check poll results`";
  }

  const reminderId = Date.now().toString();
  const reminderTime = new Date(Date.now() + delay);

  reminders.set(reminderId, { channelId, userId, message, time: reminderTime });

  setTimeout(async () => {
    const reminder = reminders.get(reminderId);
    if (reminder) {
      await postMessage(reminder.channelId, `⏰ **Reminder for <@${reminder.userId}>:**\n\n${reminder.message}`);
      reminders.delete(reminderId);
    }
  }, delay);

  const timeDisplay = reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `✅ Got it! I'll remind you at **${timeDisplay}**: "${message}"`;
}

// Team reminder (reminds everyone)
async function setTeamReminder(channelId, timeStr, message) {
  const delay = parseTimeString(timeStr);
  if (!delay) return null;

  setTimeout(async () => {
    await postMessage(channelId, `⏰ **Team Reminder:**\n\n${message}\n\n_This was a scheduled reminder._`);
  }, delay);

  const reminderTime = new Date(Date.now() + delay);
  const timeDisplay = reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `✅ Team reminder set for **${timeDisplay}**: "${message}"`;
}

// ============ REACTIONS & CHEERLEADING ============
async function addReaction(postId, emojiName) {
  try {
    await mmApi('/reactions', 'POST', {
      user_id: state.botUserId,
      post_id: postId,
      emoji_name: emojiName
    });
    return true;
  } catch (error) {
    log('error', 'Failed to add reaction', { error: error.message });
    return false;
  }
}

function detectWin(text) {
  const winPatterns = [
    /shipped|launched|released|deployed|went live/i,
    /fixed|resolved|solved|closed/i,
    /completed|finished|done|accomplished/i,
    /merged|approved|passed/i,
    /milestone|achievement|breakthrough/i,
    /\b(won|win|winning)\b/i,
    /great job|well done|kudos|props|shoutout/i,
    /🎉|🚀|✅|💪|🏆|⭐/
  ];
  return winPatterns.some(p => p.test(text));
}

const sparkCheerMessages = [
  "🎉 That's worth celebrating! What made this one work?",
  "🚀 Momentum builds momentum - what's next?",
  "💪 Crushing it! Quick retro: what's the takeaway from this win?",
  "⭐ Love it! Should we shout this out to the broader team?",
  "🏆 Another W on the board! Who else deserves credit?",
  "🔥 On fire! Is there a pattern here we should replicate?",
  "👏 This deserves recognition - want me to draft a celebration post?",
  "✨ Progress! What obstacle did you overcome to get here?"
];

function getSparkCheerMessage() {
  return sparkCheerMessages[Math.floor(Math.random() * sparkCheerMessages.length)];
}

// ============ FILE & VIDEO DETECTION ============

// Download file content from Mattermost
async function downloadFile(fileId) {
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    log('error', 'Failed to download file', { fileId, error: error.message });
    return null;
  }
}

// Extract and parse PDF using shared module
async function extractPdfText(fileId, fileName, fileSize = 0) {
  try {
    const buffer = await downloadFile(fileId);
    if (!buffer) return null;

    return await pdfUtils.parsePdf(buffer, fileName, fileSize, log);
  } catch (error) {
    log('error', 'Failed to extract PDF', { fileName, error: error.message });
    return null;
  }
}

// Extract and parse DOCX using shared module
async function extractDocxText(fileId, fileName, fileSize = 0) {
  try {
    const buffer = await downloadFile(fileId);
    if (!buffer) return null;

    return await pdfUtils.parseDocx(buffer, fileName, fileSize, log);
  } catch (error) {
    log('error', 'Failed to extract DOCX', { fileName, error: error.message });
    return null;
  }
}

async function handleFileUpload(post) {
  if (!post.file_ids || post.file_ids.length === 0) return;

  try {
    const files = await Promise.all(
      post.file_ids.map(id => mmApi(`/files/${id}/info`))
    );

    const fileTypes = files.map(f => {
      const ext = f.extension?.toLowerCase() || '';
      if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
      return 'file';
    });

    // React based on file type
    const reactions = { video: 'movie_camera', image: 'frame_with_picture', document: 'page_facing_up', file: 'paperclip' };
    for (const type of fileTypes) {
      await addReaction(post.id, reactions[type] || 'paperclip');
    }

    // Extract and store document content using shared module
    const pdfFiles = files.filter(f => f.extension?.toLowerCase() === 'pdf');
    const docxFiles = files.filter(f => f.extension?.toLowerCase() === 'docx');
    const extractedDocs = [];

    // Process PDFs
    for (const pdfFile of pdfFiles) {
      const pdfContent = await extractPdfText(pdfFile.id, pdfFile.name, pdfFile.size || 0);
      if (pdfContent && pdfContent.text) {
        extractedDocs.push({
          name: pdfFile.name,
          type: 'pdf',
          pages: pdfContent.pages,
          sizeMB: pdfContent.sizeMB,
          chunks: pdfContent.chunks?.length || 0,
          structured: pdfContent.structured || false
        });

        // Store in channel memory using shared formatter
        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (pdfContent.chunks && pdfContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(pdfFile.name, pdfContent.chunks);
            channelState.messages.push(...memoryEntries);
            log('info', 'Stored PDF chunks in channel memory', { fileName: pdfFile.name, chunks: pdfContent.chunks.length, structured: pdfContent.structured });
          } else {
            channelState.messages.push({
              role: 'system',
              content: `[PDF Document: ${pdfFile.name} - ${pdfContent.pages} pages]\n${pdfContent.text.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }
        }
      }
    }

    // Process DOCX files
    for (const docxFile of docxFiles) {
      const docxContent = await extractDocxText(docxFile.id, docxFile.name, docxFile.size || 0);
      if (docxContent && docxContent.text) {
        extractedDocs.push({
          name: docxFile.name,
          type: 'docx',
          pages: docxContent.pages,
          sizeMB: docxContent.sizeMB,
          chunks: docxContent.chunks?.length || 0,
          structured: docxContent.structured || false
        });

        // Store in channel memory using shared formatter
        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (docxContent.chunks && docxContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(docxFile.name, docxContent.chunks);
            channelState.messages.push(...memoryEntries);
            log('info', 'Stored DOCX chunks in channel memory', { fileName: docxFile.name, chunks: docxContent.chunks.length, structured: docxContent.structured });
          } else {
            channelState.messages.push({
              role: 'system',
              content: `[DOCX Document: ${docxFile.name} - ~${docxContent.pages} pages]\n${docxContent.text.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }
        }
      }
    }

    // Process spreadsheet files (XLS, XLSX, CSV)
    const spreadsheetFiles = files.filter(f => spreadsheetUtils.isSpreadsheet(f.name));
    for (const xlsFile of spreadsheetFiles) {
      try {
        const buffer = await downloadFile(xlsFile.id);
        if (buffer) {
          const result = spreadsheetUtils.processSpreadsheetAttachment(buffer, xlsFile.name, {
            maxRowsPerSheet: 100,
            format: 'markdown',
            includeFormulas: true,
            includeAdvanced: true
          });

          if (result.success) {
            extractedDocs.push({
              name: xlsFile.name,
              type: result.type.replace('.', ''),
              pages: result.sheetCount,
              sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
              chunks: 1,
              structured: true
            });

            // Store in channel memory
            const channelState = state.channels.get(post.channel_id);
            if (channelState) {
              channelState.messages.push({
                role: 'system',
                content: `[Spreadsheet: ${xlsFile.name} - ${result.sheetCount} sheets, ${result.rowCount} rows, ${result.formulaCount} formulas]\n${result.context.substring(0, 50000)}`,
                timestamp: Date.now()
              });
              log('info', 'Stored spreadsheet in channel memory', {
                fileName: xlsFile.name,
                sheets: result.sheetCount,
                rows: result.rowCount,
                formulas: result.formulaCount
              });
            }

            // Index into vector store for semantic search (non-blocking)
            const xlsContent = {
              text: result.context,
              chunks: [{
                text: result.context,
                pageNum: 1,
                heading: `Spreadsheet: ${xlsFile.name}`
              }]
            };
            pdfUtils.indexDocument(xlsContent, xlsFile.name, post.channel_id, log)
              .then(indexResult => {
                if (indexResult.indexed > 0) {
                  log('info', 'Spreadsheet indexed for semantic search', { fileName: xlsFile.name });
                }
              })
              .catch(err => log('warn', 'Spreadsheet vector indexing failed', { fileName: xlsFile.name, error: err.message }));
          } else {
            log('warn', 'Spreadsheet parsing failed', { fileName: xlsFile.name, error: result.error });
          }
        }
      } catch (error) {
        log('error', 'Failed to process spreadsheet', { fileName: xlsFile.name, error: error.message });
      }
    }

    // Generate summary message using shared helper
    const fileReplyTo = post.root_id || post.id;
    if (extractedDocs.length > 0) {
      const summaryMsg = pdfUtils.generateDocSummaryMessage(extractedDocs, 'spark');
      await postMessage(post.channel_id, summaryMsg, fileReplyTo);
    } else if (fileTypes.includes('document')) {
      await postMessage(post.channel_id,
        `📄 Document shared! Need to:\n• Start a discussion thread?\n• Get team consensus on it?\n• Schedule a review session?`,
        fileReplyTo
      );
    }

    if (fileTypes.includes('video')) {
      await postMessage(post.channel_id,
        `🎬 Video uploaded! Want me to:\n• \`!discuss\` the content with the team?\n• \`!poll\` to get reactions?\n• \`!remindme\` to watch it later?`,
        fileReplyTo
      );
    }

  } catch (error) {
    log('error', 'Failed to handle file upload', { error: error.message });
  }
}

// ============ FOLLOW-UP PLANNING ============
async function planFollowUp(channelId, topic) {
  const systemPrompt = `You are a skilled PM facilitator. Given a topic, create a brief follow-up plan.

Generate:
1. **Next Steps** (2-3 concrete actions)
2. **Owner Suggestions** (roles that should own each)
3. **Timeline** (suggested cadence)
4. **Success Criteria** (how we'll know it's done)
5. **Potential Blockers** (what to watch for)

Be concise and actionable. Under 150 words total.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create a follow-up plan for: ${topic}`
      }]
    });

    return `📋 **Follow-Up Plan: ${topic}**\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Follow-up planning failed', { error: error.message });
    return null;
  }
}

// Pin message
async function pinMessage(postId) {
  try {
    await mmApi(`/posts/${postId}/pin`, 'POST');
    return true;
  } catch (error) {
    log('error', 'Failed to pin message', { error: error.message });
    return false;
  }
}

// Check triggers
function isQuestion(text) {
  const patterns = config.spark.questionPatterns;
  return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
}

function hasTriggerKeyword(text) {
  const keywords = config.spark.triggerKeywords;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// ============ CONTEXT AWARENESS ============

// Detect social greetings
function isGreeting(text) {
  const greetingPatterns = [
    /^(hi|hey|hello|howdy|yo|sup|hiya)[\s!.,?]*$/i,
    /^good\s*(morning|afternoon|evening|day)[\s!.,?]*$/i,
    /^(welcome|thanks|thank you|cheers|appreciated)[\s!.,?]*$/i,
    /^(what'?s up|how'?s it going|how are you)[\s!?.,]*$/i,
    /^(gm|gn|gtg|brb|ttyl)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return greetingPatterns.some(p => p.test(cleanText));
}

// Detect farewell/signoff
function isFarewell(text) {
  const farewellPatterns = [
    /^(bye|goodbye|cya|see ya|later|peace|out)[\s!.,?]*$/i,
    /^(have a good|have a great|enjoy your)[\s\w]*$/i,
    /^(talk soon|catch you later|signing off)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return farewellPatterns.some(p => p.test(cleanText));
}

// Detect simple acknowledgment
function isAcknowledgment(text) {
  const ackPatterns = [
    /^(ok|okay|k|got it|thanks|thx|ty|cool|nice|great|awesome|perfect|sounds good)[\s!.,?]*$/i,
    /^(will do|on it|sure|yep|yeah|yes|no|nope)[\s!.,?]*$/i,
    /^(👍|✅|🙏|💯|🎉|👏|🔥|💪)+$/
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return ackPatterns.some(p => p.test(cleanText));
}

// Detect Jira/backlog creation request in natural language
function isJiraRequest(text) {
  const lowerText = text.toLowerCase();
  const jiraKeywords = [
    'jira', 'backlog', 'issue', 'issues', 'ticket', 'tickets',
    'task', 'tasks', 'story', 'stories', 'bug', 'bugs'
  ];
  const actionKeywords = [
    'create', 'make', 'add', 'generate', 'build', 'write',
    'analyze', 'extract', 'find', 'identify', 'pull out',
    'turn into', 'convert'
  ];
  const contextKeywords = [
    'conversation', 'discussion', 'notes', 'meeting', 'chat',
    'action items', 'todo', 'to-do', 'to do'
  ];

  const hasJiraKeyword = jiraKeywords.some(k => lowerText.includes(k));
  const hasActionKeyword = actionKeywords.some(k => lowerText.includes(k));
  const hasContextKeyword = contextKeywords.some(k => lowerText.includes(k));

  // Must have jira-related keyword AND (action keyword OR context keyword)
  return hasJiraKeyword && (hasActionKeyword || hasContextKeyword);
}

// Detect GitHub request in natural language
function isGitHubRequest(text) {
  const lowerText = text.toLowerCase();
  const githubKeywords = [
    'github', 'git', 'repo', 'repository', 'commit', 'commits',
    'pr', 'pull request', 'pull requests', 'merge', 'branch'
  ];
  const actionKeywords = [
    'check', 'show', 'what', 'status', 'update', 'latest',
    'recent', 'open', 'pending', 'review'
  ];

  const hasGitHubKeyword = githubKeywords.some(k => lowerText.includes(k));
  const hasActionKeyword = actionKeywords.some(k => lowerText.includes(k));

  return hasGitHubKeyword && hasActionKeyword;
}

// Handle natural language GitHub request
async function handleGitHubRequest(channelId, message) {
  log('info', 'Processing natural language GitHub request', { channelId });

  // Try to extract repo name from message or use default
  const repoMatch = message.match(/(?:repo|repository)[\s:]*([^\s,]+)/i);
  const repo = repoMatch ? repoMatch[1] : null;

  try {
    if (!config.github?.enabled || !config.github?.token || config.github?.token === 'YOUR_GITHUB_TOKEN') {
      return `📦 **GitHub Status**\n\nGitHub integration isn't configured yet. Ask your admin to add a GitHub token to config.json!`;
    }

    if (!repo && (!config.github.repos || config.github.repos.length === 0)) {
      return `📦 **GitHub Status**\n\nTo check a specific repo, mention it like: "what's the status of repo-name on GitHub"\n\nNo repos are configured for monitoring.`;
    }

    // If we have configured repos, show status for all of them
    if (!repo && config.github.repos?.length > 0) {
      let summaryParts = [];
      for (const repoName of config.github.repos.slice(0, 3)) {
        try {
          const [owner, name] = repoName.includes('/') ? repoName.split('/') : [null, repoName];
          if (owner && name) {
            const commits = await fetchRecentCommits(owner, name, 3);
            const prs = await fetchOpenPRs(owner, name);
            summaryParts.push(`**${repoName}**: ${commits?.length || 0} recent commits, ${prs?.length || 0} open PRs`);
          }
        } catch (e) {
          summaryParts.push(`**${repoName}**: Unable to fetch`);
        }
      }
      return `📦 **GitHub Overview**\n\n${summaryParts.join('\n')}`;
    }

    // Specific repo requested
    const [owner, name] = repo.includes('/') ? repo.split('/') : [null, repo];
    if (!owner || !name) {
      return `📦 Please specify the repo as "owner/repo-name"`;
    }

    const commits = await fetchRecentCommits(owner, name, 5);
    const prs = await fetchOpenPRs(owner, name);
    const issues = await fetchOpenIssues(owner, name);

    const commitList = commits?.slice(0, 5).map(c => `• \`${c.sha}\` ${c.message} (${c.author})`).join('\n') || '_None_';
    const prList = prs?.slice(0, 5).map(p => `• #${p.number}: ${p.title}`).join('\n') || '_None_';
    const issueList = issues?.slice(0, 5).map(i => `• #${i.number}: ${i.title}`).join('\n') || '_None_';

    return `📦 **GitHub: ${repo}**\n\n**Recent Commits:**\n${commitList}\n\n**Open PRs:**\n${prList}\n\n**Open Issues:**\n${issueList}`;
  } catch (error) {
    log('error', 'Failed to process GitHub request', { error: error.message });
    return `Sorry, I couldn't fetch GitHub info. Make sure the repo exists and the token has access.`;
  }
}

// Extract action items and create Jira issues automatically
async function extractAndCreateJiraIssues(discussionText, summaryText) {
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

    // Fetch existing backlog for duplicate checking
    const existingIssues = await getJiraBacklog();
    log('info', 'Checking against existing backlog', { existingCount: existingIssues.length });

    const results = [];
    const skipped = [];

    for (const item of items) {
      try {
        // Check for duplicates before creating
        const dupCheck = await checkForDuplicates(item.summary, existingIssues);

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

        const result = await createJiraIssue(item.summary, description, item.type);
        if (result && result.success) {
          results.push({ ...result, summary: item.summary });
          log('info', 'Created Jira issue from discussion', { key: result.key, type: item.type });
        }
      } catch (err) {
        log('error', 'Failed to create Jira issue', { item: item.summary, error: err.message });
      }
    }

    // Return both created and skipped for reporting
    return { created: results, skipped };
  } catch (error) {
    log('error', 'Failed to extract Jira items', { error: error.message });
    return [];
  }
}

// Detect Jira management intent from message
function detectJiraIntent(message) {
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

// Handle natural language Jira request
async function handleJiraRequest(channelId, message) {
  if (!config.jira?.enabled) {
    return "📋 Jira integration isn't configured yet. Ask your admin to set it up!";
  }

  log('info', 'Processing natural language Jira request', { channelId });

  const intent = detectJiraIntent(message);
  log('info', 'Detected Jira intent', intent);

  // Handle different intents
  switch (intent.action) {
    case 'list': {
      const issues = await getJiraBacklog();
      if (!issues || issues.length === 0) {
        return "📋 **Backlog is empty!** No open issues found.";
      }
      const issueList = issues.slice(0, 15).map(i => {
        const status = i.fields.status?.name || 'Unknown';
        const type = i.fields.issuetype?.name || 'Task';
        return `• **${i.key}** [${type}] ${i.fields.summary} _(${status})_`;
      }).join('\n');
      return `📋 **Current Backlog** (${issues.length} issues):\n\n${issueList}${issues.length > 15 ? '\n\n_...and ' + (issues.length - 15) + ' more_' : ''}`;
    }

    case 'delete': {
      if (!intent.issueKey) {
        return "🗑️ Which issue should I delete? Please mention the issue key (e.g., SCRUM-123).";
      }
      const result = await deleteJiraIssue(intent.issueKey);
      if (result.success) {
        return `🗑️ **Deleted ${intent.issueKey}** - Issue has been removed from the backlog.`;
      }
      return `❌ Couldn't delete ${intent.issueKey}: ${result.error}`;
    }

    case 'update': {
      if (!intent.issueKey) {
        return "✏️ Which issue should I update? Please mention the issue key (e.g., SCRUM-123) and what to change.";
      }
      // Use AI to extract what to update
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
            return `✏️ I couldn't determine what to update. Try: "update ${intent.issueKey} title to 'New Title'" or "change ${intent.issueKey} priority to High"`;
          }

          const result = await updateJiraIssue(intent.issueKey, filtered);
          if (result.success) {
            return `✅ **Updated ${intent.issueKey}**\n\nChanges applied: ${Object.keys(filtered).join(', ')}\n[View Issue](${result.url})`;
          }
          return `❌ Couldn't update ${intent.issueKey}: ${result.error}`;
        }
      } catch (e) {
        log('error', 'Update extraction failed', { error: e.message });
      }
      return `✏️ I couldn't understand what to update. Try being more specific about what to change.`;
    }

    case 'transition': {
      if (!intent.issueKey) {
        return `📊 Which issue should I mark as ${intent.status}? Please mention the issue key (e.g., SCRUM-123).`;
      }
      const result = await transitionJiraIssue(intent.issueKey, intent.status);
      if (result.success) {
        return `✅ **${intent.issueKey}** is now **${result.newStatus}**`;
      }
      return `❌ Couldn't change status: ${result.error}`;
    }

    case 'create':
    default: {
      // Fetch full channel history from Mattermost API
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

        const jiraResults = await extractAndCreateJiraIssues(messageText, summary);

        // Handle new return format with created and skipped
        if (jiraResults && jiraResults.created) {
          let response = '';

          if (jiraResults.created.length > 0) {
            const jiraSection = jiraResults.created.map(r =>
              `• **${r.key}**: ${r.summary} ([View](${r.url}))`
            ).join('\n');
            response += `📋 **Created ${jiraResults.created.length} issue${jiraResults.created.length > 1 ? 's' : ''}:**\n\n${jiraSection}`;
          }

          if (jiraResults.skipped && jiraResults.skipped.length > 0) {
            const skippedSection = jiraResults.skipped.map(s =>
              `• "${s.summary}" → duplicate of ${s.duplicateOf.join(', ')}`
            ).join('\n');
            response += `\n\n⚠️ **Skipped ${jiraResults.skipped.length} duplicate${jiraResults.skipped.length > 1 ? 's' : ''}:**\n${skippedSection}`;
          }

          if (response) {
            return response + `\n\n**Summary:**\n${summary}`;
          }
        }

        // Legacy format or no results
        if (jiraResults && Array.isArray(jiraResults) && jiraResults.length > 0) {
          const jiraSection = jiraResults.map(r =>
            `• **${r.key}**: ${r.summary} ([View](${r.url}))`
          ).join('\n');
          return `📋 **Created ${jiraResults.length} issue${jiraResults.length > 1 ? 's' : ''}:**\n\n${jiraSection}\n\n**Summary:**\n${summary}`;
        }

        return `📝 **Summary:**\n${summary}\n\n_I didn't find specific actionable items to create as Jira issues. If you have specific tasks in mind, just tell me what to create!_`;
      } catch (error) {
        log('error', 'Failed to process Jira request', { error: error.message });
        return "Sorry, I had trouble analyzing the conversation. Try again in a moment.";
      }
    }
  }
}

// Classify message context
function classifyMessage(text, recentMessages = []) {
  const cleanText = text.replace(/@\w+/g, '').trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  if (isGreeting(text)) return { type: 'greeting', confidence: 'high' };
  if (isFarewell(text)) return { type: 'farewell', confidence: 'high' };
  if (isAcknowledgment(text)) return { type: 'acknowledgment', confidence: 'high' };
  if (text.startsWith('!')) return { type: 'command', confidence: 'high' };

  if (wordCount <= 3) {
    return { type: 'brief', confidence: 'medium', needsClarification: true };
  }

  if (isQuestion(text) && wordCount >= 5) {
    return { type: 'question', confidence: 'high' };
  }

  if (hasTriggerKeyword(text) && wordCount >= 5) {
    return { type: 'topic', confidence: 'high' };
  }

  if (wordCount >= 4 && wordCount <= 10) {
    return { type: 'statement', confidence: 'medium', needsClarification: true };
  }

  if (wordCount > 10) {
    return { type: 'discussion', confidence: 'high' };
  }

  return { type: 'unclear', confidence: 'low', needsClarification: true };
}

// LLM-based intent classification - replaces all declarative keyword matching
async function classifyIntent(message, recentMessages = [], channelName = '') {
  // Commands are always handled directly
  if (message.trim().startsWith('!')) {
    return {
      respond: true,
      intent: 'command',
      reason: 'explicit command'
    };
  }

  // Build recent context
  const recentContext = recentMessages.slice(-5).map(m =>
    `[${m.username || 'user'}]: ${m.content}`
  ).join('\n');

  const prompt = `You are classifying user intent for Spark, a PM & Facilitation Assistant bot with social intelligence.

MESSAGE: "${message.substring(0, 1500)}"

RECENT CHANNEL CONTEXT:
${recentContext || '(no recent messages)'}

CHANNEL: ${channelName || 'unknown'}

Respond with JSON only:
{
  "respond": true/false,          // Should Spark respond?
  "intent": "string",             // See INTENTS below
  "reason": "brief explanation",
  "reaction": "emoji or null",    // If not responding, suggest reaction (👍, 🙌, ⚡, 🎉, etc.)
  "load_history": true/false,     // Load channel history for context?
  "time_range_hours": number/null, // Hours of history to load (null = default 8)
  "persona": "string"             // One of: default, standup, brainstorm, retro
}

INTENTS:
- "summary_request": User ASKS FOR a summary/recap ("summarize", "catch me up", "what'd I miss")
- "feedback_request": User shares content wanting analysis ("what do you think?", "review this", "thoughts on")
- "sharing_info": Sharing info, not asking for feedback (react only)
- "question": Direct question to Spark
- "help_request": Someone is stuck, blocked, or needs help (signals: "help", "stuck", "blocker", "anyone know", "struggling")
- "standup_request": User wants help with standup/daily sync
- "brainstorm_request": Wants help ideating (SCAMPER, Six Hats, HMW, "ideas", "brainstorm", "thoughts on approach")
- "retro_request": User wants to run a retrospective ("retro", "retrospective", "what went well")
- "facilitation_request": Wants Spark to facilitate a discussion or meeting
- "jira_request": Asking about Jira/tickets/sprints/issues
- "github_request": ONLY when explicitly mentioning "GitHub", "repo", "repository", "PR", "pull request", "commit", or "branch"
- "research_request": User wants research on a topic, URL, website, or external resource (NOT GitHub-specific)
- "greeting": Simple hello/hi (respond warmly but briefly)
- "thanks": Thanking Spark (react ⚡ or 🙌, don't respond)
- "celebration": Sharing a win/success (react 🎉, maybe brief congrats)
- "standup_update": Sharing standup-style update (what I did, doing, blockers)
- "casual_chat": Casual conversation
- "unclear": Can't determine (ask clarifying question)

SOCIAL INTELLIGENCE - Read the room:
1. CONTEXT MATTERS: Analyze the FULL message AND recent channel context to understand actual intent
2. HELP SIGNALS: Watch for "help", "stuck", "blocker", "question", "anyone", "ideas", "thoughts", "feedback", "struggling"
3. QUESTION PATTERNS: Messages ending in "?" or starting with who/what/when/where/why/how/can/could/would/should
4. EMOTIONAL CUES: Frustration ("ugh", "struggling", "stuck"), excitement ("finally!", "we did it!", "shipped!"), uncertainty ("not sure", "maybe", "wondering if")
5. IMPLICIT ASKS: "I can't figure out X" = help_request even without explicit ask. "Here's what happened..." + no question = sharing_info
6. MEETING NOTES/SUMMARIES: If user shares detailed notes and asks "what do you think?" or "@spark thoughts?" = feedback_request (respond substantively!)
7. DON'T OVER-RESPOND: Good news without a question = react with 🎉 instead of long response
8. TEAM DYNAMICS: Recognize when someone needs facilitation vs just venting vs asking for help
9. FACILITATION CUES: "can you help us decide", "we're stuck as a team", "need to align on" = facilitation_request

WHEN TO RESPOND vs REACT:
- respond=true: Questions, help requests, feedback requests, standup/retro/brainstorm requests, facilitation
- respond=false + reaction: Thanks (⚡), celebrations (🎉), sharing without asking (👀 or 💡)
- load_history=true: For summary_request, OR when historical context helps answer the question
- Match persona to request type (standup_request → standup, brainstorm_request → brainstorm, retro_request → retro)`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      log('info', 'Intent classified', {
        message: message.substring(0, 50),
        intent: result.intent,
        respond: result.respond,
        load_history: result.load_history
      });
      return result;
    }
    return { respond: true, intent: 'unclear', reason: 'parse_fallback', persona: 'default' };
  } catch (error) {
    log('error', 'Intent classification failed', { error: error.message });
    return { respond: true, intent: 'unclear', reason: 'error_fallback', persona: 'default' };
  }
}

// Generate appropriate greeting response - value-focused, 20 words or less, varied structure
function getSparkGreetingResponse() {
  const responses = [
    // Question-led
    "👋 What's the team stuck on? Let's unstick it.",
    "Hey! Need alignment, ideas, or decisions? Pick one - I'll make it happen.",
    // Action/Result-led
    "Hi! Meetings into momentum. What should we tackle?",
    "👋 Faster alignment, better ideas. What's on the agenda?",
    // Invitation-led
    "Hey! Throw me a challenge - standup, brainstorm, or decision?",
    // Direct value
    "Hi! ⚡ Team productivity, turbocharged. What do you need?"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate farewell response
function getSparkFarewellResponse() {
  const responses = [
    "Catch you later! 👋",
    "See ya! Great session.",
    "Later! Ping me anytime.",
    "Take care! 🙌",
    "👋 Until next time!"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate acknowledgment response (or none)
function getSparkAcknowledgmentResponse() {
  if (Math.random() < 0.7) return null;
  const responses = ["👍", "🙌", "⚡"];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate clarifying question
function getSparkClarifyingQuestion(messageType, originalText) {
  const questions = [
    "What can I help with? Standup, brainstorm, or something else?",
    "Need me to facilitate something, or just chatting?",
    "Should I run a brainstorm, retro, or poll on that?",
    "Want me to help the team with something specific?",
    "How can I help? I do standups, retros, brainstorms, and polls!"
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

// Handle incoming message
async function handleMessage(post) {
  if (post.user_id === state.botUserId) return;

  // Ignore messages from any bot (Mattermost sets props.from_bot on bot messages)
  if (post.props?.from_bot === 'true' || post.props?.from_bot === true) {
    log('debug', 'Ignoring message from bot (from_bot flag)', { userId: post.user_id });
    return;
  }

  // Also check explicit ignore list as fallback
  const ignoredBots = config.spark.ignoreBotUserIds || [];
  if (ignoredBots.includes(post.user_id)) {
    log('debug', 'Ignoring message from other bot', { userId: post.user_id });
    return;
  }

  const channelId = post.channel_id;
  const message = post.message;

  // Skip if ONLY Scout is mentioned (avoid duplicate bot responses)
  // But respond if Spark is also mentioned
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

  // Keep only last 20 messages
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

  // Check for commands
  const cmd = parseCommand(message);
  if (cmd) {
    let response = null;
    const replyTo = post.root_id || post.id; // For thread-safe replies

    // Try modular router first (skills, workflows, documents)
    if (commandRouter.isRouterCommand(cmd.command)) {
      try {
        log('info', 'Using modular router for command', { command: cmd.command });
        await postMessage(channelId, `Processing \`!${cmd.command}\`...`, replyTo);

        // Gather context
        const routerHistory = await fetchChannelHistory(channelId, 50);
        const routerChannelContext = routerHistory
          .filter(m => m.content && m.content.trim())
          .map(m => `[${m.username}]: ${m.content}`)
          .join('\n');

        // Get semantic context
        let routerSemanticContext = '';
        try {
          const memCtx = await semanticMemory.getContext(cmd.args.join(' ') || cmd.command, {
            maxDocs: 20,
            maxConvs: 20,
            includeGraph: true
          });
          if (memCtx) routerSemanticContext = memCtx;
        } catch (err) {
          log('warn', 'Semantic memory for router failed', { error: err.message });
        }

        const routerResult = await commandRouter.routeCommand(cmd, {}, {
          botName: 'spark',
          channelContext: routerChannelContext,
          semanticContext: routerSemanticContext,
          depth: 'standard',
          logFn: (msg) => log('info', msg)
        });

        if (routerResult) {
          await postWithSplitting(channelId, routerResult.text, replyTo, cmd.command);
          return; // Command handled by router
        }
      } catch (routerErr) {
        log('error', 'Router failed, falling through to legacy', { error: routerErr.message });
        // Fall through to legacy switch statement
      }
    }

    // Legacy command handling (backward compatibility)
    switch (cmd.command) {
      case 'standup':
        if (cmd.args[0]?.toLowerCase() === 'end') {
          response = await endStandup(channelId);
        } else {
          await startStandup(channelId);
          return;
        }
        break;

      case 'scamper':
        await postMessage(channelId, "Applying SCAMPER technique...", replyTo);
        const scamperResult = await brainstormSCAMPER(cmd.args[0]);
        await postWithSplitting(channelId, scamperResult, replyTo, 'scamper');
        // response stays null - already posted via postWithSplitting
        break;

      case 'sixhats':
        await postMessage(channelId, "Putting on the Six Thinking Hats...", replyTo);
        const sixhatsResult = await brainstormSixHats(cmd.args[0]);
        await postWithSplitting(channelId, sixhatsResult, replyTo, 'sixhats');
        // response stays null - already posted via postWithSplitting
        break;

      case 'hmw':
        await postMessage(channelId, "Generating How Might We questions...", replyTo);
        const hmwResult = await brainstormHMW(cmd.args[0]);
        await postWithSplitting(channelId, hmwResult, replyTo, 'hmw');
        // response stays null - already posted via postWithSplitting
        break;

      case 'retro':
        await startRetro(channelId, cmd.args[0] || 'standard');
        return;

      case 'icebreaker':
        const icebreaker = await generateIcebreaker();
        response = `**Icebreaker Time!** \n\n${icebreaker}`;
        break;

      case 'celebrate':
        response = await celebrateWin(channelId, cmd.args[0]);
        break;

      case 'tutorial':
        await postMessage(channelId, "Creating tutorial...", replyTo);
        response = await generateTutorial(cmd.args[0]);
        break;

      case 'help':
        response = `**Spark Commands**

**Standups & Retros:**
- \`!standup start\` - Start daily standup
- \`!standup end\` - End and summarize standup
- \`!retro [format]\` - Start retrospective (standard/starfish/sailboat)

**Brainstorming:**
- \`!scamper [topic]\` - SCAMPER technique
- \`!sixhats [topic]\` - Six Thinking Hats
- \`!hmw [topic]\` - How Might We questions

**Team & Learning:**
- \`!icebreaker\` - Get a fun icebreaker
- \`!celebrate [win]\` - Celebrate an achievement
- \`!tutorial [topic]\` - Generate a tutorial

Or just mention @spark with any question!

**Configuration:**
- \`!config\` - View current settings
- \`!askme\` - I'll ask what you'd like to improve`;
        break;

      case 'config':
        response = showConfig(channelId);
        break;

      case 'askme':
        response = await askForPreferences(channelId);
        break;

      case 'setengagement':
        const engagement = cmd.args[0].toLowerCase();
        const prefsEng = getChannelPrefs(channelId);
        prefsEng.engagementLevel = engagement;
        savePreferences();
        response = `✅ Engagement level set to **${engagement}**. ${engagement === 'low' ? "I'll be more hands-off." : engagement === 'high' ? "I'll be more actively involved!" : "I'll balance my involvement."}`;
        break;

      case 'setretro':
        const retroFmt = cmd.args[0].toLowerCase();
        const prefsRetro = getChannelPrefs(channelId);
        prefsRetro.retroFormat = retroFmt;
        savePreferences();
        response = `✅ Default retro format set to **${retroFmt}**. I'll use this when you run \`!retro\` without specifying a format.`;
        break;

      case 'setbrainstorm':
        const bsStyle = cmd.args[0].toLowerCase();
        const prefsBS = getChannelPrefs(channelId);
        prefsBS.brainstormStyle = bsStyle;
        savePreferences();
        response = `✅ Brainstorm style preference set to **${bsStyle}**. ${bsStyle === 'mixed' ? "I'll suggest different techniques based on context." : `I'll lean toward ${bsStyle.toUpperCase()} when brainstorming.`}`;
        break;

      case 'feedback':
        const feedbackMsg = cmd.args[0];
        const prefsFB = getChannelPrefs(channelId);
        prefsFB.feedback.push({
          message: feedbackMsg,
          timestamp: Date.now()
        });
        savePreferences();
        response = `Thank you for the feedback! I've noted: **"${feedbackMsg}"**\n\nI'll work on improving. Your input helps me facilitate better!`;
        break;

      // Polls moved to Socialite bot - use !pollhelp for poll commands

      case 'remindme':
        const timeArg = cmd.args[0];
        const reminderMsg = cmd.args[1];
        response = await setReminder(channelId, post.user_id, timeArg, reminderMsg);
        break;

      case 'teamremind':
        const teamTimeArg = cmd.args[0];
        const teamMsg = cmd.args[1];
        response = await setTeamReminder(channelId, teamTimeArg, teamMsg);
        break;

      case 'followup':
        const followupTopic = cmd.args[0];
        await postMessage(channelId, "📋 Creating follow-up plan...", replyTo);
        response = await planFollowUp(channelId, followupTopic);
        break;

      case 'cheer':
        const cheerTarget = cmd.args[0];
        await addReaction(post.id, 'tada');
        response = `🎉 **Shoutout to ${cheerTarget}!**\n\n${getSparkCheerMessage()}`;
        break;

      case 'pin':
        if (post.root_id) {
          const pinned = await pinMessage(post.root_id);
          response = pinned ? "📌 Message pinned!" : "Couldn't pin that message.";
        } else {
          response = "Reply to a message with `!pin` to pin it.";
        }
        break;

      // ===== JIRA COMMANDS =====

      case 'story':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const storyRequest = cmd.args[0];
          await postMessage(channelId, "📝 Creating Jira Story...", replyTo);

          const storyData = await generateJiraIssue(storyRequest, 'Story');
          if (storyData) {
            const result = await createJiraStory(
              storyData.summary,
              storyData.description,
              storyData.acceptanceCriteria || ''
            );
            if (result.success) {
              response = `✅ **Story Created!**\n\n📋 **${result.key}**: ${storyData.summary}\n🔗 [View in Jira](${result.url})\n\n**Acceptance Criteria:**\n${storyData.acceptanceCriteria || '_None specified_'}`;
            } else {
              response = `❌ Failed to create story: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try: `!story As a user, I want to...`";
          }
        }
        break;

      case 'bug':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const bugRequest = cmd.args[0];
          await postMessage(channelId, "🐛 Creating Jira Bug...", replyTo);

          const bugData = await generateJiraIssue(bugRequest, 'Bug');
          if (bugData) {
            const result = await createJiraBug(
              bugData.summary,
              bugData.description,
              bugData.stepsToReproduce || ''
            );
            if (result.success) {
              response = `✅ **Bug Created!**\n\n🐛 **${result.key}**: ${bugData.summary}\n🔗 [View in Jira](${result.url})\n\n**Steps to Reproduce:**\n${bugData.stepsToReproduce || '_Please add steps to reproduce_'}`;
            } else {
              response = `❌ Failed to create bug: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try: `!bug Login button doesn't work on mobile`";
          }
        }
        break;

      case 'task':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const taskRequest = cmd.args[0];
          await postMessage(channelId, "📌 Creating Jira Task...", replyTo);

          const taskData = await generateJiraIssue(taskRequest, 'Task');
          if (taskData) {
            const result = await createJiraTask(taskData.summary, taskData.description);
            if (result.success) {
              response = `✅ **Task Created!**\n\n📌 **${result.key}**: ${taskData.summary}\n🔗 [View in Jira](${result.url})`;
            } else {
              response = `❌ Failed to create task: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try: `!task Update dependencies to latest versions`";
          }
        }
        break;

      case 'jira':
      case 'backlog':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const backlogRequest = cmd.args[0];
          await postMessage(channelId, "📋 Creating backlog item...", replyTo);

          // Try to auto-detect issue type from content
          const lowerReq = backlogRequest.toLowerCase();
          let issueType = 'Task';
          if (lowerReq.includes('as a ') || lowerReq.includes('user story') || lowerReq.includes('feature')) {
            issueType = 'Story';
          } else if (lowerReq.includes('bug') || lowerReq.includes('broken') || lowerReq.includes('fix') || lowerReq.includes('error') || lowerReq.includes('issue')) {
            issueType = 'Bug';
          }

          const backlogData = await generateJiraIssue(backlogRequest, issueType);
          if (backlogData) {
            let result;
            if (issueType === 'Story') {
              result = await createJiraStory(backlogData.summary, backlogData.description, backlogData.acceptanceCriteria || '');
            } else if (issueType === 'Bug') {
              result = await createJiraBug(backlogData.summary, backlogData.description, backlogData.stepsToReproduce || '');
            } else {
              result = await createJiraTask(backlogData.summary, backlogData.description);
            }

            if (result.success) {
              const typeEmoji = { Story: '📋', Bug: '🐛', Task: '📌' };
              response = `✅ **${issueType} Created!**\n\n${typeEmoji[issueType]} **${result.key}**: ${backlogData.summary}\n🔗 [View in Jira](${result.url})`;
            } else {
              response = `❌ Failed to create ${issueType.toLowerCase()}: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try describing what you need in plain language.";
          }
        }
        break;

      // ===== GITHUB ONBOARDING COMMANDS =====

      case 'onboard':
        if (!config.github?.enabled) {
          response = "❌ GitHub integration is not configured. Add a GitHub token to config.json.";
        } else {
          const repoToOnboard = cmd.args[0].trim();
          await postMessage(channelId, `🔄 Onboarding **${repoToOnboard}**... This may take a moment.`, replyTo);

          const result = await onboardRepository(repoToOnboard);
          if (result.success) {
            response = `✅ **Repository Onboarded!**\n\n${result.summary}`;
          } else {
            response = `❌ Failed to onboard: ${result.error}`;
          }
        }
        break;

      case 'repos':
        if (!config.github?.enabled) {
          response = "❌ GitHub integration is not configured.";
        } else {
          const trackedRepos = Object.keys(githubContext.repos);
          if (trackedRepos.length === 0) {
            response = `📂 **No repositories onboarded yet.**\n\nUse \`!onboard owner/repo\` to add a repository.`;
          } else {
            response = `📂 **Tracked Repositories (${trackedRepos.length})**\n\n`;
            for (const repoName of trackedRepos) {
              const ctx = githubContext.repos[repoName];
              response += `• **${repoName}** - ${ctx.techStack?.language || 'Unknown'} | ${ctx.prs?.length || 0} PRs, ${ctx.issues?.length || 0} issues\n`;
            }
            response += `\n_Last refresh: ${githubContext.lastRefresh ? new Date(githubContext.lastRefresh).toLocaleString() : 'Never'}_`;
          }
        }
        break;

      case 'refresh':
        if (!config.github?.enabled) {
          response = "❌ GitHub integration is not configured.";
        } else if (Object.keys(githubContext.repos).length === 0) {
          response = "No repositories to refresh. Use `!onboard owner/repo` first.";
        } else {
          await postMessage(channelId, "🔄 Refreshing all repositories...", replyTo);
          const results = await refreshAllRepos();
          const successful = results.filter(r => r.success).length;
          response = `✅ **Refresh Complete**\n\n${successful}/${results.length} repositories updated.\n_Last refresh: ${new Date().toLocaleString()}_`;
        }
        break;

      case 'codebase':
        if (!config.github?.enabled) {
          response = "❌ GitHub integration is not configured.";
        } else if (Object.keys(githubContext.repos).length === 0) {
          response = `📂 **No codebase context available.**\n\nOnboard repositories with \`!onboard owner/repo\` so I can help with code-aware facilitation.`;
        } else {
          // Generate comprehensive codebase overview
          const repos = Object.keys(githubContext.repos);
          response = `## 🗂️ Codebase Overview\n\n`;
          response += `**${repos.length} repositories** tracked\n`;
          response += `_Last updated: ${githubContext.lastRefresh ? new Date(githubContext.lastRefresh).toLocaleString() : 'Unknown'}_\n\n`;

          for (const repoName of repos) {
            const ctx = githubContext.repos[repoName];
            if (!ctx) continue;

            response += `### ${repoName}\n`;
            response += `${ctx.info?.description || 'No description'}\n\n`;
            response += `**Stack:** ${ctx.techStack?.language || 'Unknown'}`;
            if (ctx.techStack?.frameworks?.length) response += ` | ${ctx.techStack.frameworks.join(', ')}`;
            response += '\n';

            if (ctx.structure?.directories?.length) {
              response += `**Dirs:** \`${ctx.structure.directories.slice(0, 6).join('`, `')}\`${ctx.structure.directories.length > 6 ? '...' : ''}\n`;
            }

            response += `**Activity:** ${ctx.prs?.length || 0} open PRs, ${ctx.issues?.length || 0} open issues\n`;

            if (ctx.prs?.length > 0) {
              response += `**Top PRs:**\n`;
              ctx.prs.slice(0, 3).forEach(pr => {
                response += `  • #${pr.number}: ${pr.title}\n`;
              });
            }
            response += '\n';
          }

          response += `\n_Use \`!pr [number]\` or \`!issues\` for more details._`;
        }
        break;

      case 'pr':
        if (!config.github?.enabled || Object.keys(githubContext.repos).length === 0) {
          response = "No codebase context. Use `!onboard owner/repo` first.";
        } else {
          const prNumber = cmd.args[0] ? parseInt(cmd.args[0]) : null;

          if (prNumber) {
            // Find specific PR across all repos
            let foundPr = null;
            let foundRepo = null;
            for (const [repoName, ctx] of Object.entries(githubContext.repos)) {
              const pr = ctx.prs?.find(p => p.number === prNumber);
              if (pr) {
                foundPr = pr;
                foundRepo = repoName;
                break;
              }
            }
            if (foundPr) {
              response = `## PR #${foundPr.number}: ${foundPr.title}\n\n`;
              response += `**Repo:** ${foundRepo}\n`;
              response += `**Author:** ${foundPr.author}\n`;
              response += `**Branch:** \`${foundPr.headBranch}\` → \`${foundPr.baseBranch}\`\n`;
              response += `**Status:** ${foundPr.draft ? '📝 Draft' : '🟢 Ready'}\n`;
              if (foundPr.labels?.length) response += `**Labels:** ${foundPr.labels.join(', ')}\n`;
              response += `**Created:** ${new Date(foundPr.createdAt).toLocaleDateString()}\n`;
              response += `\n🔗 [View on GitHub](${foundPr.url})`;
            } else {
              response = `PR #${prNumber} not found in tracked repositories.`;
            }
          } else {
            // List all open PRs
            response = `## 📋 Open Pull Requests\n\n`;
            let totalPrs = 0;
            for (const [repoName, ctx] of Object.entries(githubContext.repos)) {
              if (ctx.prs?.length > 0) {
                response += `**${repoName}:**\n`;
                ctx.prs.slice(0, 5).forEach(pr => {
                  response += `  • #${pr.number}: ${pr.title} (${pr.author})${pr.draft ? ' 📝' : ''}\n`;
                  totalPrs++;
                });
              }
            }
            if (totalPrs === 0) {
              response = "No open PRs across tracked repositories.";
            }
          }
        }
        break;

      case 'issues':
        if (!config.github?.enabled || Object.keys(githubContext.repos).length === 0) {
          response = "No codebase context. Use `!onboard owner/repo` first.";
        } else {
          const filter = cmd.args[0]?.toLowerCase() || '';
          response = `## 🐛 Open Issues\n\n`;
          let totalIssues = 0;

          for (const [repoName, ctx] of Object.entries(githubContext.repos)) {
            let issues = ctx.issues || [];

            // Filter by label if specified
            if (filter) {
              issues = issues.filter(i =>
                i.labels.some(l => l.toLowerCase().includes(filter)) ||
                i.title.toLowerCase().includes(filter)
              );
            }

            if (issues.length > 0) {
              response += `**${repoName}:**\n`;
              issues.slice(0, 5).forEach(i => {
                const labels = i.labels.length ? ` [${i.labels.slice(0, 2).join(', ')}]` : '';
                response += `  • #${i.number}: ${i.title}${labels}\n`;
                totalIssues++;
              });
            }
          }

          if (totalIssues === 0) {
            response = filter
              ? `No issues matching "${filter}" in tracked repositories.`
              : "No open issues across tracked repositories.";
          } else {
            response += `\n_Filter: \`!issues bug\` or \`!issues feature\`_`;
          }
        }
        break;

      // ===== SEMANTIC MEMORY COMMANDS =====
      case 'memory':
        const memSubCmd = (cmd.args[0] || 'stats').toLowerCase();
        const memArg = cmd.args[1] || '';

        if (memSubCmd === 'stats') {
          try {
            const stats = await semanticMemory.getStats();
            let msg = `🧠 **Semantic Memory Stats**\n\n`;
            msg += `**Documents:**\n`;
            msg += `• Files: ${stats.documents.files}\n`;
            msg += `• Chunks: ${stats.documents.chunks}\n\n`;
            msg += `**Conversations:**\n`;
            msg += `• Messages: ${stats.conversations.messages}\n`;
            msg += `• Channels: ${stats.conversations.channels}\n`;
            msg += `• Users: ${stats.conversations.users}\n\n`;
            msg += `**Knowledge Graph:**\n`;
            msg += `• Nodes: ${stats.graph.nodes}\n`;
            msg += `• Edges: ${stats.graph.edges}\n`;
            if (stats.graph.byType) {
              msg += `• Types: ${Object.entries(stats.graph.byType).map(([k,v]) => `${k}(${v})`).join(', ')}\n`;
            }
            response = msg;
          } catch (err) {
            response = `🧠 **Semantic Memory**\n\n_Error getting stats: ${err.message}_`;
          }
        } else if (memSubCmd === 'search' && memArg) {
          try {
            const results = await semanticMemory.search(memArg, { limit: 5 });
            let msg = `🔍 **Memory Search:** "${memArg}"\n\n`;

            if (results.conversations.length > 0) {
              msg += `**Conversations:**\n`;
              for (const r of results.conversations.slice(0, 3)) {
                const date = new Date(r.timestamp).toLocaleDateString();
                const score = (r.score * 100).toFixed(0);
                msg += `• [${score}%] **${r.userName}** in #${r.channelName} (${date})\n`;
                msg += `  > ${r.text.substring(0, 150)}${r.text.length > 150 ? '...' : ''}\n`;
              }
            }

            if (results.documents.length > 0) {
              msg += `\n**Documents:**\n`;
              for (const r of results.documents.slice(0, 3)) {
                const score = (r.score * 100).toFixed(0);
                msg += `• [${score}%] **${r.fileName}**\n`;
                msg += `  > ${r.text.substring(0, 150)}${r.text.length > 150 ? '...' : ''}\n`;
              }
            }

            if (results.conversations.length === 0 && results.documents.length === 0) {
              msg += `_No matching content found._`;
            }
            response = msg;
          } catch (err) {
            response = `🔍 **Memory Search**\n\n_Error: ${err.message}_`;
          }
        } else if (memSubCmd === 'graph' && memArg) {
          try {
            const personContext = await semanticMemory.getPersonContext(memArg);
            let msg = `🕸️ **Knowledge Graph:** ${memArg}\n\n`;
            if (personContext.topics.length > 0) {
              msg += `**Topics mentioned:** ${personContext.topics.slice(0, 10).join(', ')}\n`;
            }
            if (personContext.decisions.length > 0) {
              msg += `**Decisions:** ${personContext.decisions.length}\n`;
            }
            if (personContext.mentions.length > 0) {
              msg += `**Mentions:** ${personContext.mentions.length}\n`;
            }
            if (personContext.topics.length === 0 && personContext.decisions.length === 0) {
              msg += `_No graph data found for "${memArg}"._`;
            }
            response = msg;
          } catch (err) {
            response = `🕸️ **Knowledge Graph**\n\n_Error: ${err.message}_`;
          }
        } else {
          response = `🧠 **Semantic Memory Commands**\n\n• \`!memory\` or \`!memory stats\` - Show memory statistics\n• \`!memory search [query]\` - Search conversations & documents\n• \`!memory graph [userId]\` - Show knowledge graph for a user`;
        }
        break;

      case 'help':
        response = `## ⚡ Spark Commands

**Standups & Retros:**
• \`!standup start\` / \`!standup end\` - Facilitate standup
• \`!retro [format]\` - Run retrospective (standard/starfish/sailboat)

**Brainstorming:**
• \`!scamper [topic]\` - SCAMPER innovation technique
• \`!sixhats [topic]\` - Six Thinking Hats analysis
• \`!hmw [topic]\` - How Might We questions

**Polls & Consensus:**
• \`!poll "Question?" "Opt1" "Opt2"\` - Multi-option poll
• \`!quickpoll yesno|agree|priority|team [question]\` - Quick poll
• \`!vote [question]\` - Simple yes/no vote
• \`!consensus "Decision" "Opt1" "Opt2"\` - Get team alignment (with follow-up)
• \`!polls\` - List recent polls in this channel
• \`!pollresults <poll-id>\` - View results of a specific poll

**Engagement:**
• \`!icebreaker\` - Fun team question
• \`!celebrate [win]\` - Celebrate achievement
• \`!cheer [person/team]\` - Shoutout someone
• \`!tutorial [topic]\` - Quick how-to guide

**Planning:**
• \`!followup [topic]\` - Create a follow-up plan
• \`!remindme [time] [msg]\` - Personal reminder
• \`!teamremind [time] [msg]\` - Team-wide reminder
• \`!pin\` - Pin a message (reply to it)

**Jira Backlog:**
• \`!story [description]\` - Create a User Story with acceptance criteria
• \`!bug [description]\` - Create a Bug with steps to reproduce
• \`!task [description]\` - Create a Task
• \`!backlog [description]\` - Auto-detect type and create issue

**GitHub & Codebase:**
• \`!onboard owner/repo\` - Onboard a repository
• \`!repos\` - List tracked repositories
• \`!codebase\` - Show full codebase overview
• \`!pr [number]\` - List PRs or view specific PR
• \`!issues [filter]\` - List issues (optional filter)
• \`!refresh\` - Refresh all repository data

**Settings:**
• \`!config\` - View settings
• \`!askme\` - Let me ask what to improve

_Or just @spark me with any question!_`;
        break;
    }

    if (response) {
      // Use root_id for thread replies, otherwise reply to the post
      const replyTo = post.root_id || post.id;
      await postMessage(channelId, maybeAddHint(channelId, response), replyTo);
    }
    return;
  }

  // Handle file uploads
  if (post.file_ids && post.file_ids.length > 0) {
    await handleFileUpload(post);
  }

  // ============ LLM-FIRST INTENT CLASSIFICATION ============
  // Check if Spark is mentioned - if so, use AI to understand intent
  const isMentioned = message.toLowerCase().includes('@spark');

  if (!isMentioned) {
    // Not mentioned - only do passive reactions (celebrate wins, etc.)
    if (detectWin(message) && Math.random() < 0.3) {
      await addReaction(post.id, 'tada');
    }
    return; // Don't respond if not mentioned
  }

  // Spark was mentioned - classify intent using LLM
  log('info', 'Spark mentioned, classifying intent...', { channelId });
  const channelData = state.channels.get(channelId);
  const intent = await classifyIntent(message, channelState.messages, channelData?.name || '');

  // Handle based on classified intent
  if (!intent.respond) {
    log('info', 'Intent classified as no-response', { intent: intent.intent, reason: intent.reason });
    if (intent.reaction) {
      const emojiMap = { '👍': 'thumbsup', '🙌': 'raised_hands', '✨': 'sparkles', '👋': 'wave', '⚡': 'zap', '🎉': 'tada' };
      const emojiName = emojiMap[intent.reaction] || 'zap';
      await addReaction(post.id, emojiName);
    }
    return;
  }

  log('info', 'Responding to message', { intent: intent.intent, persona: intent.persona });

  // Handle special intents with dedicated handlers
  if (intent.intent === 'jira_request') {
    const jiraResponse = await handleJiraRequest(channelId, message);
    await postMessage(channelId, jiraResponse, post.root_id || post.id);
    channelState.messages.push({ role: 'assistant', content: jiraResponse, timestamp: Date.now() });
    return;
  }

  if (intent.intent === 'github_request') {
    const githubResponse = await handleGitHubRequest(channelId, message);
    await postMessage(channelId, githubResponse, post.root_id || post.id);
    channelState.messages.push({ role: 'assistant', content: githubResponse, timestamp: Date.now() });
    return;
  }

  if (intent.intent === 'research_request') {
    // Extract URLs from message
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const urls = message.match(urlRegex) || [];

    // Create research task
    const task = taskQueue.TaskFactory.research(
      message, // topic
      channelId,
      post.user_id,
      '' // context
    );

    // Add URLs to task data
    if (urls.length > 0) {
      task.data = task.data || {};
      task.data.urls = urls;
    }

    const queueStats = taskQueue.getStats();
    await postMessage(
      channelId,
      `📋 **Research queued:** ${task.title}\n\n` +
      (urls.length > 0 ? `Found ${urls.length} URL(s) to analyze.\n` : '') +
      `Position in queue: ${queueStats.pending}\n\n` +
      `Use \`!tasks\` to check progress.`,
      post.root_id || post.id
    );

    channelState.messages.push({ role: 'assistant', content: `Queued research: ${task.title}`, timestamp: Date.now() });

    // Trigger immediate processing if queue was empty
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
    // Load from persistent history for summary requests
    let historyMessages;
    const hours = intent.time_range_hours || 8; // Default 8 hours
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
    // Normal conversation - use recent in-memory messages
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
  // ------------------------

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

// Command offerings - rotate through these to keep it fresh
const sparkOfferings = [
  {
    title: "Standups & Meetings",
    commands: [
      "`!standup start` - I'll facilitate your daily standup",
      "`!standup end` - Wrap up and get a summary"
    ],
    example: "Just type `!standup start` and I'll guide everyone through!"
  },
  {
    title: "Brainstorming Techniques",
    commands: [
      "`!scamper [topic]` - Substitute, Combine, Adapt, Modify...",
      "`!sixhats [topic]` - Look at it from 6 perspectives",
      "`!hmw [topic]` - Turn problems into opportunities"
    ],
    example: "Try: `!scamper improving our onboarding process`"
  },
  {
    title: "Retrospectives",
    commands: [
      "`!retro` - Classic: What went well? What to improve?",
      "`!retro starfish` - Keep/Less/More/Stop/Start",
      "`!retro sailboat` - Wind/Anchor/Rocks/Sun metaphor"
    ],
    example: "Try: `!retro starfish` for a fresh perspective!"
  },
  {
    title: "Team Engagement",
    commands: [
      "`!icebreaker` - Fun question to kick off a meeting",
      "`!celebrate [win]` - Shout out a team achievement",
      "`!tutorial [topic]` - Quick how-to guide"
    ],
    example: "Try: `!icebreaker` to warm up before a meeting!"
  },
  {
    title: "Customize Me",
    commands: [
      "`!config` - See your current settings",
      "`!askme` - I'll ask how to serve you better",
      "`!feedback [thoughts]` - Help me improve"
    ],
    example: "Try: `!askme` - I'd love your input!"
  }
];

function getRandomSparkOffering() {
  return sparkOfferings[Math.floor(Math.random() * sparkOfferings.length)];
}

// Scheduled check-ins
async function scheduledCheckIn() {
  if (!config.spark.enableProactiveCheckins) return;

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const minute = now.getMinutes();

  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  if (hour < 9 || hour > 17) return;

  // Monday (9:15 AM) - Question-led
  if (dayOfWeek === 1 && hour === 9 && minute >= 15 && minute < 30) {
    for (const [channelId] of state.channels) {
      const message = `🚀 **What would make this week a win?**

Name it. Standup, brainstorm, or quick poll - let's build momentum early.

_What's the one thing worth aligning on today?_`;
      await postMessage(channelId, message);
    }
  }

  // Tuesday (9 AM) - Action-led
  if (dayOfWeek === 2 && hour === 9 && minute < 15) {
    for (const [channelId] of state.channels) {
      const message = `☀️ **5 minutes to alignment.**

\`!standup start\` - Share updates, surface blockers, move on.

_Ready?_`;
      await postMessage(channelId, message);
    }
  }

  // Wednesday (2 PM) - Challenge-led
  if (dayOfWeek === 3 && hour === 14 && minute < 15) {
    for (const [channelId] of state.channels) {
      const message = `💡 **Stuck on something? Perfect timing.**

Drop me a challenge - I'll throw back 7+ creative solutions:
• \`!scamper [challenge]\` - Innovation angles you haven't considered
• \`!sixhats [decision]\` - See it from every perspective
• \`!hmw [problem]\` - Reframe obstacles as opportunities`;
      await postMessage(channelId, message);
    }
  }

  // Thursday (11 AM) - Invitation-led
  if (dayOfWeek === 4 && hour === 11 && minute < 15) {
    for (const [channelId] of state.channels) {
      const message = `⚡ **Decisions waiting too long?**

Get alignment in minutes:
• \`!consensus "Decision" "Option A" "Option B"\` - I'll follow up automatically
• \`!poll "Question?" "A" "B" "C"\` - Quick team vote

_What's been sitting in limbo?_`;
      await postMessage(channelId, message);
    }
  }

  // Friday (3 PM) - Reflection-led
  if (dayOfWeek === 5 && hour === 15 && minute < 15) {
    for (const [channelId] of state.channels) {
      const message = `🎯 **What worked this week? What didn't?**

15 minutes to lock in the learning:
• \`!retro\` - Quick reflection, clear actions
• \`!celebrate [win]\` - Wins deserve recognition

_Don't let a good week go uncaptured._`;
      await postMessage(channelId, message);
    }
  }
}

// Handle when Spark is added to a channel - post welcome message
async function handleBotAddedToChannel(channelId) {
  try {
    log('info', 'Spark added to channel', { channelId });

    const welcomeMessage = `✨ **Hi, I'm Spark** - your PM & team engagement assistant!

**Quick start:** Type \`!spark\` to see all my commands

**Popular commands:**
• \`!standup\` - Run daily standup
• \`!scamper [topic]\` - SCAMPER innovation technique
• \`!sixhats [topic]\` - Six Thinking Hats analysis
• \`!retro\` - Sprint retrospective
• \`!celebrate @user [reason]\` - Celebrate a win

Or just mention me to chat - I love helping teams collaborate!

_Tip: Try \`!icebreaker\` to get the conversation started._`;

    await postMessage(channelId, welcomeMessage);
    state.introducedChannels.add(channelId);
  } catch (error) {
    log('error', 'Failed to post welcome message', { channelId, error: error.message });
  }
}

// WebSocket handling
function handleWebSocketMessage(data) {
  try {
    const event = JSON.parse(data);
    if (event.event === 'posted') {
      const post = JSON.parse(event.data.post);
      handleMessage(post);
    } else if (event.event === 'user_added') {
      // Check if Spark was added to a channel
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

// Start task processor (workers handle research, reminder, follow_up, analysis)
function startTaskProcessor() {
  taskProcessor.start({
    postMessage,
    log,
    maxWorkers: 4,
    interval: 10000
  });
}

// Catchup missed mentions from before bot restart
async function catchupMissedMentions() {
  const catchupMinutes = 60; // Extended to 60 min
  const cutoffTime = Date.now() - (catchupMinutes * 60 * 1000);
  let processedCount = 0;

  log('info', 'Checking for missed mentions', { minutes: catchupMinutes });

  for (const [channelId, channelData] of state.channels) {
    try {
      // Fetch recent posts from API
      const hist = await mmApi(`/channels/${channelId}/posts?per_page=50`);
      if (!hist?.posts) continue;

      const posts = Object.values(hist.posts)
        .sort((a, b) => a.create_at - b.create_at)
        .filter(p => p.create_at > cutoffTime);

      // Find @spark mentions from non-bots that we haven't replied to
      for (const post of posts) {
        // Skip bot messages
        if (post.props?.from_bot === 'true' || post.props?.from_bot === true) continue;
        if (post.user_id === state.botUserId) continue;

        // Check if mentions @spark
        const mentionsSpark = post.message.toLowerCase().includes('@spark');
        if (!mentionsSpark) continue;

        // Check if we already replied successfully (not error messages)
        const ourReply = posts.find(p =>
          p.user_id === state.botUserId &&
          p.create_at > post.create_at &&
          !p.message.includes('encountered an error') && // Skip error replies
          (p.root_id === post.id || p.root_id === post.root_id || (!p.root_id && !post.root_id))
        );

        if (ourReply) continue; // Already responded successfully

        // Process this missed mention
        log('info', 'Processing missed mention', {
          channel: channelData.name,
          postId: post.id,
          message: post.message.substring(0, 50)
        });

        // Add small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));

        // Process like a new message
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

// Initialize
async function init() {
  log('info', 'Starting Spark Bot - PM Assistant');

  // Load saved preferences
  loadPreferences();

  // Polls handled by Socialite bot

  // Load GitHub context if available
  loadGithubContext();

  // Initialize semantic memory (vector + graph stores)
  try {
    await semanticMemory.init({ log: (level, msg, data) => log(level, `[Memory] ${msg}`, data) });
    log('info', 'Semantic memory initialized');
  } catch (err) {
    log('warn', 'Semantic memory init failed, continuing without', { error: err.message });
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
          // PREFETCH HISTORY - fetch from API and persist to disk
          let initialMessages = [];
          const ignoredBots = config.spark?.ignoreBotUserIds || [];
          try {
              const hist = await mmApi(`/channels/${channel.id}/posts?per_page=100`);
              if (hist && hist.posts) {
                  const posts = Object.values(hist.posts).sort((a, b) => a.create_at - b.create_at);
                  // Filter out bot messages to prevent echo chamber in history
                  const filteredPosts = posts.filter(p => {
                      // Skip messages from bots (from_bot flag)
                      if (p.props?.from_bot === 'true' || p.props?.from_bot === true) return false;
                      // Skip messages from ignored bot IDs
                      if (ignoredBots.includes(p.user_id)) return false;
                      // Skip empty messages
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
                  // Persist to disk
                  const result = memory.bulkAppendMessages(channel.id, initialMessages);
                  log('info', `Synced history for ${channel.name}`, { added: result.added, total: result.total, filtered: posts.length - filteredPosts.length });
              }
          } catch (err) {
              log('warn', `Failed to prefetch history for ${channel.name}`, { error: err.message });
              // Try loading from persistent storage if API fails
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

    // Catchup: process missed mentions from last 30 minutes
    await catchupMissedMentions();

    // Scheduled tasks - DISABLED: respond only when mentioned
    // setInterval(scheduledCheckIn, 15 * 60 * 1000);

    // Schedule GitHub context refresh (daily by default)
    scheduleGithubRefresh();

    // Log GitHub status
    const repoCount = Object.keys(githubContext.repos).length;
    if (repoCount > 0) {
      log('info', 'GitHub context loaded', { repos: repoCount, lastRefresh: githubContext.lastRefresh });
    } else if (config.github?.enabled) {
      log('info', 'GitHub enabled but no repos onboarded. Use !onboard owner/repo to add repositories.');
    }

    // Start task processor with worker threads
    startTaskProcessor();

    log('info', 'Spark Bot started successfully');
    log('info', 'Commands: !standup, !scamper, !sixhats, !hmw, !retro, !icebreaker, !celebrate, !tutorial, !onboard, !repos, !codebase, !tasks');

  } catch (error) {
    log('error', 'Initialization failed', { error: error.message });
    process.exit(1);
  }
}

init();

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

