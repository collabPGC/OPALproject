/**
 * Document Manager - Creates, revises, and stores GTM document artifacts
 *
 * Produces Markdown source files and PDF outputs.
 * Stores in /mnt/volume_nyc3_01/gtm-documents/
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as llm from 'bots-shared/llm.js';
import personaRouter from './persona-router.js';

const DOCS_ROOT = '/mnt/volume_nyc3_01/gtm-documents';
const DOCS_URL_BASE = 'https://opal.partnergroupconsulting.com/files/gtm-documents';

// Document type definitions
export const DOCUMENT_TYPES = {
  // Investor materials
  'pitch-deck': {
    name: 'Pitch Deck',
    description: 'Investor pitch deck (slide outline)',
    owners: ['strategist', 'finance-analyst'],
    template: 'pitch-deck.md',
  },
  'executive-summary': {
    name: 'Executive Summary',
    description: 'One-page company overview for investors',
    owners: ['strategist'],
    template: 'executive-summary.md',
  },
  'financial-model': {
    name: 'Financial Model',
    description: 'Revenue projections, unit economics, runway',
    owners: ['finance-analyst'],
    template: 'financial-model.md',
  },

  // Market analysis
  'tam-analysis': {
    name: 'TAM/SAM/SOM Analysis',
    description: 'Total addressable market sizing',
    owners: ['strategist', 'healthcare-analyst'],
    template: 'tam-analysis.md',
  },
  'competitive-landscape': {
    name: 'Competitive Landscape',
    description: 'Competitor analysis and positioning',
    owners: ['strategist', 'healthcare-analyst'],
    template: 'competitive-landscape.md',
  },
  'vocera-teardown': {
    name: 'Vocera Teardown',
    description: 'Deep analysis of Vocera features, weaknesses, opportunities',
    owners: ['healthcare-analyst', 'strategist'],
    template: 'vocera-teardown.md',
  },

  // Product
  'prd': {
    name: 'Product Requirements Document',
    description: 'Feature specifications and acceptance criteria',
    owners: ['product-owner'],
    template: 'prd.md',
  },
  'mvp-spec': {
    name: 'MVP Specification',
    description: 'Minimum viable product scope definition',
    owners: ['product-owner'],
    template: 'mvp-spec.md',
  },
  'roadmap': {
    name: 'Product Roadmap',
    description: 'Quarterly feature roadmap with priorities',
    owners: ['product-owner', 'strategist'],
    template: 'roadmap.md',
  },

  // GTM
  'launch-plan': {
    name: 'Launch Plan',
    description: 'Go-to-market launch strategy and timeline',
    owners: ['growth-lead', 'sales-bd'],
    template: 'launch-plan.md',
  },
  'pricing-model': {
    name: 'Pricing Model',
    description: 'Pricing strategy, tiers, and rationale',
    owners: ['growth-lead', 'finance-analyst'],
    template: 'pricing-model.md',
  },
  'channel-strategy': {
    name: 'Channel Strategy',
    description: 'Sales channels, partnerships, distribution',
    owners: ['sales-bd', 'growth-lead'],
    template: 'channel-strategy.md',
  },

  // Clinical
  'clinical-validation-plan': {
    name: 'Clinical Validation Plan',
    description: 'Plan for validating clinical claims and outcomes',
    owners: ['clinical-advisor', 'regulatory-affairs'],
    template: 'clinical-validation-plan.md',
  },
  'pilot-design': {
    name: 'Pilot Program Design',
    description: 'Hospital pilot structure, metrics, timeline',
    owners: ['clinical-advisor', 'sales-bd'],
    template: 'pilot-design.md',
  },
  'workflow-analysis': {
    name: 'Clinical Workflow Analysis',
    description: 'Current state clinical workflows and OPAL integration points',
    owners: ['clinical-advisor', 'enterprise-architect'],
    template: 'workflow-analysis.md',
  },

  // Technical
  'architecture-doc': {
    name: 'Technical Architecture',
    description: 'System architecture, components, data flows',
    owners: ['software-architect', 'cloud-architect'],
    template: 'architecture-doc.md',
  },
  'integration-spec': {
    name: 'EHR Integration Specification',
    description: 'HL7/FHIR integration approach and requirements',
    owners: ['enterprise-architect'],
    template: 'integration-spec.md',
  },
  'security-whitepaper': {
    name: 'Security Whitepaper',
    description: 'Security architecture, HIPAA compliance, controls',
    owners: ['security-architect'],
    template: 'security-whitepaper.md',
  },

  // Regulatory
  'fda-strategy': {
    name: 'FDA Regulatory Strategy',
    description: 'FDA pathway, SaMD classification, submission plan',
    owners: ['regulatory-affairs'],
    template: 'fda-strategy.md',
  },
  'hipaa-compliance-matrix': {
    name: 'HIPAA Compliance Matrix',
    description: 'HIPAA requirements mapping and compliance status',
    owners: ['security-architect', 'compliance-ops'],
    template: 'hipaa-compliance-matrix.md',
  },
};

// State tracking
const state = {
  documentsInProgress: new Map(), // docId -> {type, title, status, createdBy, assignedTo, createdAt, updatedAt}
  channelId: null,
};

let logger = () => {};

/**
 * Initialize document manager.
 */
export function init(config, log) {
  logger = log || (() => {});
  state.channelId = config?.documentsChannelId || null;

  // Ensure directories exist
  for (const dir of ['drafts', 'active', 'archive', 'templates']) {
    const dirPath = path.join(DOCS_ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  logger('info', 'Document manager initialized', { root: DOCS_ROOT });
}

/**
 * List available document types.
 */
export function listDocumentTypes() {
  const types = [];
  for (const [key, def] of Object.entries(DOCUMENT_TYPES)) {
    const ownerNames = def.owners.map(o => {
      const p = personaRouter.getPersona(o);
      return p?.name || o;
    }).join(', ');
    types.push({
      key,
      name: def.name,
      description: def.description,
      owners: ownerNames,
    });
  }
  return types;
}

/**
 * Get documents in progress.
 */
export function getDocumentsInProgress() {
  return Array.from(state.documentsInProgress.values());
}

/**
 * Start creating a new document.
 */
export async function createDocument(type, title, context, requestedBy) {
  const typeDef = DOCUMENT_TYPES[type];
  if (!typeDef) {
    return { success: false, error: `Unknown document type: ${type}` };
  }

  const docId = `doc_${randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);

  // Create document record
  const doc = {
    id: docId,
    type,
    typeName: typeDef.name,
    title: title || typeDef.name,
    status: 'drafting',
    createdBy: requestedBy,
    assignedTo: typeDef.owners,
    createdAt: timestamp,
    updatedAt: timestamp,
    versions: [],
  };

  state.documentsInProgress.set(docId, doc);

  // Generate initial draft using LLM
  const primaryOwner = typeDef.owners[0];
  const persona = personaRouter.getPersona(primaryOwner);
  const systemPrompt = personaRouter.buildSystemPrompt(primaryOwner);

  try {
    const result = await llm.general(
      [{ role: 'user', content: buildDocumentPrompt(type, title, context) }],
      {
        system: systemPrompt + `\n\nYou are creating a formal document. Output in clean Markdown format suitable for conversion to PDF. Be thorough and professional.`,
        max_tokens: 4000,
      }
    );

    const content = result.text || '';

    // Save draft
    const filename = `${dateStr}_${type}_${docId}`;
    const mdPath = path.join(DOCS_ROOT, 'drafts', `${filename}.md`);

    // Add document header
    const fullContent = `---
title: "${doc.title}"
type: ${type}
id: ${docId}
created: ${timestamp}
created_by: ${requestedBy}
status: draft
---

${content}
`;

    fs.writeFileSync(mdPath, fullContent);

    // Generate PDF
    const pdfPath = await generatePDF(mdPath, path.join(DOCS_ROOT, 'drafts', `${filename}.pdf`));

    // Update document record
    doc.versions.push({
      version: 1,
      mdPath,
      pdfPath,
      createdAt: timestamp,
    });
    doc.currentMdPath = mdPath;
    doc.currentPdfPath = pdfPath;

    logger('info', 'Document created', { docId, type, title });

    return {
      success: true,
      doc,
      mdPath,
      pdfPath,
      content,
    };

  } catch (error) {
    logger('error', 'Failed to create document', { error: error.message });
    doc.status = 'failed';
    return { success: false, error: error.message };
  }
}

/**
 * Revise an existing document.
 */
export async function reviseDocument(docId, feedback, requestedBy) {
  const doc = state.documentsInProgress.get(docId);
  if (!doc) {
    return { success: false, error: `Document not found: ${docId}` };
  }

  if (!doc.currentMdPath || !fs.existsSync(doc.currentMdPath)) {
    return { success: false, error: 'Document file not found' };
  }

  const currentContent = fs.readFileSync(doc.currentMdPath, 'utf8');
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);

  // Generate revision using LLM
  const primaryOwner = DOCUMENT_TYPES[doc.type]?.owners[0] || 'strategist';
  const systemPrompt = personaRouter.buildSystemPrompt(primaryOwner);

  try {
    const result = await llm.general(
      [{
        role: 'user',
        content: `Please revise this document based on the following feedback:\n\n**Feedback:**\n${feedback}\n\n**Current Document:**\n${currentContent}\n\nProvide the complete revised document in Markdown format.`
      }],
      {
        system: systemPrompt + `\n\nYou are revising a formal document. Incorporate the feedback while maintaining professional quality. Output the complete revised document in Markdown.`,
        max_tokens: 4000,
      }
    );

    const revisedContent = result.text || '';
    const version = doc.versions.length + 1;

    // Archive old version
    const oldFilename = path.basename(doc.currentMdPath, '.md');
    const archiveMdPath = path.join(DOCS_ROOT, 'archive', `${oldFilename}_v${version - 1}.md`);
    fs.copyFileSync(doc.currentMdPath, archiveMdPath);
    if (doc.currentPdfPath && fs.existsSync(doc.currentPdfPath)) {
      const archivePdfPath = path.join(DOCS_ROOT, 'archive', `${oldFilename}_v${version - 1}.pdf`);
      fs.copyFileSync(doc.currentPdfPath, archivePdfPath);
    }

    // Save new version
    const filename = `${dateStr}_${doc.type}_${docId}`;
    const mdPath = path.join(DOCS_ROOT, 'drafts', `${filename}.md`);

    // Update header
    const updatedContent = revisedContent.replace(
      /^---\n[\s\S]*?\n---\n/,
      `---
title: "${doc.title}"
type: ${doc.type}
id: ${docId}
created: ${doc.createdAt}
updated: ${timestamp}
version: ${version}
status: draft
---

`
    );

    fs.writeFileSync(mdPath, updatedContent.startsWith('---') ? updatedContent : `---
title: "${doc.title}"
type: ${doc.type}
id: ${docId}
created: ${doc.createdAt}
updated: ${timestamp}
version: ${version}
status: draft
---

${revisedContent}`);

    // Generate PDF
    const pdfPath = await generatePDF(mdPath, path.join(DOCS_ROOT, 'drafts', `${filename}.pdf`));

    // Update document record
    doc.versions.push({
      version,
      mdPath,
      pdfPath,
      createdAt: timestamp,
      feedback,
    });
    doc.currentMdPath = mdPath;
    doc.currentPdfPath = pdfPath;
    doc.updatedAt = timestamp;

    logger('info', 'Document revised', { docId, version });

    return {
      success: true,
      doc,
      mdPath,
      pdfPath,
      version,
    };

  } catch (error) {
    logger('error', 'Failed to revise document', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Finalize a document (move to active).
 */
export function finalizeDocument(docId) {
  const doc = state.documentsInProgress.get(docId);
  if (!doc) {
    return { success: false, error: `Document not found: ${docId}` };
  }

  try {
    // Move to active
    const mdFilename = path.basename(doc.currentMdPath);
    const pdfFilename = path.basename(doc.currentPdfPath);

    const activeMdPath = path.join(DOCS_ROOT, 'active', mdFilename);
    const activePdfPath = path.join(DOCS_ROOT, 'active', pdfFilename);

    fs.copyFileSync(doc.currentMdPath, activeMdPath);
    if (fs.existsSync(doc.currentPdfPath)) {
      fs.copyFileSync(doc.currentPdfPath, activePdfPath);
    }

    // Update status
    doc.status = 'finalized';
    doc.finalizedAt = new Date().toISOString();
    doc.activeMdPath = activeMdPath;
    doc.activePdfPath = activePdfPath;

    // Remove from drafts
    fs.unlinkSync(doc.currentMdPath);
    if (fs.existsSync(doc.currentPdfPath)) {
      fs.unlinkSync(doc.currentPdfPath);
    }

    logger('info', 'Document finalized', { docId });

    return {
      success: true,
      doc,
      mdPath: activeMdPath,
      pdfPath: activePdfPath,
    };

  } catch (error) {
    logger('error', 'Failed to finalize document', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * List all documents (drafts and active).
 */
export function listDocuments() {
  const documents = [];

  // Drafts
  const draftsDir = path.join(DOCS_ROOT, 'drafts');
  if (fs.existsSync(draftsDir)) {
    for (const file of fs.readdirSync(draftsDir)) {
      if (file.endsWith('.md')) {
        documents.push({
          name: file,
          status: 'draft',
          path: path.join(draftsDir, file),
          pdfPath: path.join(draftsDir, file.replace('.md', '.pdf')),
        });
      }
    }
  }

  // Active
  const activeDir = path.join(DOCS_ROOT, 'active');
  if (fs.existsSync(activeDir)) {
    for (const file of fs.readdirSync(activeDir)) {
      if (file.endsWith('.md')) {
        documents.push({
          name: file,
          status: 'active',
          path: path.join(activeDir, file),
          pdfPath: path.join(activeDir, file.replace('.md', '.pdf')),
        });
      }
    }
  }

  return documents;
}

/**
 * Build prompt for document generation.
 */
function buildDocumentPrompt(type, title, context) {
  const typeDef = DOCUMENT_TYPES[type];

  let prompt = `Create a ${typeDef.name}`;
  if (title) {
    prompt += ` titled "${title}"`;
  }
  prompt += `.\n\n**Document Type:** ${typeDef.description}\n\n`;

  if (context) {
    prompt += `**Context/Requirements:**\n${context}\n\n`;
  }

  prompt += `**Company Context:**
- Company: OPAL
- Product: AI-powered clinical communication platform
- Target: Hospital communication (replacing Vocera)
- Market: $8.14B by 2030, 18.1% CAGR
- Stage: Pre-Series A
- Key differentiator: Edge AI + LLM + EMR integration

Please create a comprehensive, professional document in Markdown format.`;

  return prompt;
}

/**
 * Generate PDF from Markdown.
 */
async function generatePDF(mdPath, pdfPath) {
  try {
    execSync(`pandoc "${mdPath}" -o "${pdfPath}" --pdf-engine=pdflatex -V geometry:margin=1in`, {
      timeout: 30000,
    });
    return pdfPath;
  } catch (error) {
    logger('warn', 'PDF generation failed', { error: error.message });
    return null;
  }
}

export default {
  init,
  listDocumentTypes,
  getDocumentsInProgress,
  createDocument,
  reviseDocument,
  finalizeDocument,
  listDocuments,
  DOCUMENT_TYPES,
};
