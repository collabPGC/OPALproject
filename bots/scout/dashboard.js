/**
 * Dashboard Module for Scout Bot
 * Weekly PM Dashboard with charts and project status
 *
 * Design principles (HBR + SAFe):
 * - Each chart communicates ONE clear message
 * - Color as signal (green/yellow/red), not decoration
 * - Max 10 KPIs per dashboard
 * - SAFe domains: Outcomes, Flow, Competency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as memory from './memory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// --- API Helpers ---

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

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.error(`Jira API error ${response.status}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('Jira API error:', error.message);
    return null;
  }
}

async function jiraAgileApi(endpoint, method = 'GET', body = null) {
  if (!config.jira?.enabled) return null;

  const url = `${config.jira.instanceUrl}/rest/agile/1.0${endpoint}`;
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

  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Jira Agile API error:', error.message);
    return null;
  }
}

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

  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Focalboard API error:', error.message);
    return null;
  }
}

// --- Data Collection Functions ---

export function collectChannelMetrics(channelId, startTime, endTime) {
  const history = memory.getHistoryByTimeRange(channelId, startTime, endTime);

  if (!history || history.length === 0) {
    return {
      total_messages: 0,
      unique_participants: 0,
      active_days: 0,
      avg_messages_per_day: 0,
      bot_messages: 0,
      user_messages: 0
    };
  }

  const uniqueUsers = new Set(history.filter(m => m.role !== 'bot').map(m => m.userId));
  const messagesByDay = {};

  for (const msg of history) {
    const day = new Date(msg.timestamp).toISOString().split('T')[0];
    messagesByDay[day] = (messagesByDay[day] || 0) + 1;
  }

  const userMessages = history.filter(m => m.role !== 'bot').length;
  const botMessages = history.filter(m => m.role === 'bot').length;
  const days = Math.max(1, Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)));

  return {
    total_messages: history.length,
    unique_participants: uniqueUsers.size,
    active_days: Object.keys(messagesByDay).length,
    avg_messages_per_day: Math.round((history.length / days) * 10) / 10,
    bot_messages: botMessages,
    user_messages: userMessages,
    messages_by_day: messagesByDay
  };
}

export async function fetchJiraSprintStatus(epicKey) {
  if (!config.jira?.enabled) return null;

  try {
    // Search for issues in the epic
    const jql = encodeURIComponent(`"Epic Link" = ${epicKey} OR parent = ${epicKey}`);
    const searchResult = await jiraApi(`/search?jql=${jql}&maxResults=100&fields=status,issuetype,priority`);

    if (!searchResult?.issues) return null;

    const statusCounts = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
    const priorityCounts = { high: 0, medium: 0, low: 0 };

    for (const issue of searchResult.issues) {
      const statusCategory = issue.fields?.status?.statusCategory?.name || 'To Do';
      if (statusCategory === 'Done') statusCounts['Done']++;
      else if (statusCategory === 'In Progress') statusCounts['In Progress']++;
      else statusCounts['To Do']++;

      const priority = issue.fields?.priority?.name?.toLowerCase() || 'medium';
      if (priority.includes('high') || priority.includes('critical')) priorityCounts.high++;
      else if (priority.includes('low')) priorityCounts.low++;
      else priorityCounts.medium++;
    }

    const total = searchResult.issues.length;
    const completion = total > 0 ? Math.round((statusCounts['Done'] / total) * 100) : 0;

    return {
      epic_key: epicKey,
      total_issues: total,
      to_do: statusCounts['To Do'],
      in_progress: statusCounts['In Progress'],
      done: statusCounts['Done'],
      completion_percentage: completion,
      priority_breakdown: priorityCounts,
      last_updated: Date.now()
    };
  } catch (error) {
    console.error('Error fetching Jira status:', error.message);
    return null;
  }
}

export async function fetchFocalboardStatus(boardId) {
  try {
    const blocks = await focalboardApi(`/boards/${boardId}/blocks?all=true`);
    if (!blocks) return null;

    const cards = blocks.filter(b => b.type === 'card');
    const statusCounts = {};
    let completedThisWeek = 0;
    let addedThisWeek = 0;
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const card of cards) {
      // Count by status property (varies by board setup)
      const status = card.fields?.properties?.status ||
                     card.fields?.properties?.['a7ra1z9j8w5q4b5j8d9e2f3g'] || // common status property ID
                     'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Track weekly changes
      if (card.createAt && card.createAt > weekAgo) addedThisWeek++;
      if (card.updateAt && card.updateAt > weekAgo &&
          (status === 'Completed' || status === 'Done')) {
        completedThisWeek++;
      }
    }

    return {
      board_id: boardId,
      total_cards: cards.length,
      by_status: statusCounts,
      cards_added_this_week: addedThisWeek,
      cards_completed_this_week: completedThisWeek,
      last_updated: Date.now()
    };
  } catch (error) {
    console.error('Error fetching Focalboard status:', error.message);
    return null;
  }
}

// --- Chart Generation (QuickChart.io) ---

function encodeChartUrl(chartConfig, width = 600, height = 300) {
  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&w=${width}&h=${height}&bkg=white`;
}

export function generateFlowVelocityChart(projects) {
  const labels = projects.map(p => p.channel_name?.substring(0, 15) || 'Unknown');
  const completed = projects.map(p => p.jira_status?.done || 0);
  const inProgress = projects.map(p => p.jira_status?.in_progress || 0);

  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Completed', data: completed, backgroundColor: '#4CAF50' },
        { label: 'In Progress', data: inProgress, backgroundColor: '#2196F3' }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Flow Velocity by Project' }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  };

  return encodeChartUrl(chartConfig, 600, 300);
}

export function generateSprintProgressChart(jiraStatus, projectName) {
  if (!jiraStatus) return null;

  const chartConfig = {
    type: 'bar',
    data: {
      labels: [projectName || 'Sprint Progress'],
      datasets: [
        { label: 'Done', data: [jiraStatus.done], backgroundColor: '#4CAF50' },
        { label: 'In Progress', data: [jiraStatus.in_progress], backgroundColor: '#2196F3' },
        { label: 'To Do', data: [jiraStatus.to_do], backgroundColor: '#9E9E9E' }
      ]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        title: { display: true, text: `${jiraStatus.completion_percentage}% Complete` }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  };

  return encodeChartUrl(chartConfig, 500, 150);
}

export function generateActivityTrendChart(projects, days = 7) {
  // Generate last N day labels
  const labels = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
  }

  const datasets = projects.slice(0, 5).map((p, idx) => {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
    const data = [];

    // Get messages per day from channel metrics
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().split('T')[0];
      data.push(p.channel_metrics?.messages_by_day?.[dayKey] || 0);
    }

    return {
      label: p.channel_name?.substring(0, 12) || 'Unknown',
      data,
      borderColor: colors[idx % colors.length],
      fill: false,
      tension: 0.3
    };
  });

  const chartConfig = {
    type: 'line',
    data: { labels, datasets },
    options: {
      plugins: {
        title: { display: true, text: 'Channel Activity (7 Days)' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  };

  return encodeChartUrl(chartConfig, 600, 300);
}

export function generateTaskDistributionChart(aggregates) {
  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: ['Tasks', 'Blockers', 'Ideas', 'Research', 'Follow-ups'],
      datasets: [{
        data: [
          aggregates.total_tasks || 0,
          aggregates.total_blockers || 0,
          aggregates.total_ideas || 0,
          aggregates.total_research || 0,
          aggregates.total_follow_ups || 0
        ],
        backgroundColor: ['#4CAF50', '#F44336', '#9C27B0', '#FF9800', '#2196F3']
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Captured Items Distribution' }
      }
    }
  };

  return encodeChartUrl(chartConfig, 400, 400);
}

// --- Health Calculation ---

export function calculateProjectHealth(project) {
  const concerns = [];
  let score = 100;

  // Check blockers
  const blockers = project.captured_items?.blockers || 0;
  if (blockers > 0) {
    score -= blockers * 10;
    concerns.push(`${blockers} active blocker(s)`);
  }

  // Check research queue age
  const oldResearch = (project.research_queue || []).filter(r => {
    const age = Date.now() - (r.created_at || 0);
    return age > 3 * 24 * 60 * 60 * 1000; // 3 days
  });
  if (oldResearch.length > 0) {
    score -= oldResearch.length * 5;
    concerns.push(`${oldResearch.length} research item(s) > 3 days old`);
  }

  // Check follow-up queue
  const pendingFollowUps = (project.follow_ups_pending || []).length;
  if (pendingFollowUps > 5) {
    score -= 10;
    concerns.push(`${pendingFollowUps} pending follow-ups`);
  }

  // Check Jira completion
  if (project.jira_status) {
    if (project.jira_status.completion_percentage < 25) {
      score -= 15;
      concerns.push(`Sprint only ${project.jira_status.completion_percentage}% complete`);
    }
  }

  // Check channel activity
  if (project.channel_metrics?.total_messages === 0) {
    score -= 20;
    concerns.push('No channel activity this week');
  }

  score = Math.max(0, Math.min(100, score));

  let status = 'green';
  if (score < 50) status = 'red';
  else if (score < 75) status = 'yellow';

  return { score, status, concerns };
}

// --- Main Aggregation ---

export async function aggregateAllProjects(startTime, endTime) {
  const channelBoardMapping = config.capture?.channelBoardMapping || {};
  const channelEpicMapping = config.capture?.channelEpicMapping || {};
  const channelNames = config.capture?.channelNames || {};
  const boardNames = config.capture?.boardNames || {};

  const projects = [];

  for (const [channelId, boardId] of Object.entries(channelBoardMapping)) {
    const channelName = channelNames[channelId] || channelId;
    const epicKey = channelEpicMapping[channelId];

    console.log(`[DASHBOARD] Aggregating project: ${channelName}`);

    const projectData = {
      channel_id: channelId,
      channel_name: channelName,
      board_id: boardId,
      board_name: boardNames[boardId] || boardId,
      jira_epic: epicKey || null,

      // Collect channel metrics
      channel_metrics: collectChannelMetrics(channelId, startTime, endTime),

      // Get weekly stats from memory
      weekly_stats: memory.getWeeklyStats(channelId),

      // Get queues
      research_queue: memory.getResearchQueue(channelId, 'open'),
      follow_ups_pending: memory.getFollowUpQueue(channelId, 'pending'),

      // Fetch external data
      jira_status: epicKey ? await fetchJiraSprintStatus(epicKey) : null,
      focalboard_status: await fetchFocalboardStatus(boardId)
    };

    // Calculate captured items from weekly stats
    projectData.captured_items = {
      tasks: projectData.weekly_stats?.tasks_created || 0,
      decisions: projectData.weekly_stats?.decisions_made || 0,
      blockers: projectData.weekly_stats?.blockers_identified || 0,
      ideas: projectData.weekly_stats?.ideas_captured || 0,
      research: projectData.weekly_stats?.research_items || 0,
      follow_ups: projectData.weekly_stats?.follow_ups || 0
    };

    // Calculate health
    projectData.health = calculateProjectHealth(projectData);

    projects.push(projectData);
  }

  // Sort by health score (worst first for attention)
  projects.sort((a, b) => a.health.score - b.health.score);

  // Calculate aggregates
  const aggregates = {
    total_messages: projects.reduce((sum, p) => sum + (p.channel_metrics?.total_messages || 0), 0),
    total_tasks: projects.reduce((sum, p) => sum + (p.captured_items?.tasks || 0), 0),
    total_blockers: projects.reduce((sum, p) => sum + (p.captured_items?.blockers || 0), 0),
    total_ideas: projects.reduce((sum, p) => sum + (p.captured_items?.ideas || 0), 0),
    total_research: projects.reduce((sum, p) => sum + (p.captured_items?.research || 0), 0),
    total_follow_ups: projects.reduce((sum, p) => sum + (p.captured_items?.follow_ups || 0), 0),
    most_active_channel: projects.reduce((max, p) =>
      (p.channel_metrics?.total_messages || 0) > (max?.channel_metrics?.total_messages || 0) ? p : max
    , null)?.channel_name || 'N/A',
    channels_needing_attention: projects.filter(p => p.health.status !== 'green').map(p => p.channel_name)
  };

  return { projects, aggregates };
}

// --- Executive Summary Generation ---

export function generateExecutiveSummary(dashboardData) {
  const { projects, aggregates } = dashboardData;

  const highlights = [];
  const risks = [];

  // Generate highlights
  if (aggregates.total_messages > 0) {
    highlights.push(`${aggregates.total_messages} messages across ${projects.length} projects`);
  }

  const completedTasks = aggregates.total_tasks;
  if (completedTasks > 0) {
    highlights.push(`${completedTasks} tasks captured this week`);
  }

  const mostActive = aggregates.most_active_channel;
  if (mostActive !== 'N/A') {
    highlights.push(`Most active: #${mostActive}`);
  }

  // Generate risks
  const redProjects = projects.filter(p => p.health.status === 'red');
  if (redProjects.length > 0) {
    risks.push(`${redProjects.length} project(s) need immediate attention`);
  }

  if (aggregates.total_blockers > 0) {
    risks.push(`${aggregates.total_blockers} active blockers across projects`);
  }

  const totalResearch = projects.reduce((sum, p) => sum + (p.research_queue?.length || 0), 0);
  if (totalResearch > 5) {
    risks.push(`${totalResearch} research items pending investigation`);
  }

  // Overall health
  const avgScore = projects.reduce((sum, p) => sum + p.health.score, 0) / Math.max(projects.length, 1);
  let overallHealth = 'green';
  if (avgScore < 50) overallHealth = 'red';
  else if (avgScore < 75) overallHealth = 'yellow';

  return {
    overall_health: overallHealth,
    average_score: Math.round(avgScore),
    key_highlights: highlights.length > 0 ? highlights : ['No significant activity this week'],
    top_risks: risks.length > 0 ? risks : ['No major risks identified']
  };
}

// --- Dashboard Formatting ---

function getHealthEmoji(status) {
  return { green: '🟢', yellow: '🟡', red: '🔴' }[status] || '⚪';
}

function formatDateRange(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const options = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
}

export function formatProjectSection(project) {
  const health = project.health;
  const jira = project.jira_status;
  const board = project.focalboard_status;
  const metrics = project.channel_metrics;

  let md = `
### ${getHealthEmoji(health.status)} ${project.channel_name}

**Channel Activity:** ${metrics?.total_messages || 0} messages from ${metrics?.unique_participants || 0} participants

`;

  // Jira/Focalboard table
  if (jira || board) {
    md += `| Jira Status | Focalboard |\n|-------------|------------|\n`;
    md += `| ${jira ? `${jira.completion_percentage}% complete` : 'N/A'} | ${board?.total_cards || 0} cards |\n`;
    md += `| ${jira ? `${jira.to_do}/${jira.in_progress}/${jira.done} (To Do/Active/Done)` : 'N/A'} | ${board?.cards_completed_this_week || 0} completed this week |\n\n`;
  }

  // Captured items
  const items = project.captured_items || {};
  md += `**Captured This Week:**\n`;
  md += `- Tasks: ${items.tasks || 0} | Decisions: ${items.decisions || 0} | Blockers: ${items.blockers || 0}\n`;
  md += `- Ideas: ${items.ideas || 0} | Research: ${items.research || 0} | Follow-ups: ${items.follow_ups || 0}\n\n`;

  // Concerns
  if (health.concerns.length > 0) {
    md += `**Concerns:** ${health.concerns.join(', ')}\n\n`;
  }

  // Links
  md += `[View Board](${config.mattermost.url}/boards/team/${project.board_id})`;
  if (project.jira_epic) {
    md += ` | [View Jira Epic](${config.jira.instanceUrl}/browse/${project.jira_epic})`;
  }
  md += '\n';

  return md;
}

export function formatResearchQueue(projects) {
  const allResearch = projects.flatMap(p =>
    (p.research_queue || []).map(r => ({
      ...r,
      project: p.channel_name,
      age_days: Math.round((Date.now() - (r.created_at || 0)) / (24 * 60 * 60 * 1000))
    }))
  );

  if (allResearch.length === 0) return '_No research items pending_';

  return allResearch
    .sort((a, b) => (a.priority === 'high' ? -1 : 1))
    .slice(0, 10)
    .map(r => `- **[${r.project}]** ${r.title} (${r.priority}, ${r.age_days}d old)`)
    .join('\n');
}

export function formatFollowUpsQueue(projects) {
  const allFollowUps = projects.flatMap(p =>
    (p.follow_ups_pending || []).map(f => ({ ...f, project: p.channel_name }))
  );

  if (allFollowUps.length === 0) return '_No follow-ups pending_';

  return allFollowUps
    .slice(0, 10)
    .map(f => `- **[${f.project}]** ${f.title}${f.due_context ? ` (${f.due_context})` : ''}`)
    .join('\n');
}

export function formatDashboard(dashboardData, label = 'Weekly') {
  const { executive_summary, projects, aggregates, time_range } = dashboardData;

  let md = `# ${label} PM Dashboard

**Period:** ${time_range.label}
**Generated:** ${new Date().toLocaleString()}

---

## Executive Summary

**Overall Health:** ${getHealthEmoji(executive_summary.overall_health)} ${executive_summary.overall_health.toUpperCase()} (Score: ${executive_summary.average_score}/100)

### Key Highlights
${executive_summary.key_highlights.map(h => `- ${h}`).join('\n')}

### Risks & Attention Needed
${executive_summary.top_risks.map(r => `- :warning: ${r}`).join('\n')}

---

## Aggregate Metrics (SAFe Flow)

| Metric | This Week |
|--------|-----------|
| Total Messages | ${aggregates.total_messages} |
| Tasks Created | ${aggregates.total_tasks} |
| Blockers Identified | ${aggregates.total_blockers} |
| Research Items | ${aggregates.total_research} |
| Follow-ups | ${aggregates.total_follow_ups} |
| Most Active | #${aggregates.most_active_channel} |

---

## Per-Project Status

`;

  for (const project of projects) {
    md += formatProjectSection(project);
    md += '\n---\n';
  }

  md += `
## Research Queue (Needs Investigation)

${formatResearchQueue(projects)}

---

## Follow-ups Pending

${formatFollowUpsQueue(projects)}

---

## Drill-Down Links

${projects.map(p => `- **${p.channel_name}:** [Focalboard](${config.mattermost.url}/boards/team/${p.board_id})${p.jira_epic ? ` | [Jira](${config.jira.instanceUrl}/browse/${p.jira_epic})` : ''}`).join('\n')}

`;

  return md;
}

// --- Main Dashboard Generation ---

export async function generateDashboard(days = 7, label = 'Weekly') {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);

  console.log(`[DASHBOARD] Generating ${label} dashboard for last ${days} days`);

  // Aggregate all data
  const dashboardData = await aggregateAllProjects(startTime, endTime);

  // Add time range info
  dashboardData.time_range = {
    start: startTime,
    end: endTime,
    label: formatDateRange(startTime, endTime)
  };

  // Generate executive summary
  dashboardData.executive_summary = generateExecutiveSummary(dashboardData);

  // Generate charts
  dashboardData.charts = {
    flow_velocity: generateFlowVelocityChart(dashboardData.projects),
    activity_trend: generateActivityTrendChart(dashboardData.projects, days),
    task_distribution: generateTaskDistributionChart(dashboardData.aggregates)
  };

  // Per-project sprint charts
  for (const project of dashboardData.projects) {
    if (project.jira_status) {
      project.sprint_chart = generateSprintProgressChart(project.jira_status, project.channel_name);
    }
  }

  // Format the dashboard text
  dashboardData.formatted_text = formatDashboard(dashboardData, label);

  return dashboardData;
}

export default {
  generateDashboard,
  aggregateAllProjects,
  generateExecutiveSummary,
  formatDashboard,
  generateFlowVelocityChart,
  generateActivityTrendChart,
  generateTaskDistributionChart,
  generateSprintProgressChart,
  collectChannelMetrics,
  fetchJiraSprintStatus,
  fetchFocalboardStatus,
  calculateProjectHealth
};
