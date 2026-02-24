// Shared Social Intelligence Module
// Handles all social cues, responses, and team engagement patterns

// ============ GREETING RESPONSES ============
export const greetingResponses = {
  casual: [
    "Hey! What's on your mind?",
    "Hi there! How can I help?",
    "Hey! Good to see you.",
    "Hello! What can I do for you?",
    "Hi! Ready when you are."
  ],
  morning: [
    "Good morning! Ready to tackle the day?",
    "Morning! What's the plan for today?",
    "Good morning! Coffee in hand, let's do this."
  ],
  afternoon: [
    "Good afternoon! How's the day going?",
    "Afternoon! Making good progress?",
    "Good afternoon! What can I help with?"
  ],
  evening: [
    "Good evening! Wrapping up for the day?",
    "Evening! Still going strong?",
    "Good evening! How can I help?"
  ]
};

export function getGreetingResponse() {
  const hour = new Date().getHours();
  let pool;

  if (hour >= 5 && hour < 12) {
    pool = [...greetingResponses.casual, ...greetingResponses.morning];
  } else if (hour >= 12 && hour < 17) {
    pool = [...greetingResponses.casual, ...greetingResponses.afternoon];
  } else {
    pool = [...greetingResponses.casual, ...greetingResponses.evening];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// ============ FAREWELL RESPONSES ============
export const farewellResponses = [
  "See you later!",
  "Catch you later!",
  "Take care!",
  "Later! Ping me anytime.",
  "Bye! Have a great one.",
  "See ya!",
  "Talk soon!"
];

export function getFarewellResponse() {
  return farewellResponses[Math.floor(Math.random() * farewellResponses.length)];
}

// ============ ACKNOWLEDGMENT RESPONSES ============
export const acknowledgmentResponses = [
  null, // Often best to not respond
  null,
  null,
  "👍",
  "🙌",
  "✨",
  "Got it!",
  "Sounds good!"
];

export function getAcknowledgmentResponse() {
  return acknowledgmentResponses[Math.floor(Math.random() * acknowledgmentResponses.length)];
}

// ============ CLARIFYING QUESTIONS ============
export const clarifyingQuestions = [
  "What would you like me to help with?",
  "Need me to dig into that, or just chatting?",
  "Want me to research that or brainstorm some ideas?",
  "Should I look into this further?",
  "Anything specific you'd like me to do?"
];

export function getClarifyingQuestion() {
  return clarifyingQuestions[Math.floor(Math.random() * clarifyingQuestions.length)];
}

// ============ WIN/CELEBRATION DETECTION ============
export const winPatterns = [
  /shipped|launched|released|deployed|went live/i,
  /fixed|resolved|solved|closed/i,
  /completed|finished|done|accomplished/i,
  /merged|approved|passed/i,
  /milestone|achievement|breakthrough/i,
  /\b(won|win|winning)\b/i,
  /great job|well done|kudos|props|shoutout/i,
  /promoted|hired|onboarded/i,
  /signed|closed deal|new customer|new client/i,
  /🎉|🚀|✅|💪|🏆|⭐|🔥|👏/
];

export function detectWin(text) {
  return winPatterns.some(p => p.test(text));
}

export const cheerMessages = [
  "That's fantastic! Great work!",
  "Awesome achievement! Keep it up!",
  "Congratulations on that win!",
  "Amazing progress! Well done!",
  "That's a great milestone!",
  "Crushing it! Keep that momentum going.",
  "Love seeing progress like this!",
  "This is the kind of update that makes my day!",
  "Another one in the books. Well done!",
  "On fire! What's the secret sauce?",
  "This deserves recognition. Great work!",
  "Momentum is everything - and you've got it!"
];

export function getCheerMessage() {
  return cheerMessages[Math.floor(Math.random() * cheerMessages.length)];
}

// ============ SENTIMENT DETECTION ============
export const sentimentPatterns = {
  frustrated: [
    /frustrated|annoyed|irritated|angry|mad/i,
    /stuck|blocked|can't|won't work/i,
    /ugh|argh|grr|damn|crap/i,
    /broken|failing|crashed|error/i,
    /😤|😠|😡|🤬|😫|😩/
  ],
  excited: [
    /excited|thrilled|pumped|hyped|stoked/i,
    /can't wait|looking forward/i,
    /amazing|incredible|awesome|fantastic/i,
    /🎉|🚀|🔥|💪|🙌|😍|🤩/
  ],
  confused: [
    /confused|lost|don't understand|makes no sense/i,
    /what does|how does|why does/i,
    /unclear|vague|ambiguous/i,
    /🤔|😕|❓|🤷/
  ],
  tired: [
    /tired|exhausted|burned out|burnout/i,
    /long day|long week|need a break/i,
    /😴|🥱|😪/
  ],
  positive: [
    /thanks|thank you|appreciate|grateful/i,
    /great|good|nice|awesome|perfect/i,
    /love it|looks good|well done/i,
    /👍|✅|💯|⭐/
  ]
};

export function detectSentiment(text) {
  for (const [sentiment, patterns] of Object.entries(sentimentPatterns)) {
    if (patterns.some(p => p.test(text))) {
      return sentiment;
    }
  }
  return 'neutral';
}

// ============ EMPATHETIC RESPONSES ============
export const empatheticResponses = {
  frustrated: [
    "That sounds frustrating. Want to talk through it?",
    "I hear you. Let me see if I can help.",
    "That's tough. What's blocking you?",
    "Let's figure this out together."
  ],
  excited: [
    "Love the energy! Tell me more!",
    "That's exciting! What's the plan?",
    "Awesome! Let's make it happen."
  ],
  confused: [
    "Let me help clarify that.",
    "Good question! Let me explain.",
    "I can see why that's confusing. Let me break it down."
  ],
  tired: [
    "Sounds like a long stretch. Anything I can help lighten?",
    "Take care of yourself. What's the priority right now?",
    "Been there. What's the most important thing to tackle?"
  ],
  positive: [
    "Glad to help!",
    "Great to hear!",
    "Happy to assist anytime."
  ]
};

export function getEmpatheticResponse(sentiment) {
  const responses = empatheticResponses[sentiment] || empatheticResponses.positive;
  return responses[Math.floor(Math.random() * responses.length)];
}

// ============ TEAM ENGAGEMENT ============
export const icebreakers = [
  "If you could have any superpower for one day, what would it be?",
  "What's the most interesting thing you learned this week?",
  "If you could instantly become an expert in something, what would you choose?",
  "What's a small win you've had recently?",
  "If our team was a band, what genre would we play?",
  "What's your go-to productivity hack?",
  "If you could work from anywhere for a month, where would you go?",
  "What was your favorite game to play as a kid?",
  "What's something on your bucket list?",
  "If you could have dinner with anyone (alive or historical), who would it be?",
  "What's the best advice you've ever received?",
  "What's a skill you'd love to learn this year?",
  "Coffee, tea, or something else entirely?",
  "What's your unpopular opinion about our industry?"
];

export function getIcebreaker() {
  return icebreakers[Math.floor(Math.random() * icebreakers.length)];
}

// ============ CONTEXT-AWARE RESPONSE SELECTION ============
export function selectResponse(messageType, text) {
  switch (messageType) {
    case 'greeting':
      return getGreetingResponse();
    case 'farewell':
      return getFarewellResponse();
    case 'acknowledgment':
      return getAcknowledgmentResponse();
    case 'short':
    case 'unclear':
      return getClarifyingQuestion();
    default:
      const sentiment = detectSentiment(text);
      if (sentiment !== 'neutral') {
        return getEmpatheticResponse(sentiment);
      }
      return null; // Let AI handle substantive messages
  }
}

// ============ MESSAGE REACTION SUGGESTIONS ============
export function suggestReaction(text) {
  if (detectWin(text)) return 'tada';

  const sentiment = detectSentiment(text);
  switch (sentiment) {
    case 'excited': return 'fire';
    case 'positive': return 'thumbsup';
    case 'frustrated': return 'eyes'; // Acknowledging
    default: return null;
  }
}

export default {
  // Greetings
  getGreetingResponse,
  greetingResponses,

  // Farewells
  getFarewellResponse,
  farewellResponses,

  // Acknowledgments
  getAcknowledgmentResponse,
  acknowledgmentResponses,

  // Clarifying
  getClarifyingQuestion,
  clarifyingQuestions,

  // Wins & Celebrations
  detectWin,
  getCheerMessage,
  cheerMessages,
  winPatterns,

  // Sentiment
  detectSentiment,
  sentimentPatterns,
  getEmpatheticResponse,
  empatheticResponses,

  // Team Engagement
  getIcebreaker,
  icebreakers,

  // Helpers
  selectResponse,
  suggestReaction
};
