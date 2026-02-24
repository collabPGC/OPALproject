// Shared message classification module

// Check if message is a question
export function isQuestion(text, patterns = []) {
  const defaultPatterns = [
    '\\?$',
    '^(who|what|when|where|why|how|can|could|would|should|is|are|do|does)',
    'anyone know',
    'any ideas',
    'thoughts on'
  ];
  const allPatterns = [...defaultPatterns, ...patterns];
  return allPatterns.some(pattern => new RegExp(pattern, 'i').test(text));
}

// Check if message contains trigger keywords
export function hasTriggerKeyword(text, keywords = []) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Check if message is a greeting
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

// Check if message is a farewell
export function isFarewell(text) {
  const farewellPatterns = [
    /^(bye|goodbye|cya|see ya|later|peace|out)[\s!.,?]*$/i,
    /^(have a good|have a great|enjoy your)[\s\w]*$/i,
    /^(talk soon|catch you later|signing off)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return farewellPatterns.some(p => p.test(cleanText));
}

// Detect simple acknowledgment
export function isAcknowledgment(text) {
  const ackPatterns = [
    /^(ok|okay|k|kk|got it|understood|sure|yep|yup|yeah|yes|no|nope|nah|alright|sounds good|will do)[\s!.,?]*$/i,
    /^(thanks|thx|ty|thank you|appreciated)[\s!.,?]*$/i,
    /^(cool|nice|great|awesome|perfect|👍|✅|🙌)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return ackPatterns.some(p => p.test(cleanText));
}

// Classify message type
export function classifyMessage(text, recentMessages = []) {
  const cleanText = text.replace(/@\w+/g, '').trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  // Check explicit patterns first
  if (isGreeting(text)) return { type: 'greeting', confidence: 'high' };
  if (isFarewell(text)) return { type: 'farewell', confidence: 'high' };
  if (isAcknowledgment(text)) return { type: 'acknowledgment', confidence: 'high' };

  // Check for commands
  if (text.startsWith('!')) return { type: 'command', confidence: 'high' };

  // Check for questions
  if (isQuestion(text)) return { type: 'question', confidence: 'high' };

  // Short messages without clear intent
  if (wordCount <= 3) {
    return { type: 'short', confidence: 'medium' };
  }

  // Longer messages are likely substantive
  return { type: 'substantive', confidence: 'medium' };
}

// Detect a win/success message
export function detectWin(text) {
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

// Detect if message is a Jira-related request
export function isJiraRequest(text) {
  const jiraPatterns = [
    /\b(jira|ticket|issue|story|bug|task|backlog)\b/i,
    /\bcreate\s+(a\s+)?(ticket|issue|story|bug|task)\b/i,
    /\badd\s+(to\s+)?(backlog|jira)\b/i,
    /\blog\s+(this|that|it)\b/i,
    /\btrack\s+(this|that|it)\b/i,
    /\b(show|list|get)\s+(the\s+)?(backlog|issues|tickets)\b/i,
    /\bdelete\s+[A-Z]+-\d+\b/i,
    /\bupdate\s+[A-Z]+-\d+\b/i,
    /\b[A-Z]+-\d+\b.*\b(done|complete|in progress|start|close)\b/i
  ];

  return jiraPatterns.some(p => p.test(text));
}

// Detect if message is a GitHub-related request
export function isGitHubRequest(text) {
  const githubPatterns = [
    /\b(github|repo|repository|commit|pr|pull request|issue|branch)\b/i,
    /\b(show|list|get)\s+(the\s+)?(repos|repositories|commits|prs|issues)\b/i,
    /\b(create|open)\s+(a\s+)?(pr|pull request|issue)\b/i,
    /\bwhat('?s| is)\s+(happening|going on)\s+(in|with)\s+(the\s+)?(repo|codebase)\b/i
  ];

  return githubPatterns.some(p => p.test(text));
}

export default {
  isQuestion,
  hasTriggerKeyword,
  isGreeting,
  isFarewell,
  isAcknowledgment,
  classifyMessage,
  detectWin,
  isJiraRequest,
  isGitHubRequest
};
