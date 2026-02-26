/**
 * Agent Producer - Autonomous deliverable production
 *
 * Maps milestones to document types and persona keys. When a milestone
 * approaches its target week and has agents assigned, triggers the
 * document-manager to produce the deliverable autonomously.
 *
 * Milestones with empty agents[] are human-only and skipped.
 * Milestones already produced (deliverables[] non-empty) are skipped.
 */

import programState from './program-state.js';
import documentManager from '../document-manager.js';
import personaRouter from '../persona-router.js';
import * as mm from 'bots-shared/mattermost.js';
import institutionalMemory from 'bots-shared/institutional-memory';
import { buildCoachingPrompt, buildFollowUpMessage, FOUNDER_CONTEXT } from 'bots-shared/proactive-behavior.js';

let logger = () => {};
let opsChannelId = null;

// Agent display name → persona-router key
const AGENT_TO_PERSONA = {
  'Athena': 'strategist',
  'Priya': 'product-owner',
  'Maya': 'growth-lead',
  'Rex': 'sales-bd',
  'Kai': 'finance-analyst',
  'Suki': 'compliance-ops',
  'Marcus': 'software-architect',
  'Helena': 'enterprise-architect',
  'Cyrus': 'security-architect',
  'Nimbus': 'cloud-architect',
  'Vera': 'healthcare-analyst',
  'Dr. Claire': 'clinical-advisor',
  'Tensor': 'ml-engineer',
  'Regina': 'regulatory-affairs',
};

// Milestone ID → document type(s) to produce + custom context
// If no mapping exists, the system generates a free-form analysis using the persona
const MILESTONE_DOC_MAP = {
  '1.1': { docs: ['fda-strategy'], context: 'Focus specifically on CDS exclusion analysis: why OPAL qualifies as Clinical Decision Support software exempt from FDA device regulation under 21st Century Cures Act Section 3060.' },
  '1.2': { docs: ['fda-strategy'], context: 'Create an FDA pathway decision memo analyzing whether OPAL requires 510(k), De Novo, or qualifies for CDS exemption. Include SaMD classification analysis.' },
  '1.3': { docs: ['hipaa-compliance-matrix'], context: 'Draft a HIPAA risk assessment covering all applicable safeguards (administrative, physical, technical) for an AI clinical communication platform handling PHI.' },
  '1.4': { docs: ['baa-template'], context: 'Create a Business Associate Agreement template for OPAL to use with cloud providers, EHR integration partners, and other third parties handling PHI.' },
  '1.6': { docs: ['soc2-checklist'], context: 'Compare SOC 2 platforms (Vanta vs Drata vs Secureframe) for a healthcare AI startup. Include cost, timeline, healthcare-specific controls, and recommendation.' },
  '1.7': { docs: ['soc2-checklist'], context: 'Create a SOC 2 Type I readiness checklist with all Trust Services Criteria controls mapped to OPAL\'s current state and gaps.' },

  '2.1': { docs: ['data-room-index'], context: 'Define the complete data room structure for a pre-Series A healthcare AI startup. List all required documents by category with status tracking.' },
  '2.2': { docs: ['financial-model'], context: 'Simplify and update the financial model with clear unit economics, 3-year projections, burn rate, and runway analysis for seed extension.' },
  '2.3': { docs: ['pitch-deck'], context: 'Create pitch deck v1 for seed extension ($2-3M). Lead with clinical communication problem, Vocera gap, AI-native solution, and regulatory advantage.' },
  '2.4': { docs: ['executive-summary'], context: 'One-page executive summary for investors covering problem, solution, market ($8.14B), team, traction, and ask.' },
  '2.5': { docs: ['data-room-index'], context: 'Audit data room completeness. List all 12+ required documents, their current status, and gaps to fill.' },
  '2.6': { docs: ['accelerator-application'], context: 'Draft accelerator application for healthcare-focused programs (Y Combinator, Rock Health, Techstars Healthcare, MATTER). Emphasize clinical validation plan.' },
  '2.7': { docs: ['investor-faq'], context: 'Prepare investor meeting materials: FAQ with anticipated tough questions and prepared answers covering regulatory, clinical validation, competition, and path to revenue.' },

  '4.1': { docs: ['hospital-scorecard'], context: 'Score and rank 12 target hospitals for OPAL pilot based on: size, Vocera usage, IT infrastructure, innovation budget, geographic proximity, and decision-maker access.' },
  '4.2': { docs: ['channel-strategy'], context: 'Create outreach materials for hospital decision-makers (CNO, CIO, CMIO). Include one-pager, email templates, and value proposition by stakeholder.' },
  '4.5': { docs: ['loi-template'], context: 'Create a Letter of Intent template for hospital pilot partnerships. Include scope, timeline, success metrics, data handling, and mutual obligations.' },
  '4.8': { docs: ['pilot-design'], context: 'Design the pilot program for the selected hospital site. Include unit selection, duration, metrics, training plan, and escalation procedures.' },

  '5.1': { docs: ['advisory-board-charter'], context: 'Identify ideal clinical advisory board composition for a healthcare AI startup. Define roles, expertise needed, compensation structure, and governance.' },
  '5.2': { docs: ['clinical-validation-plan'], context: 'Design Phase 1 validation study: 2-5 nurses, controlled setting, measuring communication efficiency, accuracy, and satisfaction vs current workflow.' },
  '5.4': { docs: ['accuracy-spec'], context: 'Define clinical accuracy benchmarks for AI-powered nurse communication: response accuracy, latency targets, safety thresholds, and testing methodology.' },
  '5.7': { docs: ['bias-testing-methodology'], context: 'Design bias testing framework for clinical AI: demographic fairness, language bias, accent recognition equity, and mitigation strategies.' },

  '6.1': { docs: ['infra-cost-model'], context: 'Compare HIPAA-eligible cloud providers (AWS, Azure, GCP) for healthcare AI workloads. Include BAA availability, healthcare-specific services, cost projections, and recommendation.' },
  '6.2': { docs: ['architecture-doc'], context: 'Design production architecture for OPAL: edge AI on device, cloud inference fallback, EHR integration layer, real-time communication routing, and data pipeline.' },
  '6.3': { docs: ['security-whitepaper'], context: 'Security architecture review covering: encryption (at-rest, in-transit, in-use), access controls, audit logging, PHI handling, incident response, and HIPAA technical safeguards.' },
  '6.4': { docs: ['security-whitepaper'], context: 'Detail encryption design: key management, TLS configuration, database encryption, device-to-cloud encryption, and PHI tokenization strategy.' },

  '7.2': { docs: ['fhir-resource-mapping'], context: 'Map FHIR R4 resources needed for OPAL EHR integration: Patient, Practitioner, Communication, Task, Observation. Include read/write operations and scope requirements.' },
  '7.5': { docs: ['integration-spec'], context: 'Document patient data flow through OPAL system: from EHR query through Redox to device display, including all PHI touchpoints and security controls.' },

  // Mt Sinai Beachhead (Workstream 8) — actionable playbooks, not strategy docs
  '8.1': { docs: [], context: `Research the Mount Sinai Health System innovation ecosystem in depth. Ruth Okyere is an RN at Mt Sinai and is CURRENTLY participating in their Innovation Program. Produce:

1. **Innovation Program Structure** — How does the Mt Sinai innovation program work? What is the application/selection process? What stage is Ruth in? What are the program milestones, demo days, mentorship structure?
2. **Key Stakeholders Map** — Identify specific ROLES (not just "leadership") at Mt Sinai who would need to approve a clinical technology pilot:
   - Chief Nursing Officer (CNO) and their direct reports
   - VP of Clinical Operations / Nursing Operations
   - Director of Nursing Innovation or Nursing Informatics
   - Chief Information Officer (CIO) and Health IT leadership
   - Innovation Program Director/Manager
   - IRB office contacts for clinical validation studies
   - Nurse managers on target units (Med-Surg, ICU, ED)
3. **How to find these people** — Specific guidance: Mt Sinai staff directory, LinkedIn search strategies, internal email patterns, who Ruth can ask at the innovation program
4. **What to say to each role** — Draft a specific outreach message/talking points for each stakeholder type. What do they care about? What language resonates? What are their objections?
5. **Questions to ask** — For each stakeholder: the 3-5 specific questions Ruth should ask, and what good/bad answers look like
6. **Timeline** — Week-by-week plan for Ruth's outreach over the next 30 days

Be extremely specific. Names/titles that are publicly available should be included. This is a PLAYBOOK Ruth can execute starting tomorrow.` },

  '8.2': { docs: [], context: `Create pitch materials specifically tailored for the Mt Sinai Innovation Program context. Ruth is presenting LYNA from INSIDE Mt Sinai as a nurse who lives the communication problem daily. Produce:

1. **Innovation Program Pitch Deck** (outline + key slides content) — 8-10 slides max. Lead with the nurse's daily reality at Mt Sinai specifically. Include:
   - "A day in my life as an RN at Mt Sinai" — Ruth's personal story of communication failures
   - The problem quantified for Mt Sinai specifically (# of nurses, # of pages/day, communication-related safety events)
   - LYNA solution — focus on Phase 1 (policy lookup + voice) since that's what we can demo
   - Why Mt Sinai is the perfect pilot site
   - What we're asking for (pilot on 1-2 units, not a system-wide purchase)
2. **One-Pager** — Single page leave-behind for stakeholder meetings. Problem → Solution → Ask → Contact info.
3. **Innovation Program Application/Update** — If the program requires written updates or presentations, draft the content.
4. **Elevator Pitch Script** — 60-second verbal pitch for Ruth when she runs into people at Mt Sinai (hallway conversations, cafeteria, elevator)

Every piece should emphasize Ruth's insider credibility as a Mt Sinai RN who understands the problem firsthand.` },

  '8.3': { docs: [], context: `Create a specific outreach plan for Ruth to build internal champions at Mt Sinai. She is an RN there — she has insider access. Produce:

1. **Target Champion Profiles** — Who makes the best internal champion for a nursing technology pilot?
   - Nurse managers who are frustrated with current communication (which units have the worst pager/communication problems?)
   - Nursing informaticists who evaluate new clinical technology
   - Innovation-minded CNO/VP Nursing who want to modernize
   - Clinical educators who train nurses on new tools
2. **How Ruth identifies them** — She works there. Where does she find the innovation-friendly nurses?
   - Shared governance / nursing councils
   - Quality improvement committees
   - Nursing informatics team
   - Unit-level nurse managers who complain about Vocera/pagers
3. **Conversation Scripts** — For each champion type, provide:
   - Opening line (casual, colleague-to-colleague, not a sales pitch)
   - Key questions to ask to gauge interest
   - How to transition from "I'm working on this" to "can I show you a demo?"
   - Red flags that this person isn't the right champion
4. **Escalation Path** — Once Ruth has 2-3 interested nurses, how does she escalate to nursing leadership? Draft the email Ruth sends to her nurse manager or director introducing LYNA.
5. **Timeline** — Who to approach first, second, third. One action per day for the next 2 weeks.` },

  '8.4': { docs: [], context: `Create ready-to-use email templates and talking points for every Mt Sinai stakeholder Ruth needs to reach. Produce ACTUAL DRAFTS she can copy-paste or adapt:

1. **Email: Innovation Program Director** — Ruth introducing LYNA, requesting a meeting to discuss pilot potential. Tone: professional but collegial (she's a participant, not cold-emailing).
2. **Email: Nurse Manager** — Ruth reaching out to a nurse manager on a target unit. Tone: nurse-to-nurse, emphasizing shared frustration with communication tools.
3. **Email: CNO/VP Nursing Office** — More formal, requesting 15 minutes to present LYNA. Include the ROI hook (45 min/shift saved, safety event reduction).
4. **Email: CIO/IT Office** — Technical audience. Emphasize local-first architecture (no PHI in cloud), FHIR integration, minimal IT burden for Phase 1 (iPhone app, no infrastructure needed).
5. **Email: IRB Office** — Inquiry about requirements for a quality improvement study vs full IRB review for Phase 1 validation.
6. **Meeting Talking Points** — For each stakeholder, provide:
   - 3 key points to make
   - 3 questions to ask
   - 2 potential objections and how to handle them
   - The specific ASK at the end of the meeting
7. **Follow-up Templates** — Post-meeting thank you + next steps email for each stakeholder type.

All templates should reference Ruth's position as a Mt Sinai RN. This is her unfair advantage — use it.` },

  '8.5': { docs: ['pilot-design'], context: `Draft a formal pilot proposal for Mt Sinai. This is the document Ruth would submit to nursing leadership or the innovation program to request a pilot deployment. Include:

1. **Executive Summary** — One paragraph: what LYNA is, what the pilot would test, expected outcomes
2. **Problem Statement** — Quantified for Mt Sinai: communication failures, time wasted, safety events
3. **Proposed Pilot Design** — Which unit(s), how many nurses, duration (suggest 4-8 weeks), what LYNA features to test (Phase 1: policy lookup + voice communication)
4. **Success Metrics** — Measurable: time saved per shift, nurse satisfaction (pre/post survey), communication accuracy, adoption rate
5. **Resource Requirements** — What Mt Sinai needs to provide (WiFi access, nurse participants, unit manager support). Emphasize MINIMAL burden: iPhone app, no infrastructure changes
6. **Data Handling & Privacy** — How PHI is protected (local-first AI), HIPAA compliance approach, no PHI leaves the facility
7. **Timeline** — Week-by-week pilot plan from setup through analysis
8. **Team** — OPAL team bios with emphasis on Ruth (Mt Sinai RN), Hubert (cloud/AI), Alex (embedded)
9. **Risk Mitigation** — What if it doesn't work? Graceful rollback plan. No disruption to existing workflows.` },

  '8.6': { docs: [], context: `Draft a Letter of Intent (LOI) template specifically for Mt Sinai. This should be a lightweight, non-binding document that signals mutual interest in a pilot partnership. Produce:

1. **LOI Document** — Full draft, ready for review:
   - Parties: OPAL Inc. and Mount Sinai Health System
   - Purpose: Pilot evaluation of LYNA clinical communication platform
   - Scope: 1-2 nursing units, 4-8 week pilot
   - Non-binding: No financial commitment, no procurement obligation
   - What each party provides (OPAL: technology + support; Mt Sinai: access + nurse participants)
   - Data rights: Who owns pilot data, publications, IP
   - Confidentiality: Mutual NDA provisions
   - Timeline: Expected pilot start, evaluation period, decision point
2. **Cover Letter** — Ruth's letter accompanying the LOI submission
3. **Talking Points** — How Ruth presents the LOI to skeptical administrators ("it's just a letter of interest, not a contract")
4. **Objection Handling** — Common objections to signing an LOI and responses:
   - "We don't sign LOIs with early-stage companies"
   - "Our legal team needs to review this"
   - "What about liability?"
   - "We already have Vocera"` },
};

/**
 * Initialize with logger and ops channel.
 */
export function init(log, channelId) {
  logger = log || (() => {});
  opsChannelId = channelId;
}

/**
 * Set the ops channel (called after config resolves).
 */
export function setOpsChannel(channelId) {
  opsChannelId = channelId;
}

/**
 * Check all milestones and produce deliverables for those that are ready.
 * Called by the daily cron in index.js.
 *
 * A milestone is "ready for production" when:
 *   1. It has agents assigned (agents[] is non-empty)
 *   2. It has no deliverables produced yet (deliverables[] is empty)
 *   3. Its status is 'in_progress' (auto-promoted by tracker when within 1 week)
 *   4. Its upstream dependencies are met (or it has none)
 */
export async function runProductionCycle() {
  const workstreams = programState.getAllWorkstreams();
  let produced = 0;

  for (const ws of workstreams) {
    for (const ms of ws.milestones) {
      if (shouldProduce(ms)) {
        try {
          await produceForMilestone(ms, ws);
          produced++;
        } catch (err) {
          logger('error', 'Production failed', { msId: ms.id, error: err.message });
        }
      }
    }
  }

  if (produced > 0) {
    logger('info', `Production cycle complete: ${produced} deliverables produced`);
  }

  return produced;
}

/**
 * Produce deliverable for a specific milestone (on-demand via !atlas produce).
 */
export async function produceForMilestoneById(msId) {
  const ms = programState.getMilestone(msId);
  if (!ms) return { success: false, error: `Milestone ${msId} not found` };

  if (ms.agents.length === 0) {
    return { success: false, error: `Milestone ${msId} is human-only (no agents assigned)` };
  }

  if (ms.deliverables.length > 0) {
    return { success: false, error: `Milestone ${msId} already has deliverables: ${ms.deliverables.join(', ')}` };
  }

  const ws = programState.getWorkstream(ms.wsId);
  const result = await produceForMilestone(ms, ws);
  return result;
}

/**
 * Check if a milestone should have deliverables produced.
 */
function shouldProduce(ms) {
  // Must have agents
  if (!ms.agents || ms.agents.length === 0) return false;

  // Must not already have deliverables
  if (ms.deliverables && ms.deliverables.length > 0) return false;

  // Must be in_progress (tracker auto-promotes when within 1 week)
  if (ms.status !== 'in_progress') return false;

  // Must not be completed or blocked
  if (ms.status === 'completed' || ms.status === 'blocked') return false;

  // Check dependencies are met
  const depCheck = programState.checkUnblocked(ms.id);
  if (!depCheck.unblocked) return false;

  return true;
}

/**
 * Actually produce the deliverable for a milestone.
 */
async function produceForMilestone(ms, ws) {
  const mapping = MILESTONE_DOC_MAP[ms.id];
  const primaryAgent = ms.agents[0];
  const personaKey = AGENT_TO_PERSONA[primaryAgent];

  if (!personaKey) {
    logger('warn', 'No persona mapping for agent', { agent: primaryAgent, msId: ms.id });
    return { success: false, error: `No persona mapping for agent: ${primaryAgent}` };
  }

  logger('info', 'Producing deliverable', {
    msId: ms.id,
    title: ms.title,
    agent: primaryAgent,
    persona: personaKey,
  });

  // Announce production start
  if (opsChannelId) {
    await mm.postMessage(opsChannelId,
      `**Atlas** :compass: :factory:\n\n` +
      `Initiating autonomous production for **${ms.id}: ${ms.title}**\n` +
      `Agent: **${primaryAgent}** | Owner: ${ms.owner} | WS${ws.id}: ${ws.name}`
    );
  }

  const deliverableIds = [];

  if (mapping && mapping.docs.length > 0) {
    // Produce formal documents via document-manager
    for (const docType of mapping.docs) {
      const result = await documentManager.createDocument(
        docType,
        `${ms.title} — ${ms.id}`,
        buildProductionContext(ms, ws, mapping.context),
        `atlas:${personaKey}`
      );

      if (result.success) {
        deliverableIds.push(result.doc.id);
        await announceDeliverable(ms, ws, result);
      } else {
        logger('error', 'Document creation failed', { msId: ms.id, docType, error: result.error });
      }
    }
  } else {
    // No document mapping — produce free-form analysis via persona
    const result = await produceFreeFormAnalysis(ms, ws, personaKey);
    if (result.success) {
      deliverableIds.push(result.id);
    }
  }

  // Update milestone with deliverable references
  if (deliverableIds.length > 0) {
    programState.updateMilestone(ms.id, {
      deliverables: deliverableIds,
      notes: `Agent-produced ${new Date().toISOString().slice(0, 10)}: ${deliverableIds.join(', ')}`,
    });

    // Emit to institutional memory
    try {
      await institutionalMemory.emit({
        agent: 'atlas',
        type: 'MILESTONE',
        domain: ws.domains?.[0] || 'operations',
        title: `Deliverable produced: ${ms.id} ${ms.title}`,
        content: `Atlas autonomously produced deliverables for milestone ${ms.id} (${ms.title}). ` +
                 `Documents: ${deliverableIds.join(', ')}. Agent: ${primaryAgent}. ` +
                 `Owner ${ms.owner} should review and approve.`,
        tags: ['atlas', 'agent-production', `ws${ws.id}`, ms.id],
      });
    } catch (err) {
      logger('error', 'Failed to emit production event', { error: err.message });
    }

    return { success: true, deliverables: deliverableIds };
  }

  return { success: false, error: 'No deliverables produced' };
}

/**
 * Build context string for document production.
 */
function buildProductionContext(ms, ws, customContext) {
  const parts = [
    `**Gap Closure Program — Workstream ${ws.id}: ${ws.name}**`,
    `**Milestone:** ${ms.id} — ${ms.title}`,
    `**Target Week:** ${ms.week} | **Owner:** ${ms.owner}`,
    `**Tier:** ${ws.tier}`,
  ];

  if (ms.agents.length > 1) {
    parts.push(`**Collaborating agents:** ${ms.agents.join(', ')}`);
  }

  if (customContext) {
    parts.push('', customContext);
  }

  const agentCmd = AGENT_TO_PERSONA[ms.agents[0]] ? ms.agents[0].toLowerCase().replace('dr. ', '') : 'rex';

  parts.push('', `This deliverable is part of OPAL's gap closure program. The owner is **${ms.owner}**.

${FOUNDER_CONTEXT}

## YOUR ROLE: Wise Guide & Coach
You are not just producing a document — you are **guiding ${ms.owner} through this step**. Remember: ${ms.owner} is likely doing this for the first time. Structure your output as:

### 1. The Deliverable
The actual content (research, templates, plans, drafts — whatever this milestone requires). Make it thorough and specific.

### 2. ⚡ Your One Move, ${ms.owner}
After the deliverable, add a section that:
- Names the SINGLE most important action for ${ms.owner} to take TODAY (not this week — today)
- Breaks it into 2-3 sub-steps so small they feel obvious (e.g., "Step 1: open this doc. Step 2: read just Section 2. Step 3: circle the names you recognize. Done — 10 minutes.")
- Acknowledges this is new territory: "If you've never emailed a CNO before, that's totally normal — here's exactly what to write"
- Estimates time: "This takes ~15 minutes"
- Flags placeholders only ${ms.owner} can fill in, with specific guidance on HOW to fill them (not just "[INSERT NAME]" but "Ask your innovation program mentor who runs nursing informatics")

### 3. 🤝 Let's Do This Together
End with a specific, low-friction offer — NOT a menu of options:
- "Want to draft that email together right now? Just tell me who you're sending it to and what you want to say — I'll shape it for you: \`@gtm-team !${agentCmd}\`"
- "After you send it, come back and tell me what happened — I'll adjust the plan based on what you learned"
- "Feeling unsure about this? That's completely normal — every founder feels this way the first time. Just say \`@gtm-team !${agentCmd} walk me through it\` and we'll do it together, step by step"

Be a **mentor**, not a report generator. ${ms.owner} is smart but doing this for the first time — make the path obvious, the first step tiny, and the offer to help immediate.`);

  return parts.join('\n');
}

/**
 * Produce a free-form analysis when no document type mapping exists.
 * Used for milestones like "Voice pipeline working" or "First hospital conversations"
 * where the agent provides analysis/recommendations rather than a formal document.
 */
async function produceFreeFormAnalysis(ms, ws, personaKey) {
  const { default: llm } = await import('bots-shared/llm.js');
  const systemPrompt = personaRouter.buildSystemPrompt(personaKey);

  const prompt = buildProductionContext(ms, ws,
    `As ${ms.agents[0]}, produce a comprehensive analysis and action plan for this milestone. ` +
    `Include: current state assessment, specific steps needed, risks, dependencies, and success criteria. ` +
    `Remember: you are coaching ${ms.owner} through this — not just producing a report for them to read.`
  );

  try {
    const result = await llm.general(
      [{ role: 'user', content: prompt }],
      {
        system: systemPrompt + '\n\nYou are a wise guide coaching a startup team through execution. Produce the deliverable, then tell the owner exactly what THEY need to do next (with specific steps, tips, and time estimates). Offer to work through it interactively — remind them they can ping you by name for help.',
        max_tokens: 3000,
      }
    );

    const id = `analysis_${ms.id}_${Date.now()}`;
    const content = result.text || '';

    // Post to ops channel
    if (opsChannelId && content) {
      const header = `**Atlas** :compass: :page_facing_up:\n\n` +
        `**Agent Analysis: ${ms.id} — ${ms.title}**\n` +
        `*Produced by ${ms.agents[0]} for ${ms.owner}*\n\n---\n\n`;

      // Truncate for Mattermost (16k char limit)
      const postContent = header + content.slice(0, 14000);
      await mm.postMessage(opsChannelId, postContent);
    }

    return { success: true, id };
  } catch (err) {
    logger('error', 'Free-form analysis failed', { msId: ms.id, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Announce a produced document to the ops channel.
 */
async function announceDeliverable(ms, ws, docResult) {
  if (!opsChannelId) return;

  const agentCmd = AGENT_TO_PERSONA[ms.agents[0]]
    ? `!${ms.agents[0].toLowerCase().replace('dr. ', '')}`
    : '!rex';

  const lines = [
    `**Atlas** :compass: :white_check_mark:`,
    '',
    `**Deliverable ready: ${ms.id} — ${ms.title}**`,
    `Document: **${docResult.doc.typeName}** (\`${docResult.doc.id}\`)`,
    `Prepared by: **${ms.agents[0]}** for **${ms.owner}**`,
    '',
    `---`,
    `**${ms.owner}** — the deliverable above is your starting point, not a finished product. Here's what to do:`,
    '',
    `1. **Read through it** (~10 min) — Look for anything that doesn't match your on-the-ground reality`,
    `2. **Fill in the blanks** — Anywhere you see a generic title or placeholder, swap in the real name/contact you know`,
    `3. **Flag what's wrong** — Tell ${ms.agents[0]} what needs fixing: \`@gtm-team ${agentCmd} In section X, the assumption about Y is wrong because...\``,
    `4. **Start executing** — Pick the first action item and do it today. Come back and tell us how it went.`,
    '',
    `:point_right: **Need a walkthrough?** Say \`@gtm-team ${agentCmd} walk me through this step by step\` and I'll guide you through it live.`,
    `:point_right: **Stuck or unsure?** Say \`@gtm-team ${agentCmd} I tried X and it didn't work\` and I'll adjust the plan.`,
    `:point_right: **Done with this milestone?** \`!atlas milestone ${ms.id} done\` — this unlocks the next steps automatically.`,
  ];

  if (docResult.pdfPath) {
    lines.push('', `PDF: \`${docResult.pdfPath}\``);
  }

  await mm.postMessage(opsChannelId, lines.join('\n'));
}

/**
 * Get production status for all milestones.
 */
export function getProductionStatus() {
  const workstreams = programState.getAllWorkstreams();
  const status = {
    agentReady: [],    // Has agents, in_progress, no deliverables
    produced: [],      // Has deliverables
    humanOnly: [],     // No agents assigned
    pending: [],       // Has agents but not yet in_progress
  };

  for (const ws of workstreams) {
    for (const ms of ws.milestones) {
      if (ms.status === 'completed') continue;

      const entry = { id: ms.id, title: ms.title, wsId: ws.id, agents: ms.agents, owner: ms.owner };

      if (!ms.agents || ms.agents.length === 0) {
        status.humanOnly.push(entry);
      } else if (ms.deliverables && ms.deliverables.length > 0) {
        status.produced.push({ ...entry, deliverables: ms.deliverables });
      } else if (shouldProduce(ms)) {
        status.agentReady.push(entry);
      } else {
        status.pending.push(entry);
      }
    }
  }

  return status;
}

/**
 * Coaching follow-up: check on milestones that were produced but not yet
 * marked done. Nudge the owner with helpful context.
 * Called by the 4-hour escalation cron or a dedicated coaching cron.
 */
export async function runCoachingFollowUps() {
  const workstreams = programState.getAllWorkstreams();
  let nudges = 0;

  for (const ws of workstreams) {
    for (const ms of ws.milestones) {
      if (!ms.deliverables || ms.deliverables.length === 0) continue;
      if (ms.status === 'completed') continue;

      // Check if produced more than 2 days ago and still not done
      const producedMatch = ms.notes?.match(/Agent-produced (\d{4}-\d{2}-\d{2})/);
      if (!producedMatch) continue;

      const producedDate = new Date(producedMatch[1]);
      const daysSince = (Date.now() - producedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 2) continue; // Give them 2 days before nudging

      const agentCmd = AGENT_TO_PERSONA[ms.agents?.[0]]
        ? `!${ms.agents[0].toLowerCase().replace('dr. ', '')}`
        : '!rex';

      if (opsChannelId) {
        const message = buildFollowUpMessage({
          ownerName: ms.owner,
          agentName: ms.agents?.[0] || 'Atlas',
          agentCommand: agentCmd,
          taskTitle: `${ms.id}: ${ms.title}`,
          daysSince: Math.floor(daysSince),
          completionCommand: `!atlas milestone ${ms.id} done`,
        });
        await mm.postMessage(opsChannelId, message);
        nudges++;
      }
    }
  }

  return nudges;
}

export default {
  init,
  setOpsChannel,
  runProductionCycle,
  runCoachingFollowUps,
  produceForMilestoneById,
  getProductionStatus,
};
