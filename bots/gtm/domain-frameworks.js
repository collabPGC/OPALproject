/**
 * Domain Frameworks - Per-persona completeness checklists for gap detection
 *
 * Each persona has a mental model of what "complete" looks like in their domain.
 * Used by daily digest to identify gaps and suggest missing items.
 */

// Framework definitions for all 14 personas
export const DOMAIN_FRAMEWORKS = {
  // ═══════════════════════════════════════════════════════════════
  // BUSINESS PERSONAS
  // ═══════════════════════════════════════════════════════════════

  strategist: {
    name: 'Strategy Framework',
    personaKey: 'strategist',
    personaName: 'Athena',
    completenessChecklist: [
      { id: 'strat_01', item: 'Target market definition (TAM/SAM/SOM)', category: 'market', importance: 'critical' },
      { id: 'strat_02', item: 'Competitive positioning statement', category: 'positioning', importance: 'critical' },
      { id: 'strat_03', item: 'Key differentiators documented', category: 'positioning', importance: 'high' },
      { id: 'strat_04', item: 'Strategic moat analysis', category: 'competitive', importance: 'high' },
      { id: 'strat_05', item: 'Win/loss analysis process', category: 'competitive', importance: 'medium' },
      { id: 'strat_06', item: 'Wedge market identification', category: 'market', importance: 'critical' },
      { id: 'strat_07', item: 'Expansion strategy post-wedge', category: 'market', importance: 'high' },
      { id: 'strat_08', item: 'Investor narrative document', category: 'fundraising', importance: 'high' },
    ],
    topicPatterns: [
      { pattern: /competitor|competition|vs\.?|versus/i, category: 'competitive' },
      { pattern: /market|tam|sam|som|segment/i, category: 'market' },
      { pattern: /position|differentiat|unique|moat/i, category: 'positioning' },
    ],
  },

  'product-owner': {
    name: 'Product Framework',
    personaKey: 'product-owner',
    personaName: 'Priya',
    completenessChecklist: [
      { id: 'prod_01', item: 'MVP scope document', category: 'scope', importance: 'critical' },
      { id: 'prod_02', item: 'User personas defined', category: 'users', importance: 'critical' },
      { id: 'prod_03', item: 'Feature prioritization (RICE scores)', category: 'roadmap', importance: 'high' },
      { id: 'prod_04', item: 'Beta program design', category: 'launch', importance: 'high' },
      { id: 'prod_05', item: 'Hardware constraints documented (ESP32)', category: 'technical', importance: 'medium' },
      { id: 'prod_06', item: 'Product roadmap (6-month)', category: 'roadmap', importance: 'high' },
      { id: 'prod_07', item: 'Kill criteria for features', category: 'scope', importance: 'medium' },
      { id: 'prod_08', item: 'User feedback loop defined', category: 'users', importance: 'high' },
    ],
    topicPatterns: [
      { pattern: /feature|roadmap|mvp|backlog/i, category: 'roadmap' },
      { pattern: /user|persona|customer/i, category: 'users' },
      { pattern: /scope|requirement|spec/i, category: 'scope' },
    ],
  },

  'growth-lead': {
    name: 'GTM Framework',
    personaKey: 'growth-lead',
    personaName: 'Maya',
    completenessChecklist: [
      { id: 'gtm_01', item: 'Launch channel strategy', category: 'channels', importance: 'critical' },
      { id: 'gtm_02', item: 'Target CAC defined', category: 'metrics', importance: 'critical' },
      { id: 'gtm_03', item: 'Pre-launch audience building plan', category: 'community', importance: 'high' },
      { id: 'gtm_04', item: 'Launch messaging framework', category: 'messaging', importance: 'high' },
      { id: 'gtm_05', item: 'Content calendar', category: 'content', importance: 'medium' },
      { id: 'gtm_06', item: 'Developer community strategy', category: 'community', importance: 'high' },
      { id: 'gtm_07', item: 'Crowdfunding platform decision', category: 'channels', importance: 'high' },
      { id: 'gtm_08', item: 'PR/Media outreach list', category: 'channels', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /launch|campaign|marketing/i, category: 'channels' },
      { pattern: /community|developer|audience/i, category: 'community' },
      { pattern: /cac|conversion|funnel/i, category: 'metrics' },
    ],
  },

  'sales-bd': {
    name: 'Sales Framework',
    personaKey: 'sales-bd',
    personaName: 'Rex',
    completenessChecklist: [
      { id: 'sales_01', item: 'Pipeline tracking system', category: 'process', importance: 'critical' },
      { id: 'sales_02', item: 'Pricing structure document', category: 'pricing', importance: 'critical' },
      { id: 'sales_03', item: 'Key account targets', category: 'targets', importance: 'high' },
      { id: 'sales_04', item: 'Partnership target list', category: 'partnerships', importance: 'high' },
      { id: 'sales_05', item: 'Sales collateral', category: 'materials', importance: 'medium' },
      { id: 'sales_06', item: 'Volume pricing tiers', category: 'pricing', importance: 'high' },
      { id: 'sales_07', item: 'Distribution channel strategy', category: 'channels', importance: 'high' },
      { id: 'sales_08', item: 'OEM partnership criteria', category: 'partnerships', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /pipeline|deal|prospect/i, category: 'process' },
      { pattern: /price|pricing|cost|margin/i, category: 'pricing' },
      { pattern: /partner|oem|distributor/i, category: 'partnerships' },
    ],
  },

  'finance-analyst': {
    name: 'Finance Framework',
    personaKey: 'finance-analyst',
    personaName: 'Kai',
    completenessChecklist: [
      { id: 'fin_01', item: 'Financial model with scenarios', category: 'model', importance: 'critical' },
      { id: 'fin_02', item: 'BOM cost analysis', category: 'costs', importance: 'critical' },
      { id: 'fin_03', item: 'Unit economics calculation', category: 'economics', importance: 'critical' },
      { id: 'fin_04', item: 'Runway projection', category: 'runway', importance: 'high' },
      { id: 'fin_05', item: 'Fundraising materials', category: 'fundraising', importance: 'medium' },
      { id: 'fin_06', item: 'Cash flow forecast', category: 'model', importance: 'high' },
      { id: 'fin_07', item: 'Break-even analysis', category: 'economics', importance: 'high' },
      { id: 'fin_08', item: 'Investor deck financials', category: 'fundraising', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /runway|burn|cash/i, category: 'runway' },
      { pattern: /bom|cost|margin|unit/i, category: 'costs' },
      { pattern: /investor|fundrais|series/i, category: 'fundraising' },
    ],
  },

  'compliance-ops': {
    name: 'Compliance & Ops Framework',
    personaKey: 'compliance-ops',
    personaName: 'Suki',
    completenessChecklist: [
      { id: 'comp_01', item: 'Regulatory certification checklist', category: 'regulatory', importance: 'critical' },
      { id: 'comp_02', item: 'FCC/CE timeline', category: 'certifications', importance: 'critical' },
      { id: 'comp_03', item: 'Supply chain risk register', category: 'supply-chain', importance: 'high' },
      { id: 'comp_04', item: 'Manufacturing partner selection', category: 'manufacturing', importance: 'high' },
      { id: 'comp_05', item: 'Quality control process', category: 'quality', importance: 'medium' },
      { id: 'comp_06', item: 'EVT/DVT/PVT schedule', category: 'manufacturing', importance: 'high' },
      { id: 'comp_07', item: 'Fulfillment/3PL strategy', category: 'operations', importance: 'medium' },
      { id: 'comp_08', item: 'RoHS/REACH compliance', category: 'certifications', importance: 'high' },
    ],
    topicPatterns: [
      { pattern: /fcc|ce mark|ul|certification/i, category: 'certifications' },
      { pattern: /supply chain|manufacturing|factory/i, category: 'manufacturing' },
      { pattern: /quality|testing|qa/i, category: 'quality' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // TECHNICAL PERSONAS
  // ═══════════════════════════════════════════════════════════════

  'software-architect': {
    name: 'Software Architecture Framework',
    personaKey: 'software-architect',
    personaName: 'Marcus',
    completenessChecklist: [
      { id: 'sw_01', item: 'System architecture diagram', category: 'design', importance: 'critical' },
      { id: 'sw_02', item: 'API design specification', category: 'design', importance: 'critical' },
      { id: 'sw_03', item: 'Data model documentation', category: 'design', importance: 'high' },
      { id: 'sw_04', item: 'Firmware update (OTA) strategy', category: 'embedded', importance: 'critical' },
      { id: 'sw_05', item: 'Error handling/recovery design', category: 'reliability', importance: 'high' },
      { id: 'sw_06', item: 'Testing strategy (unit, integration, e2e)', category: 'quality', importance: 'high' },
      { id: 'sw_07', item: 'CI/CD pipeline design', category: 'devops', importance: 'medium' },
      { id: 'sw_08', item: 'Performance requirements spec', category: 'performance', importance: 'high' },
    ],
    topicPatterns: [
      { pattern: /architect|design|system/i, category: 'design' },
      { pattern: /api|endpoint|interface/i, category: 'design' },
      { pattern: /firmware|embedded|ota/i, category: 'embedded' },
    ],
  },

  'enterprise-architect': {
    name: 'Enterprise Architecture (Healthcare) Framework',
    personaKey: 'enterprise-architect',
    personaName: 'Helena',
    completenessChecklist: [
      { id: 'ent_01', item: 'HL7/FHIR integration approach', category: 'standards', importance: 'critical' },
      { id: 'ent_02', item: 'EHR vendor compatibility matrix', category: 'vendors', importance: 'critical' },
      { id: 'ent_03', item: 'Patient data flow diagram', category: 'data-flow', importance: 'critical' },
      { id: 'ent_04', item: 'Epic/Cerner certification roadmap', category: 'vendors', importance: 'high' },
      { id: 'ent_05', item: 'HIE connectivity strategy', category: 'interoperability', importance: 'high' },
      { id: 'ent_06', item: 'Clinical workflow integration design', category: 'workflow', importance: 'high' },
      { id: 'ent_07', item: 'SMART on FHIR app architecture', category: 'standards', importance: 'medium' },
      { id: 'ent_08', item: 'Patient matching/MPI strategy', category: 'data-flow', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /hl7|fhir|ehr|emr/i, category: 'standards' },
      { pattern: /epic|cerner|meditech|allscripts/i, category: 'vendors' },
      { pattern: /interoperability|integration|hie/i, category: 'interoperability' },
    ],
  },

  'security-architect': {
    name: 'Security & Privacy Framework',
    personaKey: 'security-architect',
    personaName: 'Cyrus',
    completenessChecklist: [
      { id: 'sec_01', item: 'HIPAA security risk assessment', category: 'compliance', importance: 'critical' },
      { id: 'sec_02', item: 'Encryption strategy (at-rest, in-transit)', category: 'encryption', importance: 'critical' },
      { id: 'sec_03', item: 'Access control design', category: 'access', importance: 'critical' },
      { id: 'sec_04', item: 'Audit logging specification', category: 'audit', importance: 'high' },
      { id: 'sec_05', item: 'Incident response plan', category: 'incident', importance: 'high' },
      { id: 'sec_06', item: 'Secure boot chain design', category: 'device', importance: 'high' },
      { id: 'sec_07', item: 'Penetration testing plan', category: 'testing', importance: 'medium' },
      { id: 'sec_08', item: 'HITRUST certification roadmap', category: 'compliance', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /hipaa|security|privacy/i, category: 'compliance' },
      { pattern: /encrypt|key|certificate/i, category: 'encryption' },
      { pattern: /access|auth|permission/i, category: 'access' },
    ],
  },

  'cloud-architect': {
    name: 'Cloud Architecture Framework',
    personaKey: 'cloud-architect',
    personaName: 'Nimbus',
    completenessChecklist: [
      { id: 'cloud_01', item: 'Cloud provider selection', category: 'provider', importance: 'critical' },
      { id: 'cloud_02', item: 'HIPAA-eligible service mapping', category: 'compliance', importance: 'critical' },
      { id: 'cloud_03', item: 'Infrastructure architecture diagram', category: 'design', importance: 'critical' },
      { id: 'cloud_04', item: 'Disaster recovery plan', category: 'reliability', importance: 'high' },
      { id: 'cloud_05', item: 'Cost estimation model', category: 'cost', importance: 'high' },
      { id: 'cloud_06', item: 'Edge-to-cloud connectivity design', category: 'edge', importance: 'high' },
      { id: 'cloud_07', item: 'BAA agreements in place', category: 'compliance', importance: 'critical' },
      { id: 'cloud_08', item: 'Auto-scaling strategy', category: 'reliability', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /aws|azure|gcp|cloud/i, category: 'provider' },
      { pattern: /kubernetes|container|serverless/i, category: 'design' },
      { pattern: /cost|spending|budget/i, category: 'cost' },
    ],
  },

  'healthcare-analyst': {
    name: 'Healthcare Industry Framework',
    personaKey: 'healthcare-analyst',
    personaName: 'Vera',
    completenessChecklist: [
      { id: 'hc_01', item: 'Competitive landscape analysis', category: 'competitive', importance: 'critical' },
      { id: 'hc_02', item: 'EHR vendor market share analysis', category: 'market', importance: 'high' },
      { id: 'hc_03', item: 'Key buyer persona profiles', category: 'buyers', importance: 'critical' },
      { id: 'hc_04', item: 'Regulatory trend analysis', category: 'regulatory', importance: 'high' },
      { id: 'hc_05', item: 'Adjacent market opportunities', category: 'market', importance: 'medium' },
      { id: 'hc_06', item: 'Partnership/acquisition targets', category: 'partnerships', importance: 'medium' },
      { id: 'hc_07', item: 'Reimbursement landscape analysis', category: 'market', importance: 'high' },
      { id: 'hc_08', item: 'Digital health funding trends', category: 'market', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /market|industry|sector/i, category: 'market' },
      { pattern: /competitor|incumbent|player/i, category: 'competitive' },
      { pattern: /buyer|cio|cmio|purchaser/i, category: 'buyers' },
    ],
  },

  'clinical-advisor': {
    name: 'Clinical Framework',
    personaKey: 'clinical-advisor',
    personaName: 'Dr. Claire',
    completenessChecklist: [
      { id: 'clin_01', item: 'Clinical use case documentation', category: 'use-cases', importance: 'critical' },
      { id: 'clin_02', item: 'Target clinical user identification', category: 'users', importance: 'critical' },
      { id: 'clin_03', item: 'Clinical workflow integration plan', category: 'workflow', importance: 'critical' },
      { id: 'clin_04', item: 'Clinical validation study design', category: 'evidence', importance: 'high' },
      { id: 'clin_05', item: 'Patient safety risk assessment', category: 'safety', importance: 'critical' },
      { id: 'clin_06', item: 'Clinical evidence requirements', category: 'evidence', importance: 'high' },
      { id: 'clin_07', item: 'Alert fatigue mitigation plan', category: 'workflow', importance: 'high' },
      { id: 'clin_08', item: 'Clinical training materials', category: 'adoption', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /clinical|clinician|physician|nurse/i, category: 'users' },
      { pattern: /workflow|bedside|point of care/i, category: 'workflow' },
      { pattern: /patient|safety|outcome/i, category: 'safety' },
    ],
  },

  'ml-engineer': {
    name: 'ML/AI Framework',
    personaKey: 'ml-engineer',
    personaName: 'Tensor',
    completenessChecklist: [
      { id: 'ml_01', item: 'Model architecture specification', category: 'model', importance: 'critical' },
      { id: 'ml_02', item: 'Training data requirements', category: 'data', importance: 'critical' },
      { id: 'ml_03', item: 'Edge deployment constraints', category: 'deployment', importance: 'critical' },
      { id: 'ml_04', item: 'Model validation methodology', category: 'validation', importance: 'critical' },
      { id: 'ml_05', item: 'Quantization/optimization strategy', category: 'optimization', importance: 'high' },
      { id: 'ml_06', item: 'MLOps pipeline design', category: 'mlops', importance: 'high' },
      { id: 'ml_07', item: 'Bias/fairness assessment plan', category: 'validation', importance: 'high' },
      { id: 'ml_08', item: 'Model update strategy', category: 'mlops', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /model|neural|network|ml|ai/i, category: 'model' },
      { pattern: /training|dataset|label/i, category: 'data' },
      { pattern: /inference|edge|deploy/i, category: 'deployment' },
    ],
  },

  'regulatory-affairs': {
    name: 'Regulatory Affairs Framework',
    personaKey: 'regulatory-affairs',
    personaName: 'Regina',
    completenessChecklist: [
      { id: 'reg_01', item: 'FDA classification determination', category: 'classification', importance: 'critical' },
      { id: 'reg_02', item: 'Regulatory pathway selection (510k/De Novo)', category: 'pathway', importance: 'critical' },
      { id: 'reg_03', item: 'Predicate device identification', category: 'pathway', importance: 'high' },
      { id: 'reg_04', item: 'Clinical evidence strategy', category: 'evidence', importance: 'high' },
      { id: 'reg_05', item: 'Pre-submission meeting plan', category: 'fda-engagement', importance: 'high' },
      { id: 'reg_06', item: 'QMS documentation', category: 'quality', importance: 'critical' },
      { id: 'reg_07', item: 'AI/ML predetermined change control plan', category: 'ai-specific', importance: 'high' },
      { id: 'reg_08', item: 'International regulatory strategy (CE/MDR)', category: 'international', importance: 'medium' },
    ],
    topicPatterns: [
      { pattern: /fda|510k|de novo|pma/i, category: 'pathway' },
      { pattern: /classification|class i|class ii/i, category: 'classification' },
      { pattern: /qms|quality|21 cfr/i, category: 'quality' },
    ],
  },
};

/**
 * Get framework for a specific persona.
 */
export function getFramework(personaKey) {
  return DOMAIN_FRAMEWORKS[personaKey] || null;
}

/**
 * Get all framework keys.
 */
export function getAllFrameworkKeys() {
  return Object.keys(DOMAIN_FRAMEWORKS);
}

/**
 * Identify gaps for a persona based on what's been discussed.
 * Returns items from the checklist that haven't been addressed.
 *
 * @param {string} personaKey - Persona key
 * @param {Object} companyState - Current company state
 * @param {Object} options - Options like minimum importance
 */
export function identifyGaps(personaKey, companyState = {}, options = {}) {
  const framework = getFramework(personaKey);
  if (!framework) return [];

  const minImportance = options.minImportance || 'medium';
  const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const minLevel = importanceOrder[minImportance] || 2;

  // Get addressed items from company state
  const domainStatus = companyState.domainStatus?.[framework.personaKey] || {};
  const addressedItems = new Set(domainStatus.addressedItems || []);

  // Filter checklist to unaddressed items of sufficient importance
  const gaps = framework.completenessChecklist.filter(item => {
    const itemLevel = importanceOrder[item.importance] || 2;
    return itemLevel <= minLevel && !addressedItems.has(item.id);
  });

  return gaps;
}

/**
 * Get proactive questions a persona might ask based on recent topics.
 *
 * @param {string} personaKey - Persona key
 * @param {string[]} recentTopics - Topics detected in recent conversations
 */
export function getProactiveQuestions(personaKey, recentTopics = []) {
  const framework = getFramework(personaKey);
  if (!framework) return [];

  // Find checklist items related to discussed topics but not yet addressed
  const questions = [];

  for (const item of framework.completenessChecklist) {
    // Check if item's category matches any topic pattern
    for (const pattern of framework.topicPatterns || []) {
      if (pattern.category === item.category) {
        // Check if any recent topic matches this pattern
        const topicMatch = recentTopics.some(topic =>
          pattern.pattern.test(topic)
        );
        if (topicMatch && item.importance !== 'low') {
          questions.push({
            item: item.item,
            category: item.category,
            importance: item.importance,
            question: `Have we addressed: ${item.item}?`,
          });
        }
      }
    }
  }

  // Dedupe and limit
  const seen = new Set();
  return questions.filter(q => {
    if (seen.has(q.item)) return false;
    seen.add(q.item);
    return true;
  }).slice(0, 5);
}

/**
 * Score completeness for a persona's domain.
 *
 * @param {string} personaKey - Persona key
 * @param {Object} companyState - Current company state
 * @returns {number} Score from 0-100
 */
export function scoreCompleteness(personaKey, companyState = {}) {
  const framework = getFramework(personaKey);
  if (!framework) return 0;

  const domainStatus = companyState.domainStatus?.[framework.personaKey] || {};
  const addressedItems = new Set(domainStatus.addressedItems || []);

  // Weight by importance
  const weights = { critical: 3, high: 2, medium: 1, low: 0.5 };
  let totalWeight = 0;
  let addressedWeight = 0;

  for (const item of framework.completenessChecklist) {
    const weight = weights[item.importance] || 1;
    totalWeight += weight;
    if (addressedItems.has(item.id)) {
      addressedWeight += weight;
    }
  }

  if (totalWeight === 0) return 100;
  return Math.round((addressedWeight / totalWeight) * 100);
}

export default {
  DOMAIN_FRAMEWORKS,
  getFramework,
  getAllFrameworkKeys,
  identifyGaps,
  getProactiveQuestions,
  scoreCompleteness,
};
