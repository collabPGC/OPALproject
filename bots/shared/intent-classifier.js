// Shared intent classification utilities
// Extracted from Spark:2232-2925

import { log } from './logger.js';

/**
 * Check if text is a question using configurable regex patterns.
 * @param {string} text - The message text
 * @param {string[]} patterns - Array of regex pattern strings
 * @returns {boolean}
 */
export function isQuestion(text, patterns = []) {
  return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
}

/**
 * Detect social greetings.
 * @param {string} text - The message text
 * @returns {boolean}
 */
export function isGreeting(text) {
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

/**
 * Detect farewell/signoff messages.
 * @param {string} text - The message text
 * @returns {boolean}
 */
export function isFarewell(text) {
  const farewellPatterns = [
    /^(bye|goodbye|cya|see ya|later|peace|out)[\s!.,?]*$/i,
    /^(have a good|have a great|enjoy your)[\s\w]*$/i,
    /^(talk soon|catch you later|signing off)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return farewellPatterns.some(p => p.test(cleanText));
}

/**
 * Detect simple acknowledgment messages.
 * @param {string} text - The message text
 * @returns {boolean}
 */
export function isAcknowledgment(text) {
  const ackPatterns = [
    /^(ok|okay|k|got it|thanks|thx|ty|cool|nice|great|awesome|perfect|sounds good)[\s!.,?]*$/i,
    /^(will do|on it|sure|yep|yeah|yes|no|nope)[\s!.,?]*$/i,
    /^(\u{1F44D}|\u{2705}|\u{1F64F}|\u{1F4AF}|\u{1F389}|\u{1F44F}|\u{1F525}|\u{1F4AA})+$/u
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return ackPatterns.some(p => p.test(cleanText));
}

/**
 * Check for trigger keywords in text.
 * @param {string} text - The message text
 * @param {string[]} keywords - Array of trigger keywords
 * @returns {boolean}
 */
export function hasTriggerKeyword(text, keywords = []) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Detect win/celebration messages.
 * @param {string} text - The message text
 * @returns {boolean}
 */
export function detectWin(text) {
  const winPatterns = [
    /shipped|launched|released|deployed|went live/i,
    /fixed|resolved|solved|closed/i,
    /completed|finished|done|accomplished/i,
    /merged|approved|passed/i,
    /milestone|achievement|breakthrough/i,
    /\b(won|win|winning)\b/i,
    /great job|well done|kudos|props|shoutout/i,
    /\u{1F389}|\u{1F680}|\u{2705}|\u{1F4AA}|\u{1F3C6}|\u{2B50}/u
  ];
  return winPatterns.some(p => p.test(text));
}

/**
 * Detect Jira-related requests in natural language.
 * @param {string} text - The message text
 * @returns {boolean}
 */
export function isJiraRequest(text) {
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

/**
 * Detect GitHub-related requests in natural language.
 * @param {string} text - The message text
 * @returns {boolean}
 */
export function isGitHubRequest(text) {
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

/**
 * Rule-based message classification.
 * @param {string} text - The message text
 * @param {object[]} recentMessages - Recent messages for context
 * @param {Function} isQuestionFn - Function to check if text is a question
 * @param {Function} hasTriggerKeywordFn - Function to check for trigger keywords
 * @returns {object} Classification result: { type, confidence, needsClarification? }
 */
export function classifyMessage(text, recentMessages = [], isQuestionFn, hasTriggerKeywordFn) {
  const cleanText = text.replace(/@\w+/g, '').trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  if (isGreeting(text)) return { type: 'greeting', confidence: 'high' };
  if (isFarewell(text)) return { type: 'farewell', confidence: 'high' };
  if (isAcknowledgment(text)) return { type: 'acknowledgment', confidence: 'high' };
  if (text.startsWith('!')) return { type: 'command', confidence: 'high' };

  if (wordCount <= 3) {
    return { type: 'brief', confidence: 'medium', needsClarification: true };
  }

  if (isQuestionFn(text) && wordCount >= 5) {
    return { type: 'question', confidence: 'high' };
  }

  if (hasTriggerKeywordFn(text) && wordCount >= 5) {
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

/**
 * LLM-based intent classification.
 * @param {object} anthropicClient - Anthropic SDK client
 * @param {string} model - Model ID to use (e.g. 'claude-3-haiku-20240307')
 * @param {string} message - The user message to classify
 * @param {object[]} recentMessages - Recent channel messages for context
 * @param {string} channelName - Name of the channel
 * @param {object} botContext - Bot-specific context for the prompt:
 *   { botName, botDescription, availableCommands, intents, socialIntelligence, responseGuidelines }
 * @returns {Promise<object>} Classification result: { respond, intent, reason, reaction?, load_history?, time_range_hours?, persona? }
 */
export async function classifyIntent(anthropicClient, model, message, recentMessages = [], channelName = '', botContext = {}) {
  // Commands are always handled directly
  if (message.trim().startsWith('!')) {
    return {
      respond: true,
      intent: 'command',
      reason: 'explicit command'
    };
  }

  const {
    botName = 'Bot',
    botDescription = 'an assistant bot',
    availableCommands = '',
    intents = '',
    socialIntelligence = '',
    responseGuidelines = ''
  } = botContext;

  // Build recent context
  const recentContext = recentMessages.slice(-5).map(m =>
    `[${m.username || 'user'}]: ${m.content}`
  ).join('\n');

  const prompt = `You are classifying user intent for ${botName}, ${botDescription}.

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
${intents || `- "question": Direct question
- "help_request": Someone needs help
- "greeting": Simple hello/hi
- "thanks": Thanking the bot
- "celebration": Sharing a win/success
- "casual_chat": Casual conversation
- "unclear": Can't determine`}

${socialIntelligence ? `SOCIAL INTELLIGENCE:\n${socialIntelligence}` : `SOCIAL INTELLIGENCE - Read the room:
1. CONTEXT MATTERS: Analyze the FULL message AND recent channel context
2. HELP SIGNALS: Watch for "help", "stuck", "blocker", "question", "anyone", "ideas"
3. QUESTION PATTERNS: Messages ending in "?" or starting with who/what/when/where/why/how
4. DON'T OVER-RESPOND: Good news without a question = react instead of long response`}

${responseGuidelines ? `WHEN TO RESPOND vs REACT:\n${responseGuidelines}` : `WHEN TO RESPOND vs REACT:
- respond=true: Questions, help requests, feedback requests
- respond=false + reaction: Thanks, celebrations, sharing without asking`}`;

  try {
    const response = await anthropicClient.messages.create({
      model: model,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
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

export default {
  isQuestion,
  isGreeting,
  isFarewell,
  isAcknowledgment,
  hasTriggerKeyword,
  detectWin,
  isJiraRequest,
  isGitHubRequest,
  classifyMessage,
  classifyIntent
};
