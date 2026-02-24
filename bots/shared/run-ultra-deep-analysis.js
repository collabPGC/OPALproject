/**
 * Ultra-Deep Analysis Script
 * 
 * Generates a comprehensive 60K+ char / 20+ page analysis using:
 * - Extended thinking (Opus 4.5)
 * - 6 analysis chunks covering multiple strategies and scenarios
 * - McKinsey/HBS framework with detailed options analysis
 */

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import FormData from 'form-data';
import Anthropic from '@anthropic-ai/sdk';

// Configuration
const FILE_ID = 's8b51sogyty99ygceimw5wetoe';
const FILE_NAME = 'LYNA_Master_Financial_Model.xlsx';
const CHANNEL_ID = 'erieukccw3nyfmjgwrgm14gyre';
const MM_TOKEN = '4hx9o1qu73r1mpdxxsxerzdzeo';

// Load config and initialize Anthropic with extended thinking
const config = JSON.parse(fs.readFileSync('./config/models.json', 'utf8'));
const anthropic = new Anthropic({
  apiKey: config.providers.anthropic.apiKey
});

const log = (level, msg, data = {}) => {
  console.log(JSON.stringify({ 
    time: new Date().toISOString(), 
    level, 
    msg, 
    ...data 
  }));
};

// Download file from Mattermost
async function downloadFile(fileId) {
  const response = await fetch(`https://opal.partnergroupconsulting.com/api/v4/files/${fileId}`, {
    headers: { Authorization: `Bearer ${MM_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Parse Excel with full detail
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { 
    type: 'buffer',
    cellFormula: true,
    cellStyles: true,
    cellNF: true,
    cellDates: true
  });
  
  let content = '';
  let totalRows = 0;
  let formulaCount = 0;
  let crossSheetRefs = 0;
  const sheetDetails = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rows = range.e.r - range.s.r + 1;
    const cols = range.e.c - range.s.c + 1;
    totalRows += rows;

    content += `\n\n## Sheet: ${sheetName}\n`;
    content += `**Dimensions:** ${rows} rows × ${cols} columns\n\n`;

    // Extract data with more detail
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    
    // Header row
    if (data.length > 0) {
      content += '**Headers:** ' + data[0].filter(h => h).join(' | ') + '\n\n';
    }
    
    // Data rows (more detail for analysis)
    for (let i = 0; i < Math.min(data.length, 150); i++) {
      const row = data[i];
      if (row.some(cell => cell !== '')) {
        content += row.map(c => String(c).substring(0, 60)).join(' | ') + '\n';
      }
    }
    if (data.length > 150) {
      content += `\n... (${data.length - 150} more rows)\n`;
    }

    // Analyze formulas
    let sheetFormulas = 0;
    let sheetCrossRefs = 0;
    for (const cell in sheet) {
      if (cell[0] !== '!' && sheet[cell].f) {
        sheetFormulas++;
        formulaCount++;
        // Check for cross-sheet references
        if (sheet[cell].f.includes('!')) {
          sheetCrossRefs++;
          crossSheetRefs++;
        }
      }
    }
    
    sheetDetails.push({
      name: sheetName,
      rows,
      cols,
      formulas: sheetFormulas,
      crossRefs: sheetCrossRefs
    });
  }

  return {
    content,
    sheets: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
    sheetDetails,
    totalRows,
    formulaCount,
    crossSheetRefs
  };
}

// Generate analysis chunk with extended thinking
async function generateWithThinking(prompt, systemPrompt, thinkingBudget = 10000) {
  log('info', 'Calling Opus 4.5 with extended thinking', { thinkingBudget });
  
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 16000,
    thinking: {
      type: 'enabled',
      budget_tokens: thinkingBudget
    },
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt
  });

  // Extract text from response (skip thinking blocks)
  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text;
    }
  }
  
  return {
    text,
    thinkingTokens: response.usage?.cache_read_input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0
  };
}

// Post message to Mattermost
async function postMessage(channelId, message, rootId = null) {
  const body = { channel_id: channelId, message };
  if (rootId) body.root_id = rootId;
  
  const resp = await fetch('https://opal.partnergroupconsulting.com/api/v4/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MM_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return resp.json();
}

// Upload file to Mattermost
async function uploadFile(channelId, filePath, filename) {
  const form = new FormData();
  form.append('files', fs.createReadStream(filePath), filename);
  form.append('channel_id', channelId);

  const resp = await fetch('https://opal.partnergroupconsulting.com/api/v4/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MM_TOKEN}`,
      ...form.getHeaders()
    },
    body: form
  });
  return resp.json();
}

// Main analysis function
async function runUltraDeepAnalysis() {
  console.log('\n========================================');
  console.log('  ULTRA-DEEP ANALYSIS: LYNA Financial Model');
  console.log('  Using Extended Thinking (Opus 4.5)');
  console.log('========================================\n');

  // 1. Download and parse
  log('info', 'Step 1: Downloading file...');
  const buffer = await downloadFile(FILE_ID);
  log('info', 'Downloaded', { bytes: buffer.length });

  log('info', 'Step 2: Parsing Excel with full detail...');
  const parsed = parseExcel(buffer);
  log('info', 'Parsed', { 
    sheets: parsed.sheets, 
    rows: parsed.totalRows, 
    formulas: parsed.formulaCount,
    crossRefs: parsed.crossSheetRefs
  });

  // 2. Post status
  log('info', 'Step 3: Posting status update...');
  await postMessage(CHANNEL_ID, 
    `🔬 **ULTRA-DEEP ANALYSIS**: ${FILE_NAME}\n\n` +
    `Generating comprehensive 60K+ character report with:\n` +
    `• Extended Thinking Analysis (Opus 4.5)\n` +
    `• 6 Deep-Dive Sections\n` +
    `• Multiple Strategy Options & Scenarios\n` +
    `• Investment Thesis with Sensitivities\n\n` +
    `_This will take 5-8 minutes for thorough analysis..._`
  );

  const tableFormat = `
TABLE FORMAT: Use proper markdown pipe tables:
| Column A | Column B | Column C |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |

Always include header separator row. Use tables extensively for comparisons.`;

  const chunks = [];

  // ===== CHUNK 1: Executive Summary & Business Model Deep-Dive =====
  log('info', 'Generating Chunk 1/6: Executive Summary & Business Model...');
  const chunk1 = await generateWithThinking(
    `Analyze this financial model spreadsheet and generate a comprehensive executive summary with business model deep-dive.

SPREADSHEET METADATA:
- File: ${FILE_NAME}
- Sheets: ${parsed.sheetNames.join(', ')}
- Total Rows: ${parsed.totalRows}
- Formulas: ${parsed.formulaCount}
- Cross-Sheet References: ${parsed.crossSheetRefs}

FULL SPREADSHEET DATA:
${parsed.content.substring(0, 55000)}

Generate:

# Executive Summary

## Overview
[3-4 paragraphs summarizing the entire financial model, its purpose, and key findings]

## Business Model Canvas
[Use a table to map out the business model components]

| Component | Description |
|-----------|-------------|
| Value Proposition | ... |
| Customer Segments | ... |
| Revenue Streams | ... |
| Key Resources | ... |
| Key Activities | ... |
| Key Partners | ... |
| Cost Structure | ... |

## Key Financial Highlights

| Metric | Value | Analysis |
|--------|-------|----------|
| ... | ... | ... |

## Model Structure Analysis
[How the sheets connect, what each sheet does, formula complexity]

## Critical Assumptions Inventory
[List all key assumptions with their values and sensitivity impact]`,
    
    `You are a senior McKinsey partner and Harvard Business School professor delivering a board-level strategic analysis.

${tableFormat}

ANALYSIS STANDARDS:
- Write 4000+ words for this section
- Include at least 4 detailed tables
- Every claim must reference specific data from the spreadsheet
- Think like a private equity investor evaluating this deal
- Identify what's NOT in the model that should be`,
    12000 // Extended thinking budget
  );
  chunks.push(chunk1.text);
  log('info', 'Chunk 1 complete', { length: chunk1.text.length, tokens: chunk1.outputTokens });

  // ===== CHUNK 2: Revenue Model & Growth Strategy Options =====
  log('info', 'Generating Chunk 2/6: Revenue Model & Growth Options...');
  const chunk2 = await generateWithThinking(
    `Based on the LYNA financial model, analyze the revenue model in depth and present MULTIPLE growth strategy options.

SPREADSHEET DATA (Revenue-focused):
${parsed.content.substring(0, 55000)}

Generate:

---

# Revenue Model Deep-Dive

## Current Revenue Architecture
[Detailed breakdown of all revenue streams, pricing tiers, customer segments]

## Revenue by Segment Analysis

| Segment | Year 1 | Year 2 | Year 3 | CAGR | % of Total |
|---------|--------|--------|--------|------|------------|
| ... | ... | ... | ... | ... | ... |

## Pricing Strategy Evaluation
[Analyze current pricing vs market, elasticity assumptions, upsell potential]

## Unit Economics
| Metric | Value | Benchmark | Gap Analysis |
|--------|-------|-----------|--------------|
| CAC | ... | ... | ... |
| LTV | ... | ... | ... |
| LTV:CAC | ... | ... | ... |
| Payback Period | ... | ... | ... |

---

# Growth Strategy Options

## Option 1: Aggressive Market Expansion
**Risk:** High | **Investment:** $X | **IRR:** X%
[Detailed description, pros/cons, resource requirements]

## Option 2: Product-Led Growth
**Risk:** Medium | **Investment:** $X | **IRR:** X%
[Detailed description, pros/cons, resource requirements]

## Option 3: Strategic Partnerships
**Risk:** Low-Medium | **Investment:** $X | **IRR:** X%
[Detailed description, pros/cons, resource requirements]

## Option 4: Conservative Organic Growth
**Risk:** Low | **Investment:** $X | **IRR:** X%
[Detailed description, pros/cons, resource requirements]

## Strategy Comparison Matrix

| Criteria | Option 1 | Option 2 | Option 3 | Option 4 |
|----------|----------|----------|----------|----------|
| Time to Profitability | ... | ... | ... | ... |
| Capital Required | ... | ... | ... | ... |
| Execution Risk | ... | ... | ... | ... |
| Market Risk | ... | ... | ... | ... |
| Strategic Fit | ... | ... | ... | ... |
| **Recommendation Score** | ... | ... | ... | ... |`,
    
    `You are a growth strategy consultant from BCG presenting to the CEO.

${tableFormat}

REQUIREMENTS:
- Present at least 4 distinct growth strategy options with trade-offs
- Use specific numbers from the spreadsheet to support each option
- Calculate projected outcomes for each strategy
- Provide a clear recommendation with rationale
- Write 4000+ words with extensive tables`,
    10000
  );
  chunks.push('\n\n---\n\n' + chunk2.text);
  log('info', 'Chunk 2 complete', { length: chunk2.text.length, tokens: chunk2.outputTokens });

  // ===== CHUNK 3: Cost Structure & Operational Efficiency =====
  log('info', 'Generating Chunk 3/6: Cost Structure & Operational Analysis...');
  const chunk3 = await generateWithThinking(
    `Analyze the cost structure and operational efficiency from the LYNA financial model.

SPREADSHEET DATA:
${parsed.content.substring(0, 55000)}

Generate:

---

# Cost Structure Analysis

## Fixed vs Variable Cost Breakdown

| Cost Category | Monthly | Annual | Fixed/Variable | % of Revenue |
|---------------|---------|--------|----------------|--------------|
| ... | ... | ... | ... | ... |

## Operating Expense Deep-Dive
[Detailed analysis of each major expense category]

## Burn Rate Analysis

| Scenario | Monthly Burn | Runway (months) | Break-even Date |
|----------|--------------|-----------------|-----------------|
| Current Plan | ... | ... | ... |
| Conservative | ... | ... | ... |
| Aggressive | ... | ... | ... |

## Operational Efficiency Metrics

| Metric | Current | Target | Gap | Improvement Lever |
|--------|---------|--------|-----|-------------------|
| Revenue per Employee | ... | ... | ... | ... |
| Gross Margin | ... | ... | ... | ... |
| Operating Margin | ... | ... | ... | ... |
| R&D as % Revenue | ... | ... | ... | ... |

---

# Cost Optimization Opportunities

## Quick Wins (0-3 months)
[Specific cost savings with $$ impact]

## Medium-Term (3-12 months)
[Process improvements, vendor renegotiation]

## Strategic (12+ months)
[Platform investments, automation, scale economies]

## Total Optimization Potential

| Initiative | Annual Savings | Investment | Payback |
|------------|---------------|------------|---------|
| ... | ... | ... | ... |
| **TOTAL** | ... | ... | ... |`,
    
    `You are a CFO and operations expert analyzing cost structure for a board presentation.

${tableFormat}

REQUIREMENTS:
- Identify every cost line item and categorize it
- Calculate true unit economics
- Identify at least 10 specific cost optimization opportunities
- Quantify potential savings with realistic estimates
- Write 3500+ words`,
    8000
  );
  chunks.push('\n\n---\n\n' + chunk3.text);
  log('info', 'Chunk 3 complete', { length: chunk3.text.length, tokens: chunk3.outputTokens });

  // ===== CHUNK 4: Scenario Analysis & Sensitivity =====
  log('info', 'Generating Chunk 4/6: Scenario Analysis & Sensitivity...');
  const chunk4 = await generateWithThinking(
    `Generate comprehensive scenario analysis and sensitivity modeling for the LYNA financial model.

SPREADSHEET DATA:
${parsed.content.substring(0, 55000)}

Generate:

---

# Scenario Analysis

## Base Case Summary
[Current model assumptions and projections]

## Scenario Definitions

### Scenario A: Bull Case (90th Percentile)
**Assumptions:**
- Market growth: +X%
- Win rate: +X%
- Pricing power: +X%
- Churn: -X%

### Scenario B: Base Case (50th Percentile)
**Assumptions:** [Current model]

### Scenario C: Bear Case (10th Percentile)
**Assumptions:**
- Market growth: -X%
- Win rate: -X%
- Pricing power: -X%
- Churn: +X%

### Scenario D: Stress Test (5th Percentile)
**Assumptions:** [Severe downturn]

## Scenario Comparison

| Metric | Bull | Base | Bear | Stress |
|--------|------|------|------|--------|
| Year 3 Revenue | ... | ... | ... | ... |
| Year 3 EBITDA | ... | ... | ... | ... |
| Total Funding Required | ... | ... | ... | ... |
| Runway (months) | ... | ... | ... | ... |
| IRR | ... | ... | ... | ... |

---

# Sensitivity Analysis

## Single-Variable Sensitivity

| Variable | -20% | -10% | Base | +10% | +20% |
|----------|------|------|------|------|------|
| Price | ... | ... | ... | ... | ... |
| Volume | ... | ... | ... | ... | ... |
| Churn | ... | ... | ... | ... | ... |
| CAC | ... | ... | ... | ... | ... |
| Headcount | ... | ... | ... | ... | ... |

## Tornado Chart (Impact on Year 3 EBITDA)
[Rank variables by impact]

## Monte Carlo Simulation Summary
[Probability distribution of outcomes]

## Key Threshold Analysis
| Question | Threshold Value | Current Value | Buffer |
|----------|-----------------|---------------|--------|
| At what churn rate do we run out of cash? | ... | ... | ... |
| What price increase is needed to break even? | ... | ... | ... |
| How many customers needed for profitability? | ... | ... | ... |`,
    
    `You are a quantitative analyst presenting risk analysis to investors.

${tableFormat}

REQUIREMENTS:
- Model at least 4 distinct scenarios with clear assumptions
- Test sensitivity of at least 5 key variables
- Identify critical thresholds and breaking points
- Quantify probability-weighted outcomes
- Write 3500+ words with comprehensive tables`,
    10000
  );
  chunks.push('\n\n---\n\n' + chunk4.text);
  log('info', 'Chunk 4 complete', { length: chunk4.text.length, tokens: chunk4.outputTokens });

  // ===== CHUNK 5: Investment Thesis & Valuation =====
  log('info', 'Generating Chunk 5/6: Investment Thesis & Valuation...');
  const chunk5 = await generateWithThinking(
    `Develop a comprehensive investment thesis and valuation analysis for LYNA based on the financial model.

SPREADSHEET DATA:
${parsed.content.substring(0, 55000)}

Generate:

---

# Investment Thesis

## The Opportunity
[Market size, timing, why now]

## Competitive Moats
| Moat Type | LYNA's Position | Sustainability | Rating |
|-----------|-----------------|----------------|--------|
| Network Effects | ... | ... | ... |
| Switching Costs | ... | ... | ... |
| Cost Advantages | ... | ... | ... |
| Intangible Assets | ... | ... | ... |
| Efficient Scale | ... | ... | ... |

## Key Investment Highlights
1. [Highlight with supporting data]
2. [Highlight with supporting data]
3. [Highlight with supporting data]
4. [Highlight with supporting data]
5. [Highlight with supporting data]

## Key Investment Risks
| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| ... | ... | ... | ... | ... |

---

# Valuation Analysis

## Comparable Company Analysis

| Company | Revenue | Growth | Gross Margin | EV/Revenue | EV/EBITDA |
|---------|---------|--------|--------------|------------|-----------|
| Comp 1 | ... | ... | ... | ... | ... |
| Comp 2 | ... | ... | ... | ... | ... |
| Comp 3 | ... | ... | ... | ... | ... |
| **Median** | ... | ... | ... | ... | ... |

## DCF Valuation

| Assumption | Value | Rationale |
|------------|-------|-----------|
| WACC | ... | ... |
| Terminal Growth | ... | ... |
| Exit Multiple | ... | ... |

| Year | Revenue | EBITDA | FCF | Discount Factor | PV |
|------|---------|--------|-----|-----------------|-----|
| 1 | ... | ... | ... | ... | ... |
| 2 | ... | ... | ... | ... | ... |
| 3 | ... | ... | ... | ... | ... |
| Terminal | ... | ... | ... | ... | ... |
| **Enterprise Value** | | | | | **$X** |

## Valuation Summary

| Method | Low | Mid | High |
|--------|-----|-----|------|
| Comparables | ... | ... | ... |
| DCF | ... | ... | ... |
| Precedent Transactions | ... | ... | ... |
| **Blended** | **$X** | **$X** | **$X** |

## Investment Returns Analysis

| Entry Valuation | Exit Scenario | MOIC | IRR |
|-----------------|---------------|------|-----|
| ... | ... | ... | ... |`,
    
    `You are a private equity partner presenting an investment committee memo.

${tableFormat}

REQUIREMENTS:
- Build a compelling investment thesis with clear logic
- Use at least 3 valuation methodologies
- Present range of outcomes with probability weighting
- Identify key value creation levers
- Write 4000+ words`,
    10000
  );
  chunks.push('\n\n---\n\n' + chunk5.text);
  log('info', 'Chunk 5 complete', { length: chunk5.text.length, tokens: chunk5.outputTokens });

  // ===== CHUNK 6: Strategic Recommendations & Action Plan =====
  log('info', 'Generating Chunk 6/6: Strategic Recommendations & Action Plan...');
  const chunk6 = await generateWithThinking(
    `Based on all previous analysis of the LYNA financial model, provide comprehensive strategic recommendations and a detailed action plan.

PREVIOUS ANALYSIS SUMMARY:
- Business Model: Healthcare AI patient engagement
- Sheets analyzed: ${parsed.sheetNames.join(', ')}
- Key metrics: ${parsed.totalRows} rows, ${parsed.formulaCount} formulas

SPREADSHEET DATA:
${parsed.content.substring(0, 40000)}

Generate:

---

# Strategic Recommendations

## Priority 1: Immediate Actions (0-30 days)
| Action | Owner | Resources | Expected Outcome | Risk if Delayed |
|--------|-------|-----------|------------------|-----------------|
| ... | ... | ... | ... | ... |

## Priority 2: Short-Term Initiatives (30-90 days)
| Initiative | Investment | ROI | Timeline | Dependencies |
|------------|------------|-----|----------|--------------|
| ... | ... | ... | ... | ... |

## Priority 3: Medium-Term Strategies (90-365 days)
[Detailed strategic initiatives with milestones]

## Priority 4: Long-Term Vision (1-3 years)
[Strategic positioning and market expansion]

---

# Execution Roadmap

## Q1 Milestones
| Week | Milestone | KPI Target | Resources |
|------|-----------|------------|-----------|
| 1-2 | ... | ... | ... |
| 3-4 | ... | ... | ... |
| 5-8 | ... | ... | ... |
| 9-12 | ... | ... | ... |

## Key Performance Indicators

| KPI | Current | Q1 Target | Q2 Target | Q3 Target | Q4 Target |
|-----|---------|-----------|-----------|-----------|-----------|
| MRR | ... | ... | ... | ... | ... |
| Customers | ... | ... | ... | ... | ... |
| Churn | ... | ... | ... | ... | ... |
| NPS | ... | ... | ... | ... | ... |
| Burn Rate | ... | ... | ... | ... | ... |

---

# Risk Mitigation Framework

| Risk | Trigger | Response | Contingency Budget |
|------|---------|----------|-------------------|
| ... | ... | ... | ... |

---

# Board Presentation Summary

## Key Takeaways
1. [Major finding]
2. [Major finding]
3. [Major finding]

## Investment Ask
[What resources/decisions are needed]

## Success Metrics
[How we measure success]

---

*Analysis completed using McKinsey 7S Framework, Porter's Five Forces, and HBS Financial Analysis Standards.*

*Generated with Extended Thinking (Claude Opus 4.5)*`,
    
    `You are presenting final recommendations to the board of directors.

${tableFormat}

REQUIREMENTS:
- Provide actionable, specific recommendations (not generic advice)
- Include detailed timelines and milestones
- Assign ownership and resources
- Create a clear decision framework
- Write 4000+ words
- End with a compelling call to action`,
    10000
  );
  chunks.push('\n\n---\n\n' + chunk6.text);
  log('info', 'Chunk 6 complete', { length: chunk6.text.length, tokens: chunk6.outputTokens });

  // Combine all chunks
  const fullAnalysis = chunks.join('');
  log('info', 'Full analysis complete', { totalLength: fullAnalysis.length });

  // 3. Generate PDF
  log('info', 'Generating PDF...');
  const { publishPDF } = await import('./publish-pdf.js');
  
  const pdfFileName = `LYNA_UltraDeep_Analysis_${Date.now()}.pdf`;
  const pdfPath = `/tmp/${pdfFileName}`;
  
  await publishPDF(
    `Ultra-Deep Financial Analysis: ${FILE_NAME}`,
    fullAnalysis,
    pdfPath,
    { style: 'professional' }
  );
  
  const pdfStats = fs.statSync(pdfPath);
  log('info', 'PDF generated', { 
    size: `${(pdfStats.size / 1024).toFixed(1)} KB`,
    path: pdfPath
  });

  // 4. Upload PDF
  log('info', 'Uploading PDF...');
  const uploadResult = await uploadFile(CHANNEL_ID, pdfPath, pdfFileName);
  
  if (uploadResult.file_infos && uploadResult.file_infos.length > 0) {
    const fileId = uploadResult.file_infos[0].id;
    
    // 5. Post summary with PDF
    log('info', 'Posting analysis...');
    const summaryPreview = fullAnalysis.substring(0, 3500);
    
    await fetch('https://opal.partnergroupconsulting.com/api/v4/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MM_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel_id: CHANNEL_ID,
        message: `## 🔬 ULTRA-DEEP ANALYSIS COMPLETE: ${FILE_NAME}\n\n` +
          `**Analysis Scope:**\n` +
          `• ${fullAnalysis.length.toLocaleString()} characters\n` +
          `• ${Math.ceil(fullAnalysis.length / 3000)} pages\n` +
          `• 6 deep-dive sections with extended thinking\n` +
          `• Multiple strategy options & scenarios\n\n` +
          `---\n\n${summaryPreview}\n\n` +
          `_...Full ${Math.ceil(fullAnalysis.length / 3000)}-page analysis in attached PDF..._`,
        file_ids: [fileId]
      })
    });

    console.log('\n========================================');
    console.log('  ✅ ULTRA-DEEP ANALYSIS COMPLETE');
    console.log('========================================');
    console.log(`  📊 Total: ${fullAnalysis.length.toLocaleString()} characters`);
    console.log(`  📄 PDF: ${pdfFileName} (${(pdfStats.size / 1024).toFixed(1)} KB)`);
    console.log(`  📝 Pages: ~${Math.ceil(fullAnalysis.length / 3000)}`);
    console.log('========================================\n');
  } else {
    console.error('Upload failed:', uploadResult);
  }

  return fullAnalysis;
}

// Run
runUltraDeepAnalysis().catch(console.error);
