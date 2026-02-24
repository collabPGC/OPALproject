// Scout summary and product update handlers

// Channel summarization
export async function summarizeChannel(channelId, hours, autoCreateJira, ctx) {
  const { state, anthropic, config, log, fetchChannelHistory } = ctx;

  const channelState = state.conversationHistory.get(channelId);
  if (!channelState || channelState.length === 0) {
    return "No recent messages to summarize.";
  }

  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  const recentMessages = channelState.filter(m => m.timestamp > cutoff);

  if (recentMessages.length === 0) {
    return `No messages in the last ${hours} hours.`;
  }

  const messageText = recentMessages.map(m =>
    `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.username || 'User'}: ${m.content}`
  ).join('\n');

  const systemPrompt = `You summarize channel discussions concisely and actionably.

Provide:
1. **Key Topics Discussed** (bullet points)
2. **Decisions Made** (if any)
3. **Action Items** (with owners if mentioned)
4. **Open Questions** (unresolved)
5. **Sentiment** (overall tone of discussion)

Keep it concise - max 300 words.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Summarize this channel discussion:\n\n${messageText}`
      }]
    });
    const summary = response.content[0].text;

    if (autoCreateJira && config.jira?.enabled) {
      const { extractAndCreateJiraIssues } = await import('./jira.js');
      const jiraResults = await extractAndCreateJiraIssues(messageText, summary, ctx);
      if (jiraResults && jiraResults.length > 0) {
        const jiraSection = jiraResults.map(r =>
          `- **${r.key}**: ${r.summary} ([View](${r.url}))`
        ).join('\n');
        return summary + `\n\n---\n\n\u{1F4CB} **Jira Issues Created:**\n${jiraSection}`;
      }
    }

    return summary;
  } catch (error) {
    log('error', 'Summarization failed', { error: error.message });
    return null;
  }
}

// Generate weekly product update
export async function generateProductUpdate(repo, ctx) {
  const { anthropic, config, log } = ctx;
  const { getRecentCommits, getOpenPRs } = await import('./github.js');

  const commits = await getRecentCommits(repo, 5, ctx);
  const prs = await getOpenPRs(repo, ctx);

  const systemPrompt = `You create engaging weekly product updates for team communication.

Format:
## \u{1F4E6} Weekly Product Update

### \u{1F680} What Shipped
- ...

### \u{1F504} In Progress
- ...

### \u{1F4CB} Coming Up
- ...

### \u{1F389} Highlights
- ...

Keep it concise, celebratory, and forward-looking.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate a product update based on:\n\nRecent commits:\n${commits || 'None'}\n\nOpen PRs:\n${prs || 'None'}`
      }]
    });
    return response.content[0].text;
  } catch (error) {
    log('error', 'Product update failed', { error: error.message });
    return null;
  }
}
