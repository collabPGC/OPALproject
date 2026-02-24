// Shared reminder utilities
// Extracted from Spark:1876-1924

import { log } from './logger.js';

/**
 * Parse a human-friendly time string into milliseconds.
 * Supports formats like "30m", "2h", "1d", "30 minutes", "2 hours", "1 day".
 *
 * @param {string} timeStr - Time string to parse
 * @returns {number|null} Duration in milliseconds, or null if unparseable
 */
export function parseTimeString(timeStr) {
  const match = timeStr.match(/(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)/i);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return num * 60 * 1000;
  if (unit.startsWith('h')) return num * 60 * 60 * 1000;
  if (unit.startsWith('d')) return num * 24 * 60 * 60 * 1000;
  return null;
}

/**
 * Create a reminder manager with setReminder and setTeamReminder functions.
 *
 * @param {Function} postMessageFn - Async function(channelId, message) to post messages
 * @returns {object} { setReminder, setTeamReminder }
 */
export function createReminderManager(postMessageFn) {
  const reminders = new Map();

  async function setReminder(channelId, userId, timeStr, message) {
    const delay = parseTimeString(timeStr);
    if (!delay) {
      return "I couldn't understand that time. Try: `!remindme 30m Review standup notes` or `!remindme 2h Check poll results`";
    }

    const reminderId = Date.now().toString();
    const reminderTime = new Date(Date.now() + delay);

    reminders.set(reminderId, { channelId, userId, message, time: reminderTime });

    setTimeout(async () => {
      const reminder = reminders.get(reminderId);
      if (reminder) {
        await postMessageFn(reminder.channelId, `\u23F0 **Reminder for <@${reminder.userId}>:**\n\n${reminder.message}`);
        reminders.delete(reminderId);
      }
    }, delay);

    const timeDisplay = reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `\u2705 Got it! I'll remind you at **${timeDisplay}**: "${message}"`;
  }

  async function setTeamReminder(channelId, timeStr, message) {
    const delay = parseTimeString(timeStr);
    if (!delay) return null;

    setTimeout(async () => {
      await postMessageFn(channelId, `\u23F0 **Team Reminder:**\n\n${message}\n\n_This was a scheduled reminder._`);
    }, delay);

    const reminderTime = new Date(Date.now() + delay);
    const timeDisplay = reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `\u2705 Team reminder set for **${timeDisplay}**: "${message}"`;
  }

  return { setReminder, setTeamReminder };
}

export default { parseTimeString, createReminderManager };
