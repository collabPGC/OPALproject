// Static response arrays and random selectors for Spark bot

// Greeting responses - value-focused, 20 words or less, varied structure
const greetingResponses = [
  "What's the team stuck on? Let's unstick it.",
  "Hey! Need alignment, ideas, or decisions? Pick one - I'll make it happen.",
  "Hi! Meetings into momentum. What should we tackle?",
  "Faster alignment, better ideas. What's on the agenda?",
  "Hey! Throw me a challenge - standup, brainstorm, or decision?",
  "Hi! Team productivity, turbocharged. What do you need?"
];

// Farewell responses
const farewellResponses = [
  "Catch you later!",
  "See ya! Great session.",
  "Later! Ping me anytime.",
  "Take care!",
  "Until next time!"
];

// Acknowledgment responses (emoji reactions)
const acknowledgmentResponses = ["thumbsup", "raised_hands", "zap"];

// Cheer messages
const sparkCheerMessages = [
  "That's worth celebrating! What made this one work?",
  "Momentum builds momentum - what's next?",
  "Crushing it! Quick retro: what's the takeaway from this win?",
  "Love it! Should we shout this out to the broader team?",
  "Another W on the board! Who else deserves credit?",
  "On fire! Is there a pattern here we should replicate?",
  "This deserves recognition - want me to draft a celebration post?",
  "Progress! What obstacle did you overcome to get here?"
];

// Clarifying questions
const clarifyingQuestions = [
  "What can I help with? Standup, brainstorm, or something else?",
  "Need me to facilitate something, or just chatting?",
  "Should I run a brainstorm, retro, or poll on that?",
  "Want me to help the team with something specific?",
  "How can I help? I do standups, retros, brainstorms, and polls!"
];

// Command offerings - rotate through these
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

// Icebreaker questions
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

// Random selector helper
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getSparkGreetingResponse() {
  return randomFrom(greetingResponses);
}

export function getSparkFarewellResponse() {
  return randomFrom(farewellResponses);
}

export function getSparkAcknowledgmentResponse() {
  if (Math.random() < 0.7) return null;
  return randomFrom(acknowledgmentResponses);
}

export function getSparkCheerMessage() {
  return randomFrom(sparkCheerMessages);
}

export function getSparkClarifyingQuestion(messageType, originalText) {
  return randomFrom(clarifyingQuestions);
}

export function getRandomSparkOffering() {
  return randomFrom(sparkOfferings);
}

export function generateIcebreaker() {
  return randomFrom(icebreakers);
}

export { sparkOfferings };
