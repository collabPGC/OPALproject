// Standup facilitation handlers

export async function startStandup(channelId, ctx) {
  const { state, postMessage } = ctx;

  state.standupState.set(channelId, {
    active: true,
    startTime: Date.now(),
    participants: [],
    responses: []
  });

  const message = `**Daily Standup Time!**

Please share your update:
1. **Yesterday:** What did you accomplish?
2. **Today:** What are you working on?
3. **Blockers:** Anything blocking your progress?

Just reply in thread and I'll capture your updates!`;

  await postMessage(channelId, message);
}

export async function endStandup(channelId, ctx) {
  const { state, anthropic, config, log } = ctx;

  const standup = state.standupState.get(channelId);
  if (!standup || !standup.active) {
    return "No active standup to end.";
  }

  standup.active = false;

  if (standup.responses.length === 0) {
    return "Standup ended. No updates were shared today.";
  }

  const systemPrompt = `You summarize standup updates concisely. Create a brief summary with:
1. Key accomplishments
2. Today's focus areas
3. Blockers that need attention
4. Action items if any

Keep it short and actionable.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Summarize these standup updates:\n\n${standup.responses.map(r => `**${r.user}:**\n${r.content}`).join('\n\n')}`
      }]
    });

    state.standupState.delete(channelId);
    return `**Standup Summary**\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Standup summary failed', { error: error.message });
    return "Standup ended. (Summary generation failed)";
  }
}
