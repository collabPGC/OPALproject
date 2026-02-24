// Intent classification and context detection for Spark bot

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

// Check trigger patterns from config
export function isQuestion(text, config) {
  const patterns = config.spark.questionPatterns;
  return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
}

export function hasTriggerKeyword(text, config) {
  const keywords = config.spark.triggerKeywords;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Classify message context (simple/declarative)
export function classifyMessage(text, config, recentMessages = []) {
  const cleanText = text.replace(/@\w+/g, '').trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  if (isGreeting(text)) return { type: 'greeting', confidence: 'high' };
  if (isFarewell(text)) return { type: 'farewell', confidence: 'high' };
  if (isAcknowledgment(text)) return { type: 'acknowledgment', confidence: 'high' };
  if (text.startsWith('!')) return { type: 'command', confidence: 'high' };

  if (wordCount <= 3) {
    return { type: 'brief', confidence: 'medium', needsClarification: true };
  }

  if (isQuestion(text, config) && wordCount >= 5) {
    return { type: 'question', confidence: 'high' };
  }

  if (hasTriggerKeyword(text, config) && wordCount >= 5) {
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

// LLM-based intent classification
export async function classifyIntent(message, recentMessages, channelName, ctx) {
  const { anthropic, log } = ctx;

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
  "reaction": "emoji or null",    // If not responding, suggest reaction
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
- "thanks": Thanking Spark (react or brief response)
- "celebration": Sharing a win/success (react, maybe brief congrats)
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
7. DON'T OVER-RESPOND: Good news without a question = react instead of long response
8. TEAM DYNAMICS: Recognize when someone needs facilitation vs just venting vs asking for help
9. FACILITATION CUES: "can you help us decide", "we're stuck as a team", "need to align on" = facilitation_request

WHEN TO RESPOND vs REACT:
- respond=true: Questions, help requests, feedback requests, standup/retro/brainstorm requests, facilitation
- respond=false + reaction: Thanks, celebrations, sharing without asking
- load_history=true: For summary_request, OR when historical context helps answer the question
- Match persona to request type (standup_request -> standup, brainstorm_request -> brainstorm, retro_request -> retro)`;

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
