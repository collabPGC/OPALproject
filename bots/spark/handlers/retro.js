// Retrospective facilitation handlers

export async function startRetro(channelId, format, ctx) {
  const { postMessage } = ctx;

  const formats = {
    standard: {
      title: "Team Retrospective",
      prompts: [
        "**What went well?** Share wins and successes",
        "**What could be improved?** Identify areas for growth",
        "**Action items:** What will we do differently?"
      ]
    },
    starfish: {
      title: "Starfish Retrospective",
      prompts: [
        "**Keep doing:** What's working well?",
        "**Less of:** What should we reduce?",
        "**More of:** What should we increase?",
        "**Stop doing:** What should we eliminate?",
        "**Start doing:** What new things should we try?"
      ]
    },
    sailboat: {
      title: "Sailboat Retrospective",
      prompts: [
        "**Wind (propelling us forward):** What's helping us move fast?",
        "**Anchor (holding us back):** What's slowing us down?",
        "**Rocks (risks ahead):** What obstacles do we see coming?",
        "**Sun (our goal):** What are we working toward?"
      ]
    }
  };

  const retro = formats[format] || formats.standard;

  const message = `**${retro.title}**

Let's reflect on our recent work:\n\n${retro.prompts.join('\n\n')}

Share your thoughts in the thread!`;

  await postMessage(channelId, message);
}
