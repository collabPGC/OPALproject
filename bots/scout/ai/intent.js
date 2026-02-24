// Scout AI intent classification and context awareness

// Import shared pattern-matching functions for local use + re-export
import {
  isGreeting,
  isFarewell,
  isAcknowledgment,
  detectWin,
  isJiraRequest,
  isGitHubRequest
} from 'bots-shared/intent-classifier.js';

export { isGreeting, isFarewell, isAcknowledgment, detectWin, isJiraRequest, isGitHubRequest };

// Check if message contains a question
export function isQuestion(text, config) {
  const patterns = config.scout.questionPatterns;
  return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
}

// Check if message contains trigger keywords
export function hasTriggerKeyword(text, config) {
  const keywords = config.scout.triggerKeywords;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Classify message context
export function classifyMessage(text, recentMessages = [], config) {
  const cleanText = text.replace(/@\w+/g, '').trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  if (isGreeting(text)) return { type: 'greeting', confidence: 'high' };
  if (isFarewell(text)) return { type: 'farewell', confidence: 'high' };
  if (isAcknowledgment(text)) return { type: 'acknowledgment', confidence: 'high' };
  if (text.startsWith('!')) return { type: 'command', confidence: 'high' };
  if (wordCount <= 3) return { type: 'brief', confidence: 'medium', needsClarification: true };
  if (isQuestion(text, config) && wordCount >= 5) return { type: 'question', confidence: 'high' };
  if (hasTriggerKeyword(text, config) && wordCount >= 5) return { type: 'topic', confidence: 'high' };
  if (wordCount >= 4 && wordCount <= 10) return { type: 'statement', confidence: 'medium', needsClarification: true };
  if (wordCount > 10) return { type: 'discussion', confidence: 'high' };

  return { type: 'unclear', confidence: 'low', needsClarification: true };
}

// LLM-based intent classification
export async function classifyIntent(message, recentMessages = [], channelName = '', ctx) {
  const { anthropic, log } = ctx;

  // Commands are always handled directly
  if (message.trim().startsWith('!')) {
    return { respond: true, intent: 'command', reason: 'explicit command' };
  }

  // Build recent context
  const recentContext = recentMessages.slice(-5).map(m =>
    `[${m.username || 'user'}]: ${m.content}`
  ).join('\n');

  const prompt = `You are classifying user intent for Scout, a Research & PM Assistant bot with social intelligence.

MESSAGE: "${message.substring(0, 1500)}"

RECENT CHANNEL CONTEXT:
${recentContext || '(no recent messages)'}

CHANNEL: ${channelName || 'unknown'}

Respond with JSON only:
{
  "respond": true/false,
  "intent": "string",
  "reason": "brief explanation",
  "reaction": "emoji or null",
  "load_history": true/false,
  "time_range_hours": number/null,
  "persona": "string"
}

INTENTS:
- "summary_request": User ASKS FOR a summary/recap ("summarize", "catch me up", "what'd I miss")
- "feedback_request": User shares content wanting analysis ("what do you think?", "review this", "thoughts on")
- "sharing_info": Sharing info, not asking for feedback (react only)
- "question": Direct question to Scout
- "help_request": Someone is stuck, blocked, or needs help
- "research_request": Wants Scout to research/investigate something
- "brainstorm_request": Wants help ideating/brainstorming
- "jira_request": Asking about Jira/tickets/sprints/issues
- "github_request": Asking about GitHub/repos/PRs/code
- "greeting": Simple hello/hi (respond warmly but briefly)
- "thanks": Thanking Scout (react \u{1F44D}, don't respond)
- "celebration": Sharing a win/success (react \u{1F389}, maybe brief congrats)
- "standup_update": Sharing standup-style update
- "casual_chat": Casual conversation
- "unclear": Can't determine (ask clarifying question)

SOCIAL INTELLIGENCE - Read the room:
1. CONTEXT MATTERS: Analyze the FULL message AND recent channel context
2. HELP SIGNALS: Watch for "help", "stuck", "blocker", "question", "anyone", "ideas", "thoughts", "feedback", "struggling"
3. QUESTION PATTERNS: Messages ending in "?" or starting with who/what/when/where/why/how/can/could/would/should
4. EMOTIONAL CUES: Frustration, excitement, uncertainty
5. IMPLICIT ASKS: "I can't figure out X" = help_request even without explicit ask
6. MEETING NOTES/SUMMARIES: Detailed notes + "what do you think?" = feedback_request
7. DON'T OVER-RESPOND: Good news without a question = react with \u{1F389} instead of long response
8. SUBSTANTIVE ENGAGEMENT: Long messages with real content deserve thoughtful analysis when feedback is requested

WHEN TO RESPOND vs REACT:
- respond=true: Questions, help requests, feedback requests, research asks, brainstorming
- respond=false + reaction: Thanks (\u{1F44D}), celebrations (\u{1F389}), sharing without asking (\u{1F441} or \u{1F4A1})
- load_history=true: For summary_request, OR when historical context helps answer the question
- Match persona to request type (brainstorm_request \u2192 brainstorm, research_request \u2192 research)`;

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
