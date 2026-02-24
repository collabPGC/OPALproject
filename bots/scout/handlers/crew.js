// Scout crew orchestration - multi-agent pipeline commands
// Dispatches to shared crew module for research, brainstorm, dialectic, analysis

export async function handleCrewCommand(cmd, post, ctx) {
  const {
    state, log, postMessage, postWithSplitting,
    emitToInstitutionalMemory, semanticMemory, fetchChannelHistory, crew
  } = ctx;

  const channelId = post.channel_id;
  const replyTo = post.root_id || post.id;

  // Parse sub-command and topic from args
  // cmd.args[0] could be "research some topic" or just "help"
  const argsStr = (cmd.args[0] || 'help').trim();
  const firstSpace = argsStr.indexOf(' ');
  const crewSubCmd = firstSpace > -1 ? argsStr.substring(0, firstSpace).toLowerCase() : argsStr.toLowerCase();
  const crewTopic = firstSpace > -1 ? argsStr.substring(firstSpace + 1) : 'general analysis';

  // Get channel context for crew
  const crewHistory = await fetchChannelHistory(channelId, 30);
  const crewChannelContext = crewHistory
    .filter(m => m.content && m.content.trim())
    .map(m => `[${m.username}]: ${m.content}`)
    .join('\n');

  // Get semantic memory context
  let crewSemanticContext = '';
  try {
    const memCtx = await semanticMemory.getContext(crewTopic, { maxDocs: 15, maxConvs: 10 });
    if (memCtx) crewSemanticContext = memCtx;
  } catch (e) {
    log('warn', 'Crew semantic memory failed', { error: e.message });
  }

  const crewFullContext = crewSemanticContext
    ? `${crewSemanticContext}\n\n## Recent Discussion\n${crewChannelContext}`
    : crewChannelContext;

  let response = null;

  switch (crewSubCmd) {
    case 'research':
      await postMessage(channelId, `\u{1F52C} **Crew Research Pipeline**: ${crewTopic}\n\nDeploying multi-agent research crew (4 stages)...`, replyTo);
      try {
        const researchResult = await crew.runPipeline('research', crewTopic, crewFullContext, {
          log: (msg) => log('info', `Crew: ${msg}`)
        });
        const researchOutput = `## \u{1F52C} Crew Research: ${crewTopic}\n\n${researchResult.finalOutput}`;
        await postWithSplitting(channelId, researchOutput, replyTo, 'crew-research');
        emitToInstitutionalMemory('crew-research', crewTopic, researchOutput, channelId, post.id);
      } catch (err) {
        log('error', 'Crew research failed', { error: err.message });
        response = `\u274C Crew research failed: ${err.message}`;
      }
      break;

    case 'brainstorm':
      await postMessage(channelId, `\u{1F4A1} **Crew Brainstorm Pipeline**: ${crewTopic}\n\nDeploying creative crew (4 stages)...`, replyTo);
      try {
        const brainstormCrewResult = await crew.runPipeline('brainstorm', crewTopic, crewFullContext, {
          log: (msg) => log('info', `Crew: ${msg}`)
        });
        const brainstormOutput = `## \u{1F4A1} Crew Brainstorm: ${crewTopic}\n\n${brainstormCrewResult.finalOutput}`;
        await postWithSplitting(channelId, brainstormOutput, replyTo, 'crew-brainstorm');
        emitToInstitutionalMemory('crew-brainstorm', crewTopic, brainstormOutput, channelId, post.id);
      } catch (err) {
        log('error', 'Crew brainstorm failed', { error: err.message });
        response = `\u274C Crew brainstorm failed: ${err.message}`;
      }
      break;

    case 'dialectic':
      await postMessage(channelId, `\u2696\uFE0F **Dialectic Debate**: ${crewTopic}\n\nRunning thesis-antithesis-synthesis debate (2 rounds)...`, replyTo);
      try {
        const dialecticResult = await crew.runDialectic(crewTopic, 2, {
          log: (msg) => log('info', `Crew: ${msg}`)
        });
        const dialecticOutput = `## \u2696\uFE0F Dialectic Analysis: ${crewTopic}\n\n### Final Synthesis\n${dialecticResult.finalSynthesis}\n\n### Validation\n${dialecticResult.validation}`;
        await postWithSplitting(channelId, dialecticOutput, replyTo, 'crew-dialectic');
        emitToInstitutionalMemory('crew-dialectic', crewTopic, dialecticOutput, channelId, post.id);
      } catch (err) {
        log('error', 'Crew dialectic failed', { error: err.message });
        response = `\u274C Crew dialectic failed: ${err.message}`;
      }
      break;

    case 'analysis':
      await postMessage(channelId, `\u{1F4CA} **Crew Analysis Pipeline**: ${crewTopic}\n\nDeploying analytical crew (4 stages)...`, replyTo);
      try {
        const analysisResult = await crew.runPipeline('analysis', crewTopic, crewFullContext, {
          log: (msg) => log('info', `Crew: ${msg}`)
        });
        const analysisOutput = `## \u{1F4CA} Crew Analysis: ${crewTopic}\n\n${analysisResult.finalOutput}`;
        await postWithSplitting(channelId, analysisOutput, replyTo, 'crew-analysis');
        emitToInstitutionalMemory('crew-analysis', crewTopic, analysisOutput, channelId, post.id);
      } catch (err) {
        log('error', 'Crew analysis failed', { error: err.message });
        response = `\u274C Crew analysis failed: ${err.message}`;
      }
      break;

    default:
      response = `## \u{1F916} Crew Orchestration Commands

**Multi-agent pipelines** that use specialized AI agents working together:

| Command | Description |
|---------|-------------|
| \`!crew research [topic]\` | 4-stage research pipeline (gather \u2192 analyze \u2192 challenge \u2192 synthesize) |
| \`!crew brainstorm [topic]\` | Creative ideation pipeline (diverge \u2192 evaluate \u2192 structure \u2192 converge) |
| \`!crew dialectic [topic]\` | Thesis-antithesis-synthesis debate (2 rounds) |
| \`!crew analysis [topic]\` | Analytical pipeline with proof gate |

**Example:**
\`!crew research AI adoption in healthcare\`
\`!crew dialectic Should we prioritize mobile over web?\`

Each pipeline runs multiple specialized agents:
\u2022 **Researcher** - Gathers information
\u2022 **Analyst** - Generates hypotheses
\u2022 **Critic** - Challenges assumptions (Proof Gate)
\u2022 **Synthesizer** - Creates actionable recommendations`;
  }

  return response;
}
