// Team engagement handlers: icebreaker, celebrate, tutorial, followup, planFollowUp, cheer

import { generateIcebreaker as getIcebreaker, getSparkCheerMessage } from '../utils/responses.js';

export function generateIcebreaker() {
  return getIcebreaker();
}

export async function celebrateWin(channelId, achievement, ctx) {
  const { anthropic, config } = ctx;

  const celebrations = ["\ud83c\udf89", "\ud83c\udf8a", "\ud83c\udf86", "\ud83e\udd73", "\ud83d\udc4f", "\ud83d\ude80"];
  const emoji = celebrations[Math.floor(Math.random() * celebrations.length)];

  const systemPrompt = `You are an enthusiastic team cheerleader. Write a brief, genuine celebration message for a team achievement. Be warm but not over-the-top. Include a follow-up question to encourage more sharing.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Celebrate this achievement: ${achievement}`
      }]
    });
    return `${emoji} ${response.content[0].text}`;
  } catch (error) {
    return `${emoji} That's awesome! Way to go team!`;
  }
}

export async function generateTutorial(topic, ctx) {
  const { anthropic, config, log } = ctx;

  const systemPrompt = `You create concise, practical tutorials. Format with:
1. Brief intro (1-2 sentences)
2. Prerequisites (if any)
3. Step-by-step instructions (numbered)
4. Pro tips (2-3 bullet points)
5. Common pitfalls to avoid

Keep it scannable with headers and bullet points. Be specific and actionable.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create a tutorial for: ${topic}`
      }]
    });
    return `## Tutorial: ${topic}\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Tutorial generation failed', { error: error.message });
    return null;
  }
}

export async function planFollowUp(channelId, topic, ctx) {
  const { anthropic, config, log } = ctx;

  const systemPrompt = `You are a skilled PM facilitator. Given a topic, create a brief follow-up plan.

Generate:
1. **Next Steps** (2-3 concrete actions)
2. **Owner Suggestions** (roles that should own each)
3. **Timeline** (suggested cadence)
4. **Success Criteria** (how we'll know it's done)
5. **Potential Blockers** (what to watch for)

Be concise and actionable. Under 150 words total.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create a follow-up plan for: ${topic}`
      }]
    });

    return `\ud83d\udccb **Follow-Up Plan: ${topic}**\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Follow-up planning failed', { error: error.message });
    return null;
  }
}

export { getSparkCheerMessage };
