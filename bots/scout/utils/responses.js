// Scout response generators - greetings, farewells, cheers, command offerings

// Generate appropriate greeting response - value-focused, 20 words or less, varied structure
export function getGreetingResponse() {
  const responses = [
    // Question-led
    "\u{1F44B} What's puzzling you? Give me a topic and I'll have insights in minutes.",
    "Hey! Got a question that needs answers? That's my specialty.",
    // Action/Result-led
    "Hi! Research that drives action - what should we explore?",
    "\u{1F44B} Smarter decisions, faster. What's on your mind?",
    // Invitation-led
    "Hey! Throw me a challenge - I'll turn it into actionable insights.",
    // Direct value
    "Hi! \u{1F52C} Your questions, answered with McKinsey-quality analysis. What do you need?"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate farewell response
export function getFarewellResponse() {
  const responses = [
    "Catch you later! \u{1F44B}",
    "See ya!",
    "Later! Ping me anytime.",
    "Take care! \u{1F64C}",
    "\u{1F44B}"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate acknowledgment response (or none)
export function getAcknowledgmentResponse() {
  // Often don't need to respond to acknowledgments
  if (Math.random() < 0.7) return null;
  const responses = ["\u{1F44D}", "\u{1F64C}", "\u2728"];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate clarifying question
export function getClarifyingQuestion(messageType, originalText) {
  const questions = [
    "What would you like me to help with?",
    "Need me to research something, brainstorm, or something else?",
    "Want me to dig into that, or just chatting?",
    "Should I look into this further?",
    "Anything specific you'd like me to do with that?"
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

// Cheerleading responses
const cheerMessages = [
  "\u{1F389} That's a win worth celebrating!",
  "\u{1F680} Crushing it! Keep that momentum going.",
  "\u{1F4AA} Love seeing progress like this!",
  "\u2B50 This is the kind of update that makes my day!",
  "\u{1F3C6} Another one in the books. Well done!",
  "\u{1F525} On fire! What's the secret sauce?",
  "\u{1F44F} This deserves recognition. Great work!",
  "\u2728 Momentum is everything - and you've got it!"
];

export function getCheerMessage() {
  return cheerMessages[Math.floor(Math.random() * cheerMessages.length)];
}

// Command offerings - rotate through these to keep it fresh
export const commandOfferings = [
  {
    title: "Research & Analysis",
    commands: [
      "`!research [topic]` - Get 5 hypotheses with probabilities",
      "`!brainstorm [topic]` - Creative ideas with success odds"
    ],
    example: "Try: `!research best practices for remote teams`"
  },
  {
    title: "GitHub Integration",
    commands: [
      "`!github [owner/repo]` - See commits, PRs, and issues",
      "`!update [owner/repo]` - Generate a product update"
    ],
    example: "Try: `!github hwillGIT/OPALproject`"
  },
  {
    title: "Channel Tools",
    commands: [
      "`!summary` - Digest of recent discussions",
      "`!summary 48` - Last 48 hours of activity"
    ],
    example: "Try: `!summary` to catch up on what you missed"
  },
  {
    title: "Customize Me",
    commands: [
      "`!config` - See your current settings",
      "`!askme` - I'll ask how to serve you better",
      "`!focus [topic]` - Topics I should prioritize"
    ],
    example: "Try: `!askme` and tell me what to improve!"
  }
];

export function getRandomOffering() {
  return commandOfferings[Math.floor(Math.random() * commandOfferings.length)];
}
