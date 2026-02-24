// Shared helper utilities
import { log } from './logger.js';

// Parse time string to minutes
export function parseTimeString(text) {
  const patterns = [
    { regex: /(\d+)\s*h(our)?s?/i, multiplier: 60 },
    { regex: /(\d+)\s*m(in(ute)?s?)?/i, multiplier: 1 },
    { regex: /(\d+)\s*d(ay)?s?/i, multiplier: 1440 }
  ];

  let totalMinutes = 0;
  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      totalMinutes += parseInt(match[1]) * multiplier;
    }
  }

  return totalMinutes || null;
}

// Get random response from array
export function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

// Cheer messages for wins
export const cheerMessages = [
  "That's fantastic! Great work!",
  "Awesome achievement! Keep it up!",
  "Congratulations on that win!",
  "Amazing progress! Well done!",
  "That's a great milestone!"
];

// Greeting responses
export const greetingResponses = [
  "Hey! How can I help you today?",
  "Hello! What can I do for you?",
  "Hi there! Ready to assist!",
  "Hey! Good to see you. What's on your mind?",
  "Hello! How's it going?"
];

// Farewell responses
export const farewellResponses = [
  "See you later! Have a great day!",
  "Bye! Don't hesitate to reach out if you need anything.",
  "Take care! Catch you later!",
  "Goodbye! Have a productive day!",
  "Later! Feel free to ping me anytime."
];

// Truncate text to max length
export function truncateText(text, maxLength = 4000) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Format timestamp to readable string
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Sleep utility
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  parseTimeString,
  getRandomResponse,
  cheerMessages,
  greetingResponses,
  farewellResponses,
  truncateText,
  formatTimestamp,
  sleep
};
