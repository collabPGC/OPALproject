// Scout discussion leadership - start discussions, engage topics, pin messages

// Start a discussion thread
export async function startDiscussion(channelId, topic, ctx) {
  const { anthropic, config, log } = ctx;
  const systemPrompt = `You are a skilled discussion facilitator. Generate an engaging discussion starter for a team channel.

Create:
1. A thought-provoking opening question or statement
2. 2-3 follow-up angles to explore
3. A "devil's advocate" perspective to consider
4. A call-to-action for team members

Make it conversational, not academic. Use varied opening styles.
Keep total response under 200 words.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Start a team discussion about: ${topic}`
      }]
    });

    return `\u{1F4AC} **Let's Discuss: ${topic}**\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Discussion generation failed', { error: error.message });
    return null;
  }
}

// Topic engagement - seed conversations with insights
export async function engageTopic(channelId, topic, context = '', ctx) {
  const { anthropic, config, log } = ctx;
  const systemPrompt = `You are an engaging thought partner. Given a topic being discussed, add value by:

1. Sharing a surprising fact or insight ("Did you know...?")
2. Offering a relevant framework or mental model
3. Asking a penetrating question
4. Connecting to a real-world example

Be concise (under 100 words). Be curious and collaborative, not lecturing.
Vary your opening - don't always start the same way.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Topic: ${topic}\nContext: ${context}\n\nAdd an engaging insight or question.`
      }]
    });

    return response.content[0].text;
  } catch (error) {
    log('error', 'Topic engagement failed', { error: error.message });
    return null;
  }
}

// Pin important messages
export async function pinMessage(postId, ctx) {
  const { mmApi, log } = ctx;
  try {
    await mmApi(`/posts/${postId}/pin`, 'POST');
    return true;
  } catch (error) {
    log('error', 'Failed to pin message', { error: error.message });
    return false;
  }
}
