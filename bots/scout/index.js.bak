import WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import PDFDocument from 'pdfkit';
import * as memory from './memory.js';
import { processUrls, fetchWebPage } from './url_utils.js';
import * as capture from './capture.js';
import * as dashboard from './dashboard.js';
import * as pdfUtils from '../shared/pdf-utils.js';
import * as spreadsheetUtils from '../shared/spreadsheet-utils.js';
import * as crew from '../shared/crew/index.js';
import * as fileIndex from '../shared/file-index.js';
import * as taskQueue from '../shared/task-queue.js';
import semanticMemory from '../shared/memory.js';
import llm from '../shared/llm.js';
import { publishPDF } from '../shared/publish-pdf.js';
import * as ralph from '../shared/ralph-mode.js';
import * as commandRouter from '../shared/command-router.js';
import * as skillLoader from '../shared/skill-loader.js';
import * as personaManager from '../shared/persona-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Initialize Anthropic client (kept for backward compatibility)
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

// LLM router initialized after log function is defined (see initLLMRouter below)

// State management
const state = {
  ws: null,
  botUserId: null,
  channels: new Map(),
  userCache: new Map(),
  conversationHistory: new Map(), // channelId -> messages for summarization
  channelPreferences: new Map(), // channelId -> preferences
  introducedChannels: new Set(), // Track channels where we've shown the hint this session
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 5000
};

// Preferences file path
const prefsFile = path.join(__dirname, 'preferences.json');

// ============ PDF GENERATION ============

// Convert ASCII art tables to proper markdown tables
function convertAsciiTablesToMarkdown(text) {
  // Pattern to detect ASCII box tables (lines starting with + or containing +---+)
  const asciiTablePattern = /(\+[-+]+\+[\s\S]*?\+[-+]+\+)/g;

  return text.replace(asciiTablePattern, (table) => {
    const lines = table.split('\n').filter(l => l.trim());
    const dataRows = [];

    for (const line of lines) {
      // Skip border lines (only + and -)
      if (/^[+\-\s]+$/.test(line)) continue;

      // Extract cell content from | delimited lines
      if (line.includes('|')) {
        const cells = line.split('|')
          .map(c => c.trim())
          .filter(c => c && !/^[+\-]+$/.test(c));
        if (cells.length > 0) {
          dataRows.push(cells);
        }
      }
    }

    if (dataRows.length === 0) return table;

    // Build markdown table
    const mdLines = [];
    const header = dataRows[0];
    mdLines.push('| ' + header.join(' | ') + ' |');
    mdLines.push('| ' + header.map(() => '---').join(' | ') + ' |');

    for (let i = 1; i < dataRows.length; i++) {
      // Pad rows to match header length
      while (dataRows[i].length < header.length) {
        dataRows[i].push('');
      }
      mdLines.push('| ' + dataRows[i].join(' | ') + ' |');
    }

    return '\n' + mdLines.join('\n') + '\n';
  });
}

// Ensure markdown tables have proper format for pandoc
function fixMarkdownTables(text) {
  // Fix tables that don't have proper header separators
  const lines = text.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // If this line is a table row and next line is also a row (not separator)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      result.push(line);

      // If this looks like a header (first table row) and next line isn't a separator
      if (i > 0 && !lines[i - 1]?.trim().startsWith('|') &&
          nextLine.trim().startsWith('|') && !nextLine.includes('---')) {
        // Count columns and add separator
        const cols = (line.match(/\|/g) || []).length - 1;
        if (cols > 0) {
          result.push('|' + ' --- |'.repeat(cols));
        }
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// Preprocess markdown for pandoc/xelatex compatibility
function preprocessMarkdownForPandoc(markdown) {
  // First convert any ASCII tables to markdown format
  let processed = convertAsciiTablesToMarkdown(markdown);

  // Fix malformed markdown tables
  processed = fixMarkdownTables(processed);

  return processed
    // Convert arrows to ASCII representations
    .replace(/[\u2192\u2794\u27A1\u279C]/g, '->')  // Right arrows
    .replace(/[\u2190\u2B05]/g, '<-')  // Left arrows
    .replace(/[\u2194]/g, '<->')  // Bidirectional arrow
    // Normalize unicode quotes and dashes
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')  // Non-breaking space
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Zero-width spaces
    // Remove emojis and special symbols
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    // Escape LaTeX special chars (except in markdown syntax)
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&(?!amp;|lt;|gt;|#)/g, '\\&')
    .replace(/_(?![a-zA-Z0-9])/g, '\\_')
    .replace(/\^(?!\{)/g, '\\^{}')
    .replace(/~/g, '\\textasciitilde{}')
    // Fix # that's not a heading
    .replace(/([^#\n])#([^#\n])/g, '$1\\#$2')
    // Clean up any remaining problematic characters
    .replace(/[^\x00-\x7F\u00C0-\u017F]/g, '');  // Keep only ASCII + common Latin extended
}

// Comprehensive deep analysis using model router with full token capacity
async function generateDeepAnalysis(content, type, log) {
  const chunks = [];

  log('info', 'Starting chunked deep analysis', { type, contentLength: content.length });

  // Table format instruction for all prompts
  const tableFormatInstruction = `

TABLE FORMAT: Use proper markdown pipe tables:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |

Do NOT use ASCII art tables with +---+ borders.`;

  // 1. Executive Summary & Business Overview (16000 tokens - full Opus capacity)
  log('info', 'Generating executive summary and business overview...');
  const overview = await llm.research([
    { role: 'user', content: `Provide an executive summary and comprehensive business model analysis of this ${type}. Include all key metrics, revenue streams, cost structure, value proposition, and competitive positioning:\n\n${content.substring(0, 50000)}` }
  ], {
    system: `You are a McKinsey senior partner writing a comprehensive strategic analysis report for a board of directors.

## WRITING STYLE REQUIREMENTS

1. **Narrative First**: Begin each section with 2-3 paragraphs of strategic narrative explaining the "so what" before presenting any data
2. **Insight-Driven**: Don't just present numbers - explain what they mean, why they matter, and what action they suggest
3. **Executive Language**: Write in clear, confident prose that a C-suite executive would expect
4. **Context & Comparison**: Compare metrics to industry benchmarks, competitors, or historical performance
5. **Strategic Implications**: Every data point should connect to a strategic insight

## STRUCTURE

For each major topic:
- **Opening Narrative** (2-3 paragraphs): Set the strategic context, key insights, and implications
- **Supporting Data**: Use tables only to support your narrative points
- **Analysis & Discussion** (1-2 paragraphs): Interpret the data, identify patterns, discuss implications
- **Key Takeaway**: One sentence capturing the essential insight

${tableFormatInstruction}

Write with the depth and sophistication of a McKinsey partner presenting to a Fortune 500 board.`,
    maxTokens: 16000
  });
  chunks.push(overview.text);
  log('info', 'Executive summary complete', { tokens: overview.usage?.output_tokens || 'unknown' });

  // 2. Financial Deep Dive (16000 tokens)
  log('info', 'Generating financial deep dive...');
  const financial = await llm.research([
    { role: 'user', content: `Provide a comprehensive financial analysis of this ${type}. Extract all financial data and provide deep analytical commentary:\n\n${content.substring(0, 60000)}` }
  ], {
    system: `You are a Goldman Sachs Managing Director writing an equity research report.

## WRITING STYLE REQUIREMENTS

1. **Analytical Commentary**: Every table must be preceded by narrative explaining what it shows and why it matters
2. **Trend Analysis**: Discuss patterns, inflection points, and what's driving the numbers
3. **Comparative Context**: Reference relevant benchmarks, comps, or historical context
4. **Risk & Sensitivity**: Identify key assumptions and their sensitivity
5. **Investment Lens**: Frame everything in terms of value creation and risk

## STRUCTURE FOR EACH FINANCIAL AREA

1. **Context Paragraph**: What are we analyzing and why does it matter?
2. **Key Findings** (narrative): What does the data tell us? 2-3 paragraphs of analysis
3. **Data Table**: Present the supporting numbers
4. **Interpretation**: What does this mean for the business? What questions does it raise?
5. **Implications**: What should stakeholders do with this information?

## TOPICS TO COVER (with narrative depth)
- Revenue Model & Unit Economics: Explain the business model dynamics
- Cost Structure: Analyze fixed vs variable, scale effects, efficiency opportunities
- Profitability Path: Discuss margin trajectory and path to profitability
- Cash Flow & Funding: Runway analysis with scenario commentary
- Key Metrics & KPIs: What to watch and why

${tableFormatInstruction}

Write with the analytical rigor of a Goldman research report - numbers support narrative, not replace it.`,
    maxTokens: 16000
  });
  chunks.push('\n\n---\n\n## Financial Deep Dive\n\n' + financial.text);
  log('info', 'Financial deep dive complete', { tokens: financial.usage?.output_tokens || 'unknown' });

  // 3. Strategic Recommendations & Risk Analysis (16000 tokens)
  log('info', 'Generating strategic recommendations...');
  const strategy = await llm.research([
    { role: 'user', content: `Based on this analysis, provide strategic recommendations with detailed discussion, risk assessment, and scenario analysis:\n\nEXECUTIVE SUMMARY:\n${chunks[0].substring(0, 20000)}\n\nFINANCIAL DATA:\n${chunks[1].substring(0, 20000)}` }
  ], {
    system: `You are a McKinsey senior partner presenting strategic recommendations to the CEO and board.

## WRITING STYLE REQUIREMENTS

1. **Prescriptive Clarity**: Be specific and actionable - no vague generalities
2. **Rationale-First**: Explain WHY before WHAT - the logic behind each recommendation
3. **Trade-off Discussion**: Acknowledge alternatives considered and why this path is preferred
4. **Implementation Reality**: Discuss practical considerations, dependencies, and sequencing
5. **Risk Integration**: Weave risk awareness throughout, not just in a separate section

## STRUCTURE

### Strategic Recommendations (60% of content - mostly narrative)
For each major recommendation:
- **The Recommendation** (1 sentence): Clear, actionable statement
- **Strategic Rationale** (2-3 paragraphs): Why this matters, how it creates value, what happens if we don't
- **Implementation Roadmap** (narrative): Key steps, dependencies, milestones
- **Success Metrics**: How we'll know it's working
- **Risks & Mitigations**: What could go wrong and how to prevent it

### Risk Assessment (with discussion)
- Discuss each major risk category with probability and impact reasoning
- Explain mitigation strategies in depth, not just bullet points

### Scenario Analysis (with narrative)
- Don't just show numbers - explain the logic behind each scenario
- Discuss trigger points and decision gates
- Recommend contingency actions for each scenario

${tableFormatInstruction}

Write as if presenting to a board that expects strategic depth, not just slides with bullet points.`,
    maxTokens: 16000
  });
  chunks.push('\n\n---\n\n## Strategic Recommendations & Risk Analysis\n\n' + strategy.text);
  log('info', 'Strategic recommendations complete', { tokens: strategy.usage?.output_tokens || 'unknown' });

  const fullAnalysis = chunks.join('');
  log('info', 'Deep analysis complete', { totalLength: fullAnalysis.length });

  return fullAnalysis;
}

// Generate PDF using pandoc with xelatex engine for professional quality
async function generateAnalysisPDF(title, analysisText, outputPath) {
  const tmpDir = '/tmp/pandoc-' + Date.now();
  const mdFile = path.join(tmpDir, 'analysis.md');
  const headerFile = path.join(tmpDir, 'header.tex');

  try {
    // Create temp directory
    fs.mkdirSync(tmpDir, { recursive: true });

    // Preprocess markdown for LaTeX compatibility
    const cleanedText = preprocessMarkdownForPandoc(analysisText);

    // Create LaTeX header for styling (using pandoc default template)
    const headerFile = path.join(tmpDir, 'header.tex');
    const latexHeader = `
% Colors
\\usepackage[table]{xcolor}
\\definecolor{primary}{RGB}{26, 54, 93}
\\definecolor{secondary}{RGB}{41, 98, 163}
\\definecolor{accent}{RGB}{59, 130, 246}
\\definecolor{rowalt}{RGB}{245, 248, 255}

% Table styling
\\usepackage{booktabs}
\\renewcommand{\\arraystretch}{1.4}
\\setlength{\\tabcolsep}{8pt}
\\rowcolors{2}{white}{rowalt}

% Section colors
\\usepackage{titlesec}
\\titleformat{\\section}{\\Large\\bfseries\\color{primary}}{\\thesection}{1em}{}
\\titleformat{\\subsection}{\\large\\bfseries\\color{primary}}{\\thesubsection}{1em}{}
\\titleformat{\\subsubsection}{\\normalsize\\bfseries\\color{secondary}}{\\thesubsubsection}{1em}{}

% Header/footer
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\small\\textcolor{primary}{\\textbf{Scout AI Analysis}}}
\\fancyhead[R]{\\small Page \\thepage}
\\renewcommand{\\headrulewidth}{1.5pt}
\\renewcommand{\\headrule}{{\\color{secondary}\\hrule height 1.5pt width\\headwidth}}
\\fancyfoot[C]{\\small\\textcolor{gray}{McKinsey/HBS Analytical Framework}}

% Paragraph spacing
\\setlength{\\parskip}{0.6em}
\\setlength{\\parindent}{0pt}

% Hyperlinks
\\hypersetup{colorlinks=true,linkcolor=secondary,urlcolor=accent}
`;

    // Write header file
    fs.writeFileSync(headerFile, latexHeader, 'utf8');

    // Build markdown with YAML frontmatter
    const safeTitle = title.replace(/"/g, "'");
    const markdownContent = `---
title: "${safeTitle}"
subtitle: "Scout AI Deep Analysis"
date: "${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}"
geometry: margin=1in
fontsize: 11pt
mainfont: DejaVu Sans
toc: true
toc-depth: 3
numbersections: true
---

\\newpage

${cleanedText}

---

*This analysis was generated by Scout AI using McKinsey/HBS analytical frameworks.*
`;

    // Write markdown file
    fs.writeFileSync(mdFile, markdownContent, 'utf8');

    // Run pandoc with header include
    const pandocCmd = `pandoc "${mdFile}" -o "${outputPath}" \\
      --pdf-engine=xelatex \\
      --include-in-header="${headerFile}" \\
      -V colorlinks=true \\
      --columns=100 \\
      2>&1`;

    execSync(pandocCmd, {
      timeout: 180000,
      stdio: 'pipe',
      cwd: tmpDir
    });

    // Verify output exists
    if (fs.existsSync(outputPath)) {
      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log('[PDF] Generated successfully via pandoc/xelatex');
      return outputPath;
    } else {
      throw new Error('PDF not generated');
    }
  } catch (error) {
    // Log the actual error output from xelatex
    console.log('[PDF] Pandoc/xelatex failed:', error.message);
    if (error.stdout) console.log('[PDF] stdout:', error.stdout.toString().slice(-2000));
    if (error.stderr) console.log('[PDF] stderr:', error.stderr.toString().slice(-2000));

    // Cleanup on error
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Fall back to publishPDF module (professional pdfkit wrapper)
    console.log('[PDF] Falling back to publishPDF...');
    return publishPDF(title, analysisText, outputPath);
  }
}

// Professional PDF generation using pdfkit with proper table formatting
async function generatePDFWithPDFKit(title, analysisText, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: { Title: title, Author: 'Scout AI Analysis' },
        bufferPages: true
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Colors
      const colors = {
        primary: '#1a365d',
        secondary: '#2962a3',
        accent: '#3b82f6',
        text: '#334155',
        lightText: '#64748b',
        headerBg: '#2962a3',
        headerText: '#ffffff',
        rowAlt: '#f1f5f9',
        border: '#cbd5e0'
      };

      // Page width
      const pageWidth = 495;
      const leftMargin = 50;

      // Title page
      doc.fontSize(24).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text(title, { align: 'center' });
      doc.moveDown(0.5);

      // Blue accent line
      doc.strokeColor(colors.secondary).lineWidth(3);
      doc.moveTo(leftMargin + 100, doc.y).lineTo(leftMargin + pageWidth - 100, doc.y).stroke();
      doc.moveDown(0.8);

      doc.fontSize(14).font('Helvetica').fillColor(colors.secondary);
      doc.text('Scout AI Deep Analysis', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor(colors.lightText);
      doc.text('McKinsey/HBS Analytical Framework', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1.5);

      // Thin separator
      doc.strokeColor(colors.border).lineWidth(0.5);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
      doc.moveDown(1);

      // Process content
      doc.fillColor(colors.text);
      const lines = analysisText.split('\n');
      let inTable = false;
      let tableRows = [];
      let inList = false;

      const renderTable = () => {
        if (tableRows.length === 0) return;

        const numCols = tableRows[0].length;

        // Calculate optimal column widths based on actual content
        const colWidths = [];
        const padding = 8;

        // Measure each column's content
        for (let c = 0; c < numCols; c++) {
          let maxWidth = 0;
          for (let r = 0; r < tableRows.length; r++) {
            const cell = tableRows[r][c] || '';
            // Estimate width: ~5.5px per character for size 8-9 font
            const estWidth = cell.length * 5.5 + padding * 2;
            maxWidth = Math.max(maxWidth, estWidth);
          }
          // Clamp between min 40 and max 180
          colWidths.push(Math.min(180, Math.max(40, maxWidth)));
        }

        // Scale to fit page width
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        const scale = Math.min(1, (pageWidth - 10) / totalWidth);
        const scaledWidths = colWidths.map(w => Math.floor(w * scale));

        // Adjust to exactly fill page width
        const actualTotal = scaledWidths.reduce((a, b) => a + b, 0);
        const remainder = pageWidth - 10 - actualTotal;
        if (remainder > 0 && scaledWidths.length > 0) {
          // Distribute remainder to widest columns
          const widestIdx = scaledWidths.indexOf(Math.max(...scaledWidths));
          scaledWidths[widestIdx] += remainder;
        }

        // Check if we need page break for table
        const estTableHeight = (tableRows.length + 1) * 20;
        if (doc.y + estTableHeight > 750) {
          doc.addPage();
        }

        // Header row
        const headerY = doc.y;
        const headerHeight = 24;
        doc.rect(leftMargin, headerY, pageWidth, headerHeight).fill(colors.headerBg);
        doc.fillColor(colors.headerText).font('Helvetica-Bold').fontSize(8);

        let xPos = leftMargin + 4;
        tableRows[0].forEach((cell, i) => {
          doc.text(cell, xPos, headerY + 7, {
            width: scaledWidths[i] - 6,
            height: headerHeight - 4,
            lineBreak: false
          });
          xPos += scaledWidths[i];
        });
        doc.y = headerY + headerHeight;

        // Data rows with dynamic height
        doc.font('Helvetica').fontSize(8);
        for (let r = 1; r < tableRows.length; r++) {
          // Check for page break
          if (doc.y > 740) {
            // Draw border for current section
            doc.strokeColor(colors.border).lineWidth(0.5);
            doc.rect(leftMargin, headerY, pageWidth, doc.y - headerY).stroke();
            doc.addPage();
            // Redraw header on new page
            const newHeaderY = doc.y;
            doc.rect(leftMargin, newHeaderY, pageWidth, headerHeight).fill(colors.headerBg);
            doc.fillColor(colors.headerText).font('Helvetica-Bold').fontSize(8);
            xPos = leftMargin + 4;
            tableRows[0].forEach((cell, i) => {
              doc.text(cell, xPos, newHeaderY + 7, { width: scaledWidths[i] - 6, height: headerHeight - 4, lineBreak: false });
              xPos += scaledWidths[i];
            });
            doc.y = newHeaderY + headerHeight;
            doc.font('Helvetica').fontSize(8);
          }

          const rowY = doc.y;
          const rowHeight = 18;
          const isAlt = r % 2 === 0;

          // Row background
          if (isAlt) {
            doc.rect(leftMargin, rowY, pageWidth, rowHeight).fill(colors.rowAlt);
          }

          // Cell content
          doc.fillColor(colors.text);
          xPos = leftMargin + 4;
          tableRows[r].forEach((cell, i) => {
            // Right-align numbers
            const isNumber = /^[\$\d\,\.\-\%]+$/.test(cell.trim());
            doc.text(cell, xPos, rowY + 5, {
              width: scaledWidths[i] - 6,
              height: rowHeight - 4,
              align: isNumber ? 'right' : 'left',
              lineBreak: false
            });
            xPos += scaledWidths[i];
          });

          // Draw row separator
          doc.strokeColor(colors.border).lineWidth(0.3);
          doc.moveTo(leftMargin, rowY + rowHeight).lineTo(leftMargin + pageWidth, rowY + rowHeight).stroke();

          doc.y = rowY + rowHeight;
        }

        // Table border
        doc.strokeColor(colors.border).lineWidth(0.5);
        doc.rect(leftMargin, headerY, pageWidth, doc.y - headerY).stroke();

        // Column separators
        xPos = leftMargin;
        for (let i = 0; i < scaledWidths.length - 1; i++) {
          xPos += scaledWidths[i];
          doc.strokeColor(colors.border).lineWidth(0.3);
          doc.moveTo(xPos, headerY).lineTo(xPos, doc.y).stroke();
        }

        doc.moveDown(0.5);
        tableRows = [];

        // CRITICAL: Reset cursor position and font after table
        doc.x = leftMargin;
        doc.font('Helvetica').fontSize(10).fillColor(colors.text);
      };

      for (const line of lines) {
        // Check for page break
        if (doc.y > 750) {
          if (inTable) renderTable();
          doc.addPage();
        }

        // Section headers (##) - prevent orphaned headers
        if (line.startsWith('## ')) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          // Keep header with content - add page break if near bottom
          if (doc.y > 680) {
            doc.addPage();
          }
          doc.moveDown(0.8);
          doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary);
          doc.text(line.replace(/^## /, '').replace(/\*\*/g, ''));
          // Underline
          doc.strokeColor(colors.secondary).lineWidth(1.5);
          doc.moveTo(leftMargin, doc.y + 2).lineTo(leftMargin + 200, doc.y + 2).stroke();
          doc.moveDown(0.4);
          doc.fontSize(10).font('Helvetica').fillColor(colors.text);
          continue;
        }

        // Subsection headers (###) - prevent orphaned headers
        if (line.startsWith('### ')) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          // Keep header with content
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.secondary);
          doc.text(line.replace(/^### /, '').replace(/\*\*/g, ''));
          doc.moveDown(0.2);
          doc.fontSize(10).font('Helvetica').fillColor(colors.text);
          continue;
        }

        // Subsubsection (####) - prevent orphaned headers
        if (line.startsWith('#### ')) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          // Keep header with content
          if (doc.y > 720) {
            doc.addPage();
          }
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.text);
          doc.text(line.replace(/^#### /, '').replace(/\*\*/g, ''));
          doc.moveDown(0.2);
          doc.fontSize(10).font('Helvetica').fillColor(colors.text);
          continue;
        }

        // Table rows
        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.includes('---')) continue;
          inTable = true;
          const cells = line.split('|').filter(c => c.trim()).map(c => c.trim().replace(/\*\*/g, ''));
          tableRows.push(cells);
          continue;
        } else if (inTable) {
          renderTable();
          inTable = false;
        }

        // Bullet points
        if (line.match(/^[\-\*]\s+/)) {
          inList = true;
          const text = line.replace(/^[\-\*]\s+/, '').replace(/\*\*/g, '');
          // Use simple dash bullet to avoid font encoding issues
          doc.fillColor(colors.text).text('  -  ' + text, leftMargin, doc.y);
          continue;
        }

        // Numbered lists
        if (line.match(/^\d+\.\s+/)) {
          inList = true;
          const text = line.replace(/\*\*/g, '');
          doc.fillColor(colors.text).text('  ' + text);
          continue;
        }

        // Horizontal rules
        if (line.match(/^---+$/)) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          doc.moveDown(0.3);
          doc.strokeColor(colors.border).lineWidth(0.5);
          doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
          doc.moveDown(0.3);
          continue;
        }

        // Empty lines
        if (!line.trim()) {
          if (inList) { inList = false; }
          doc.moveDown(0.3);
          continue;
        }

        // Regular text with bold handling
        if (inList) { inList = false; }
        let text = line;
        if (text.includes('**')) {
          // Remove bold markers and render as plain text to avoid positioning issues
          // Bold inline with continued causes overlap problems in pdfkit
          const cleanText = text.replace(/\*\*/g, '');
          doc.font('Helvetica').text(cleanText);
        } else {
          doc.text(text);
        }
      }

      // Render any remaining table
      if (inTable) renderTable();

      // Footer
      doc.moveDown(2);
      doc.strokeColor(colors.border).lineWidth(0.5);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(colors.lightText);
      doc.text('This analysis was generated by Scout AI using McKinsey/HBS analytical frameworks.', { align: 'center' });
      doc.text('Confidential - For Internal Use Only', { align: 'center' });

      // Add page numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(9).fillColor(colors.lightText);
        doc.text(`Page ${i + 1} of ${pages.count}`,
          leftMargin, 780,
          { align: 'right', width: pageWidth }
        );
        // Header on each page
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(8);
        doc.text('Scout AI Analysis', leftMargin, 30);
        doc.strokeColor(colors.secondary).lineWidth(1);
        doc.moveTo(leftMargin, 42).lineTo(leftMargin + pageWidth, 42).stroke();
      }

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Upload file to Mattermost and return file ID
async function uploadFileToMattermost(filePath, channelId, fileName) {
  // Use curl for reliable multipart upload
  const curlCmd = `curl -s -X POST "${config.mattermost.url}/api/v4/files" \
    -H "Authorization: Bearer ${config.mattermost.botToken}" \
    -F "channel_id=${channelId}" \
    -F "files=@${filePath};filename=${fileName}"`;

  try {
    const result = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(result);
    if (parsed.file_infos && parsed.file_infos[0]) {
      return parsed.file_infos[0].id;
    }
    throw new Error('No file_infos in response: ' + result);
  } catch (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }
}

// ============ TAVILY WEB SEARCH ============

// Search the web using Tavily API
async function webSearch(query, options = {}) {
  if (!config.tavily?.enabled || !config.tavily?.apiKey || config.tavily.apiKey === 'YOUR_TAVILY_API_KEY') {
    log('warn', 'Tavily not configured, skipping web search');
    return null;
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: config.tavily.apiKey,
        query: query,
        search_depth: options.depth || 'basic', // 'basic' or 'advanced'
        include_answer: true,
        include_raw_content: false,
        max_results: options.maxResults || 5
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log('error', 'Tavily API error', { status: response.status, error });
      return null;
    }

    const data = await response.json();
    log('info', 'Web search completed', { query, resultsCount: data.results?.length });

    return {
      answer: data.answer,
      results: data.results?.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score
      })) || []
    };
  } catch (error) {
    log('error', 'Web search failed', { query, error: error.message });
    return null;
  }
}

// Load preferences from file
function loadPreferences() {
  try {
    if (fs.existsSync(prefsFile)) {
      const data = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
      for (const [channelId, prefs] of Object.entries(data)) {
        state.channelPreferences.set(channelId, prefs);
      }
      log('info', 'Loaded channel preferences', { count: Object.keys(data).length });
    }
  } catch (error) {
    log('error', 'Failed to load preferences', { error: error.message });
  }
}

// Save preferences to file
function savePreferences() {
  try {
    const data = {};
    for (const [channelId, prefs] of state.channelPreferences) {
      data[channelId] = prefs;
    }
    fs.writeFileSync(prefsFile, JSON.stringify(data, null, 2));
  } catch (error) {
    log('error', 'Failed to save preferences', { error: error.message });
  }
}

// Get channel preferences with defaults
function getChannelPrefs(channelId) {
  if (!state.channelPreferences.has(channelId)) {
    state.channelPreferences.set(channelId, {
      checkInFrequency: 'normal', // quiet, normal, active
      focusTopics: [], // topics to prioritize
      researchDepth: 'standard', // quick, standard, deep
      proactiveLevel: 'medium', // low, medium, high
      reminderTopics: [], // topics to revisit
      feedback: [] // user feedback for improvement
    });
  }
  return state.channelPreferences.get(channelId);
}

// Logging
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

// Initialize LLM router (deferred until log function is defined)
llm.init({ log }).catch(err => {
  console.error('[Scout] LLM router init failed:', err.message);
});

// Mattermost API helper
async function mmApi(endpoint, method = 'GET', body = null) {
  const url = `${config.mattermost.url}/api/v4${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.mattermost.botToken}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  return response.json();
}

// Post message to channel
async function postMessage(channelId, message, rootId = null) {
  const body = {
    channel_id: channelId,
    message: message
  };
  if (rootId) body.root_id = rootId;

  log('debug', 'Attempting to post', { channelId, rootId, messageLength: message.length });

  try {
    const result = await mmApi('/posts', 'POST', body);
    log('info', 'Posted message', { channelId, messageLength: message.length });

    // Persist bot response to disk
    memory.appendMessage(channelId, {
      id: result?.id || null,
      content: message,
      userId: state.botUserId,
      timestamp: result?.create_at || Date.now(),
      role: 'assistant'
    });
  } catch (error) {
    log('error', 'Failed to post message', { channelId, error: error.message });
  }
}

// Generate a brief summary of long content using fast/cheap model
async function generateSummary(fullContent, maxChars = 500) {
  try {
    // Use model router for summary tasks (budget tier)
    const result = await llm.summarize([
      { role: 'user', content: fullContent }
    ], {
      system: `Summarize the following content in under ${maxChars} characters. Include only the most important takeaways. Be extremely concise. Do not use bullet points - write in brief prose. Do not start with "This" or "The content".`,
      maxTokens: 200
    });

    log('debug', 'Summary generated via router', { model: result.model });
    return result.text;
  } catch (error) {
    log('error', 'Failed to generate summary', { error: error.message });
    // Fallback: truncate content
    return fullContent.substring(0, maxChars - 50) + '... (see full content)';
  }
}

// Post long content with splitting: summary as main post, full content in thread
async function postWithSplitting(channelId, content, rootId, commandType) {
  const splitCommands = config.contentSplitting?.splitCommands || [];
  const shouldSplit = config.contentSplitting?.enabled &&
                      splitCommands.includes(commandType);

  if (!shouldSplit) {
    return postMessage(channelId, content, rootId);
  }

  try {
    // 1. Generate summary first
    const summary = await generateSummary(content, config.contentSplitting.summaryMaxChars || 500);

    // 2. Post summary as main message
    const summaryMessage = `${summary}\n\n:thread: **Full ${commandType} in thread** ↓`;
    const summaryBody = {
      channel_id: channelId,
      message: summaryMessage
    };
    if (rootId) summaryBody.root_id = rootId;

    const summaryResult = await mmApi('/posts', 'POST', summaryBody);
    log('info', 'Posted summary', { channelId, summaryLength: summary.length, commandType });

    // 3. Post full content as thread reply under the summary
    const fullContentBody = {
      channel_id: channelId,
      message: `## Full ${commandType.charAt(0).toUpperCase() + commandType.slice(1)}\n\n${content}`,
      root_id: summaryResult.id  // Thread under the summary
    };

    const fullResult = await mmApi('/posts', 'POST', fullContentBody);
    log('info', 'Posted full content in thread', {
      channelId,
      messageLength: content.length,
      threadRoot: summaryResult.id
    });

    // Persist to memory
    memory.appendMessage(channelId, {
      id: summaryResult?.id || null,
      content: summaryMessage,
      userId: state.botUserId,
      timestamp: summaryResult?.create_at || Date.now(),
      role: 'assistant'
    });

    return summaryResult;
  } catch (error) {
    log('error', 'Failed to post with splitting, falling back to normal post', {
      error: error.message
    });
    // Fallback to normal posting if splitting fails
    return postMessage(channelId, content, rootId);
  }
}

// Add first-response hint if this is the first interaction in channel this session
function maybeAddHint(channelId, response) {
  if (!state.introducedChannels.has(channelId)) {
    state.introducedChannels.add(channelId);
    return response + `\n\n---\n_💡 Tip: Type \`!scout\` to see all my commands_`;
  }
  return response;
}

// Fetch channel history from Mattermost API
async function fetchChannelHistory(channelId, limit = 100) {
  try {
    const data = await mmApi(`/channels/${channelId}/posts?per_page=${limit}`);
    if (!data.posts || !data.order) {
      return [];
    }

    // Sort posts by timestamp (oldest first for conversation flow)
    const posts = data.order.map(id => data.posts[id]).reverse();

    // Get user info for each unique user
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const userMap = {};

    for (const userId of userIds) {
      try {
        const user = await mmApi(`/users/${userId}`);
        userMap[userId] = user.username || user.nickname || 'Unknown';
      } catch (e) {
        userMap[userId] = 'Unknown';
      }
    }

    // Format messages with usernames
    return posts.map(p => ({
      username: userMap[p.user_id] || 'Unknown',
      content: p.message,
      timestamp: p.create_at,
      userId: p.user_id
    }));
  } catch (error) {
    log('error', 'Failed to fetch channel history', { channelId, error: error.message });
    return [];
  }
}

// GitHub Integration
async function getGitHubData(command) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: 30000,
      cwd: '/opt/mattermost/playbook-templates'
    });
    return result.trim();
  } catch (error) {
    log('error', 'GitHub command failed', { command, error: error.message });
    return null;
  }
}

async function getRecentCommits(repo, count = 5) {
  const cmd = `gh api repos/${repo}/commits --jq '.[0:${count}] | .[] | "- \\(.commit.message | split("\\n")[0]) by \\(.commit.author.name) (\\(.sha[0:7]))"'`;
  return getGitHubData(cmd);
}

async function getOpenPRs(repo) {
  const cmd = `gh pr list --repo ${repo} --limit 10 --json number,title,author,createdAt --jq '.[] | "- #\\(.number): \\(.title) by @\\(.author.login)"'`;
  return getGitHubData(cmd);
}

async function getOpenIssues(repo) {
  const cmd = `gh issue list --repo ${repo} --limit 10 --json number,title,author,createdAt --jq '.[] | "- #\\(.number): \\(.title)"'`;
  return getGitHubData(cmd);
}

async function createGitHubIssue(repo, title, body) {
  const cmd = `gh issue create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`;
  return getGitHubData(cmd);
}

// Create a new branch from default branch
async function createGitHubBranch(repo, branchName) {
  const cmd = `gh api repos/${repo}/git/refs -f ref="refs/heads/${branchName}" -f sha="$(gh api repos/${repo}/git/refs/heads/main --jq '.object.sha' 2>/dev/null || gh api repos/${repo}/git/refs/heads/master --jq '.object.sha')"`;
  return getGitHubData(cmd);
}

// Create a pull request
async function createGitHubPR(repo, title, body, headBranch, baseBranch = 'main') {
  const safeTitle = title.replace(/"/g, '\\"');
  const safeBody = body.replace(/"/g, '\\"');
  const cmd = `gh pr create --repo ${repo} --title "${safeTitle}" --body "${safeBody}" --head "${headBranch}" --base "${baseBranch}"`;
  return getGitHubData(cmd);
}

// Comment on an issue
async function commentOnGitHubIssue(repo, issueNumber, comment) {
  const safeComment = comment.replace(/"/g, '\\"');
  const cmd = `gh issue comment ${issueNumber} --repo ${repo} --body "${safeComment}"`;
  return getGitHubData(cmd);
}

// Comment on a PR
async function commentOnGitHubPR(repo, prNumber, comment) {
  const safeComment = comment.replace(/"/g, '\\"');
  const cmd = `gh pr comment ${prNumber} --repo ${repo} --body "${safeComment}"`;
  return getGitHubData(cmd);
}

// Create or update a file in a repo
async function updateGitHubFile(repo, filePath, content, commitMessage, branch = 'main') {
  const safeMessage = commitMessage.replace(/"/g, '\\"');
  // Base64 encode the content
  const base64Content = Buffer.from(content).toString('base64');
  // Get current file SHA if it exists (for updates)
  const getShaCmd = `gh api repos/${repo}/contents/${filePath}?ref=${branch} --jq '.sha' 2>/dev/null || echo ""`;
  const sha = await getGitHubData(getShaCmd);

  let cmd;
  if (sha && sha.trim()) {
    // Update existing file
    cmd = `gh api repos/${repo}/contents/${filePath} -X PUT -f message="${safeMessage}" -f content="${base64Content}" -f branch="${branch}" -f sha="${sha.trim()}"`;
  } else {
    // Create new file
    cmd = `gh api repos/${repo}/contents/${filePath} -X PUT -f message="${safeMessage}" -f content="${base64Content}" -f branch="${branch}"`;
  }
  return getGitHubData(cmd);
}

// Get file contents from GitHub
async function getGitHubFileContent(repo, filePath, branch = 'main') {
  const cmd = `gh api repos/${repo}/contents/${filePath}?ref=${branch} --jq '.content' | base64 -d`;
  return getGitHubData(cmd);
}

// ============ JIRA INTEGRATION ============

// Jira API helper
async function jiraApi(endpoint, method = 'GET', body = null) {
  if (!config.jira?.enabled) {
    throw new Error('Jira integration not configured. Set jira.enabled=true in config.json');
  }

  const url = `${config.jira.instanceUrl}/rest/api/3${endpoint}`;
  const auth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    log('error', 'Jira API error', { status: response.status, body: text });
    throw new Error(`Jira API error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

// Create Jira issue
async function createJiraIssue(summary, description, issueType = null, project = null) {
  const projectKey = project || config.jira.defaultProject;
  const type = issueType || config.jira.defaultIssueType;

  const body = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }]
      },
      issuetype: { name: type }
    }
  };

  try {
    const result = await jiraApi('/issue', 'POST', body);
    const issueUrl = `${config.jira.instanceUrl}/browse/${result.key}`;
    return { success: true, key: result.key, url: issueUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create Story with acceptance criteria
async function createJiraStory(summary, description, acceptanceCriteria = '') {
  const fullDescription = acceptanceCriteria
    ? `${description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`
    : description;

  return createJiraIssue(summary, fullDescription, 'Story');
}

// Create Bug
async function createJiraBug(summary, description, stepsToReproduce = '') {
  const fullDescription = stepsToReproduce
    ? `${description}\n\n**Steps to Reproduce:**\n${stepsToReproduce}`
    : description;

  return createJiraIssue(summary, fullDescription, 'Bug');
}

// Create Task
async function createJiraTask(summary, description) {
  return createJiraIssue(summary, description, 'Task');
}

// Search Jira issues with JQL
async function searchJiraIssues(jql, maxResults = 50) {
  try {
    const result = await jiraApi(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
    return result.issues || [];
  } catch (error) {
    log('error', 'Jira search failed', { jql, error: error.message });
    return [];
  }
}

// Get backlog issues for the project
async function getJiraBacklog(project = null) {
  const projectKey = project || config.jira.defaultProject;
  const jql = `project = ${projectKey} AND status != Done ORDER BY created DESC`;
  return searchJiraIssues(jql);
}

// Get a specific Jira issue
async function getJiraIssue(issueKey) {
  try {
    return await jiraApi(`/issue/${issueKey}`);
  } catch (error) {
    log('error', 'Failed to get Jira issue', { issueKey, error: error.message });
    return null;
  }
}

// Update a Jira issue
async function updateJiraIssue(issueKey, updates) {
  const body = { fields: {} };

  if (updates.summary) {
    body.fields.summary = updates.summary;
  }

  if (updates.description) {
    body.fields.description = {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: updates.description }]
      }]
    };
  }

  if (updates.priority) {
    body.fields.priority = { name: updates.priority };
  }

  try {
    await jiraApi(`/issue/${issueKey}`, 'PUT', body);
    return { success: true, key: issueKey, url: `${config.jira.instanceUrl}/browse/${issueKey}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete a Jira issue
async function deleteJiraIssue(issueKey) {
  try {
    await jiraApi(`/issue/${issueKey}`, 'DELETE');
    return { success: true, key: issueKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get available transitions for an issue
async function getJiraTransitions(issueKey) {
  try {
    const result = await jiraApi(`/issue/${issueKey}/transitions`);
    return result.transitions || [];
  } catch (error) {
    log('error', 'Failed to get transitions', { issueKey, error: error.message });
    return [];
  }
}

// Transition a Jira issue (change status)
async function transitionJiraIssue(issueKey, transitionName) {
  try {
    const transitions = await getJiraTransitions(issueKey);
    const transition = transitions.find(t =>
      t.name.toLowerCase() === transitionName.toLowerCase() ||
      t.to.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!transition) {
      const available = transitions.map(t => t.name).join(', ');
      return { success: false, error: `Transition "${transitionName}" not found. Available: ${available}` };
    }

    await jiraApi(`/issue/${issueKey}/transitions`, 'POST', { transition: { id: transition.id } });
    return { success: true, key: issueKey, newStatus: transition.to.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check for duplicate issues using AI
async function checkForDuplicates(newSummary, existingIssues) {
  if (!existingIssues || existingIssues.length === 0) {
    return { isDuplicate: false, duplicates: [] };
  }

  const existingList = existingIssues.map(i =>
    `- ${i.key}: ${i.fields.summary}`
  ).join('\n');

  const systemPrompt = `You are checking for duplicate Jira issues.

Compare the NEW issue summary against EXISTING issues. An issue is a duplicate if:
1. It describes the same task/bug/feature
2. It has very similar wording or intent
3. Completing one would essentially complete the other

Output JSON:
{
  "isDuplicate": true/false,
  "duplicateKeys": ["SCRUM-123"], // keys of duplicate issues, empty if none
  "confidence": "high"/"medium"/"low",
  "reason": "brief explanation"
}`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `NEW ISSUE: "${newSummary}"\n\nEXISTING ISSUES:\n${existingList}`
      }]
    });

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    log('error', 'Duplicate check failed', { error: error.message });
  }

  return { isDuplicate: false, duplicates: [] };
}

// AI-enhanced: Generate well-structured Jira issue from natural language
async function generateJiraIssue(naturalLanguage, issueType = 'Task') {
  const systemPrompt = `You are a skilled product manager creating Jira backlog items.

Given a natural language request, create a well-structured Jira issue with:
1. **Summary**: Clear, concise title (max 100 chars)
2. **Description**: Detailed description with context
3. **Acceptance Criteria** (for Stories): Bullet points of "Given/When/Then" or checkboxes
4. **Steps to Reproduce** (for Bugs): Numbered steps

Output as JSON:
{
  "summary": "...",
  "description": "...",
  "acceptanceCriteria": "..." (only for stories),
  "stepsToReproduce": "..." (only for bugs)
}`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create a ${issueType} from this request:\n\n${naturalLanguage}`
      }]
    });

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse AI response');
  } catch (error) {
    log('error', 'Failed to generate Jira issue', { error: error.message });
    return null;
  }
}

// ============ DOCUMENTATION TO GITHUB ============
const DOCS_PATH = '/opt/mattermost/playbook-templates/docs';
const REPO_PATH = '/opt/mattermost/playbook-templates';

// Save content to a markdown file and commit to GitHub
async function saveToGitHub(filename, content, commitMessage) {
  try {
    // Ensure docs directory exists
    if (!fs.existsSync(DOCS_PATH)) {
      fs.mkdirSync(DOCS_PATH, { recursive: true });
    }

    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const fullFilename = `${date}-${safeName}.md`;
    const filepath = path.join(DOCS_PATH, fullFilename);

    // Write file
    fs.writeFileSync(filepath, content);
    log('info', 'Wrote documentation file', { filepath });

    // Git operations
    const gitAdd = execSync(`git add "${filepath}"`, { cwd: REPO_PATH, encoding: 'utf8' });
    const gitCommit = execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: REPO_PATH, encoding: 'utf8' });
    const gitPush = execSync(`git push`, { cwd: REPO_PATH, encoding: 'utf8' });

    log('info', 'Committed and pushed to GitHub', { filepath });
    return { success: true, filepath: `docs/${fullFilename}`, filename: fullFilename };
  } catch (error) {
    log('error', 'Failed to save to GitHub', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Get the last substantial bot response for saving
function getLastBotResponse(channelMessages) {
  // Find the last assistant message that's substantial (not a greeting/ack)
  for (let i = channelMessages.length - 1; i >= 0; i--) {
    const msg = channelMessages[i];
    if (msg.role === 'assistant' && msg.content && msg.content.length > 200) {
      return msg.content;
    }
  }
  return null;
}

// Research with probabilistic analysis - Adaptive Domain Expertise
async function performResearch(topic, context = '') {
  const systemPrompt = `You are an adaptive expert researcher who adopts the appropriate subject matter expertise based on the content being analyzed.

## ADAPTIVE EXPERTISE (CRITICAL)

First, identify the domain of the research topic and content, then adopt the appropriate expert role:

**Software/Technical Content** → Adopt expertise matching the specific technology stack:
- **Frontend (React, Vue, Angular, CSS)** → Senior Frontend Architect - component patterns, state management, performance, accessibility, UX implementation
- **Backend (Node, Python, Go, Java, Rust)** → Principal Backend Engineer - API design, data modeling, concurrency, error handling, testing strategies
- **DevOps/Infrastructure (K8s, Docker, AWS, CI/CD)** → Staff SRE/Platform Engineer - deployment strategies, observability, scaling, security hardening
- **Database (SQL, NoSQL, caching)** → Data Architect - schema design, query optimization, indexing, consistency tradeoffs
- **Mobile (iOS, Android, React Native)** → Mobile Tech Lead - platform patterns, performance, offline-first, app lifecycle
- **ML/AI** → ML Engineer - model architecture, training pipelines, evaluation metrics, deployment
- **Security** → Security Engineer - threat modeling, vulnerabilities, secure coding, compliance
- Focus on: architecture patterns, code quality, performance, scalability, security, best practices specific to the tech stack
- Analyze: technical tradeoffs, implementation details, code patterns, edge cases, potential issues

**Business/Strategy Content** → McKinsey Senior Partner, HBS Researcher
- Focus on: market dynamics, competitive positioning, growth strategy, unit economics
- Frameworks: Porter's 5 Forces, SWOT, Jobs-to-be-Done, Blue Ocean Strategy
- Analyze: business models, market opportunity, competitive moats

**Product/UX Content** → VP of Product, IDEO Design Partner
- Focus on: user needs, product-market fit, feature prioritization, user journeys
- Frameworks: Jobs-to-be-Done, Kano model, Design Thinking
- Analyze: user problems, solution fit, product strategy

**Data/Analytics Content** → Chief Data Scientist, Quantitative Researcher
- Focus on: statistical validity, data quality, analytical methods, insights extraction
- Frameworks: hypothesis testing, causal inference, predictive modeling
- Analyze: data interpretations, methodology rigor, actionable insights

**Operations/Process Content** → COO, Six Sigma Black Belt
- Focus on: efficiency, process optimization, scalability, resource allocation
- Frameworks: Lean, Six Sigma, Theory of Constraints
- Analyze: bottlenecks, workflows, operational metrics

## CRITICAL: ANALYZE CONTENT, NOT CONVERSATION METADATA

**DO NOT** analyze:
- Who posted what or who added whom to channels
- Channel lifecycle (archived, unarchived, created)
- Team dynamics or organizational patterns
- The "purpose" of the discussion or channel

**DO** analyze:
- The actual technical details, specifications, and configurations shared
- The ideas, arguments, data, and conclusions in the content
- Tradeoffs, implications, and best practices related to the subject matter
- What a domain expert would want to understand about this topic

**Example - WRONG approach:** "Alex.h shared this setup for the team, adding kwaku and hubert to collaborate on FastRTC evaluation"
**Example - RIGHT approach:** "FastRTC enables sub-200ms voice-to-LLM latency. The configuration uses -ngl 99 for full GPU offload with Gemma-3-27B requiring ~20GB VRAM..."

## QUALITY STANDARDS (Apply to ALL domains)

- **Deep Dive**: Thoroughly analyze the technical/substantive CONTENT itself
- **MECE Thinking**: Mutually Exclusive, Collectively Exhaustive analysis of the subject matter
- **Evidence-Based**: Ground insights in the provided content and established domain knowledge
- **So-What Test**: Every insight must have clear implications for practitioners
- **Subject Matter Focus**: You are analyzing the TOPIC, not the conversation about the topic

### Communication Excellence:
- **Powerful Metaphors**: Make complex concepts accessible through domain-appropriate analogies
- **Executive Summary First**: Lead with the punchline
- **Crisp Language**: No filler words, every sentence earns its place

## RESEARCH OUTPUT FORMAT

## Executive Summary
[2-3 sentences capturing the key insight - what a CEO needs to know in 30 seconds]

**The Metaphor:** [A vivid analogy that captures the essence of this research]

---

## Research Analysis: [Topic]

### Hypothesis 1: [Name] (Probability: X%)
**The Insight:** [One powerful sentence]
**Evidence & Logic:** [Data, case studies, or logical reasoning]
**Population/Context:** [Who/what this applies to]
**Metaphor:** [Analogy to make this tangible]

### Hypothesis 2: [Name] (Probability: X%)
[Continue same format for all 5 hypotheses - probabilities must sum to ~100%]

---

### Strategic Framework Applied
[Apply a relevant framework: Porter's 5 Forces, SWOT, Jobs-to-be-Done, Crossing the Chasm, etc.]

### Population & Sampling Considerations
- **Target Population:** Who does this apply to?
- **Sample Quality:** What's the evidence base?
- **Potential Biases:** What might we be missing?
- **Boundary Conditions:** When does this analysis NOT apply?

### Confidence Assessment
| Factor | Rating | Notes |
|--------|--------|-------|
| Evidence Quality | X/10 | ... |
| Logical Coherence | X/10 | ... |
| Expert Consensus | X/10 | ... |
| **Overall Confidence** | **X/10** | ... |

### The Recommendation
**Bottom Line:** [One sentence recommendation]
**Key Caveats:** [What could change this]
**Next Steps:** [Specific actions to take]

---

### 💡 Did You Know?
- **Did you know that...?** [Surprising, research-backed fact]
- **Did you know that...?** [Counter-intuitive insight]
- **Did you know that...?** [Historical parallel or case study]

### 🤔 Let's Discuss
Use VARIED, engaging conversation starters - NEVER start multiple questions the same way. Mix these styles:
- "I'm curious..." / "Here's what puzzles me..." / "The elephant in the room is..."
- "If you were betting your own money..." / "What would [competitor] do here?"
- "The contrarian view would be..." / "Devil's advocate question..."
- "Imagine explaining this to your board..." / "If this were a startup pitch..."
- Provocative observations: "Notice how this mirrors [unexpected parallel]..."
- Direct challenges: "Push back on me here, but..." / "Convince me I'm wrong about..."

---
*Analysis delivered at McKinsey/HBS standards with MECE structure and evidence-based reasoning.*`;

  try {
    // Perform web search if Tavily is configured
    let webContext = '';
    const searchResults = await webSearch(topic, { depth: 'advanced', maxResults: 5 });
    if (searchResults) {
      webContext = `\n\n## Web Research Results\n`;
      if (searchResults.answer) {
        webContext += `**Quick Answer:** ${searchResults.answer}\n\n`;
      }
      webContext += `**Sources:**\n`;
      for (const result of searchResults.results) {
        webContext += `- **${result.title}** (${result.url})\n  ${result.content?.substring(0, 300)}...\n\n`;
      }
    }

    // Analysis function for Ralph mode
    const doAnalysis = async (researchTopic, researchContext, ralphPrompt = '') => {
      const fullSystem = ralphPrompt ? `${systemPrompt}\n\n${ralphPrompt}` : systemPrompt;
      const result = await llm.research([{
        role: 'user',
        content: `Research topic: ${researchTopic}\n\nContext: ${researchContext}${webContext}\n\nProvide a comprehensive probabilistic analysis with 5 hypotheses.${webContext ? ' Incorporate the web research results into your analysis and cite sources where relevant.' : ''}`
      }], {
        system: fullSystem,
        maxTokens: 4096
      });
      return result.text;
    };

    // Use Ralph mode for autonomous iterative analysis
    // Bot decides on its own if extended iteration is needed
    const prefs = getChannelPrefs ? getChannelPrefs('') : { researchDepth: 'standard' };
    const depth = prefs.researchDepth || 'standard';

    const ralphResult = await ralph.iterativeAnalysis(
      doAnalysis,
      topic,
      context,
      depth,
      (msg) => log('info', msg)
    );

    log('info', 'Research completed via Ralph mode', {
      iterations: ralphResult.iterations,
      extended: ralphResult.extended,
      confidence: ralphResult.confidence
    });

    // Add iteration info to output if extended mode was used
    let output = ralphResult.output;
    if (ralphResult.extended && ralphResult.iterations > 1) {
      output += `\n\n---\n*Analysis refined through ${ralphResult.iterations} iterations (Ralph Mode)*`;
    }

    return output;
  } catch (error) {
    log('error', 'Research failed', { error: error.message });
    return null;
  }
}

// Brainstorm with probabilistic outcomes - McKinsey/HBS Quality Standards
async function brainstormWithProbabilities(topic, context = '') {
  const systemPrompt = `You are a senior partner at McKinsey and IDEO, combining rigorous strategic analysis with world-class design thinking and innovation methodology.

## QUALITY STANDARDS (Non-negotiable)

### Strategic Rigor (McKinsey):
- **MECE Structure**: Ideas must be mutually exclusive and collectively exhaustive
- **Hypothesis-Driven**: Each idea is a testable hypothesis
- **Evidence-Based**: Ground ideas in data, case studies, or sound logic
- **80/20 Prioritization**: Focus on ideas with highest impact-to-effort ratio

### Innovation Excellence (IDEO/HBS):
- **First Principles**: Break problems down to fundamental truths, then rebuild
- **Jobs-to-be-Done**: What job is the user trying to accomplish?
- **Blue Ocean Thinking**: Where can we create uncontested market space?
- **Minimum Viable Test**: How can we validate cheaply and quickly?

### Communication Excellence:
- **Powerful Metaphors**: Every idea gets a vivid analogy
  - "This approach is like building a bridge while crossing the river"
  - "Think of it as planting seeds vs. buying flowers"
- **Historical Parallels**: Reference famous business cases
  - "Similar to how Amazon used AWS to fund retail..."
- **Contrarian View**: Include one "what if everyone is wrong?" perspective

## BRAINSTORM OUTPUT FORMAT

## Executive Summary
[The winning idea in one sentence - what would you tell the CEO in an elevator?]

**The Metaphor:** [A vivid analogy that captures the strategic choice]

---

## Brainstorm: [Topic]

### 🥇 Idea 1: [Bold Name]
**The Pitch:** [One compelling sentence]
**The Metaphor:** [Vivid analogy - "This is like..."]
**Historical Parallel:** [Similar successful approach - "Netflix did this when..."]

| Metric | Assessment |
|--------|------------|
| Success Probability | X% |
| Difficulty | X/10 |
| Time to Value | Short/Med/Long |
| Resources Required | Low/Med/High |
| Risk Level | Low/Med/High |

**Why This Probability:** [Evidence and logic]
**Key Assumptions:** [What must be true for this to work]
**Best For:** [Context/population where this excels]
**Watch Out For:** [Risks and failure modes]

### 🥈 Idea 2: [Name]
[Same format...]

### 🥉 Idea 3: [Name]
[Same format...]

### 💡 Idea 4: [Name]
[Same format...]

### 🔥 Idea 5: The Contrarian Play
**The Unconventional Bet:** [What if the obvious answer is wrong?]
[Same format, but challenge conventional wisdom]

---

### Comparative Matrix
| Idea | Success % | Difficulty | Time | Resources | Risk | Best When... |
|------|-----------|------------|------|-----------|------|--------------|
| 1 | X% | X/10 | X | X | X | ... |
| 2 | X% | X/10 | X | X | X | ... |
| 3 | X% | X/10 | X | X | X | ... |
| 4 | X% | X/10 | X | X | X | ... |
| 5 | X% | X/10 | X | X | X | ... |

### Decision Framework
| If you're optimizing for... | Choose | Because... |
|-----------------------------|--------|------------|
| Speed to market | Idea X | ... |
| Highest success rate | Idea X | ... |
| Limited resources | Idea X | ... |
| Low risk tolerance | Idea X | ... |
| Maximum learning | Idea X | ... |
| Long-term positioning | Idea X | ... |

### The Recommendation
**If I had to bet the company:** [One sentence recommendation]
**The 90-Day Plan:**
1. Week 1-2: [Specific action]
2. Week 3-4: [Specific action]
3. Month 2: [Specific action]
4. Month 3: [Specific action]

**Kill Criteria:** [When to abandon this approach]

---

### 💡 Did You Know?
- **Did you know that...?** [Surprising innovation fact]
- **Did you know that...?** [Counter-intuitive success story]
- **Did you know that...?** [Failure that led to breakthrough]

### 🤔 Discussion Questions
- What are your thoughts on the contrarian play?
- Which assumptions are we most uncertain about?
- What's the fastest way to test our riskiest assumption?

---
*Brainstorm delivered at McKinsey/IDEO standards with first principles thinking and evidence-based creativity.*`;

  try {
    // Analysis function for Ralph mode
    const doBrainstorm = async (brainstormTopic, brainstormContext, ralphPrompt = '') => {
      const fullSystem = ralphPrompt ? `${systemPrompt}\n\n${ralphPrompt}` : systemPrompt;
      const result = await llm.research([{
        role: 'user',
        content: `Brainstorm topic: ${brainstormTopic}\n\nContext: ${brainstormContext}\n\nProvide 5 creative ideas with probabilistic analysis.`
      }], {
        system: fullSystem,
        maxTokens: 4096
      });
      return result.text;
    };

    // Use Ralph mode for autonomous iterative brainstorming
    const prefs = getChannelPrefs ? getChannelPrefs('') : { researchDepth: 'standard' };
    const depth = prefs.researchDepth || 'standard';

    const ralphResult = await ralph.iterativeAnalysis(
      doBrainstorm,
      topic,
      context,
      depth,
      (msg) => log('info', msg)
    );

    log('info', 'Brainstorm completed via Ralph mode', {
      iterations: ralphResult.iterations,
      extended: ralphResult.extended,
      confidence: ralphResult.confidence
    });

    // Add iteration info to output if extended mode was used
    let output = ralphResult.output;
    if (ralphResult.extended && ralphResult.iterations > 1) {
      output += `\n\n---\n*Ideas refined through ${ralphResult.iterations} iterations (Ralph Mode)*`;
    }

    return output;
  } catch (error) {
    log('error', 'Brainstorm failed', { error: error.message });
    return null;
  }
}

// Channel summarization
async function summarizeChannel(channelId, hours = 24, autoCreateJira = false) {
  const channelState = state.conversationHistory.get(channelId);
  if (!channelState || channelState.length === 0) {
    return "No recent messages to summarize.";
  }

  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  const recentMessages = channelState.filter(m => m.timestamp > cutoff);

  if (recentMessages.length === 0) {
    return `No messages in the last ${hours} hours.`;
  }

  const messageText = recentMessages.map(m =>
    `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.username || 'User'}: ${m.content}`
  ).join('\n');

  const systemPrompt = `You summarize channel discussions concisely and actionably.

Provide:
1. **Key Topics Discussed** (bullet points)
2. **Decisions Made** (if any)
3. **Action Items** (with owners if mentioned)
4. **Open Questions** (unresolved)
5. **Sentiment** (overall tone of discussion)

Keep it concise - max 300 words.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Summarize this channel discussion:\n\n${messageText}`
      }]
    });
    const summary = response.content[0].text;

    // Auto-create Jira issues from action items if enabled and Jira is configured
    if (autoCreateJira && config.jira?.enabled) {
      const jiraResults = await extractAndCreateJiraIssues(messageText, summary);
      if (jiraResults && jiraResults.length > 0) {
        const jiraSection = jiraResults.map(r =>
          `- **${r.key}**: ${r.summary} ([View](${r.url}))`
        ).join('\n');
        return summary + `\n\n---\n\n📋 **Jira Issues Created:**\n${jiraSection}`;
      }
    }

    return summary;
  } catch (error) {
    log('error', 'Summarization failed', { error: error.message });
    return null;
  }
}

// Extract action items and create Jira issues automatically
async function extractAndCreateJiraIssues(discussionText, summaryText) {
  if (!config.jira?.enabled) {
    log('info', 'Jira not enabled, skipping auto-creation');
    return [];
  }

  const systemPrompt = `You are analyzing a discussion to extract actionable items for a backlog.

Extract items that should become Jira issues. For each item, determine:
1. Type: "Task" (general work), "Story" (user-facing feature), or "Bug" (defect)
2. Summary: Clear, concise title (max 80 chars)
3. Description: Context from the discussion
4. Owner: Who was assigned (if mentioned)

Output as JSON array:
[
  {"type": "Task", "summary": "...", "description": "...", "owner": "..."},
  ...
]

Only include ACTIONABLE items - not questions, decisions, or general discussion points.
If no actionable items, return empty array: []`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Discussion:\n${discussionText}\n\nSummary:\n${summaryText}\n\nExtract actionable items for Jira:`
      }]
    });

    const jsonMatch = response.content[0].text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('info', 'No actionable items found for Jira');
      return [];
    }

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    log('info', 'Extracting Jira issues from discussion', { count: items.length });

    // Fetch existing backlog for duplicate checking
    const existingIssues = await getJiraBacklog();
    log('info', 'Checking against existing backlog', { existingCount: existingIssues.length });

    const results = [];
    const skipped = [];

    for (const item of items) {
      try {
        // Check for duplicates before creating
        const dupCheck = await checkForDuplicates(item.summary, existingIssues);

        if (dupCheck.isDuplicate && dupCheck.confidence !== 'low') {
          log('info', 'Skipping duplicate issue', { summary: item.summary, duplicates: dupCheck.duplicateKeys });
          skipped.push({
            summary: item.summary,
            duplicateOf: dupCheck.duplicateKeys,
            reason: dupCheck.reason
          });
          continue;
        }

        const description = item.owner
          ? `${item.description}\n\n**Assigned to:** ${item.owner}`
          : item.description;

        const result = await createJiraIssue(item.summary, description, item.type);
        if (result && result.success) {
          results.push({ ...result, summary: item.summary });
          log('info', 'Created Jira issue from discussion', { key: result.key, type: item.type });
        }
      } catch (err) {
        log('error', 'Failed to create Jira issue', { item: item.summary, error: err.message });
      }
    }

    // Return both created and skipped for reporting
    return { created: results, skipped };
  } catch (error) {
    log('error', 'Failed to extract Jira items', { error: error.message });
    return [];
  }
}

// Generate weekly product update
async function generateProductUpdate(repo) {
  const commits = await getRecentCommits(repo, 10);
  const prs = await getOpenPRs(repo);

  const systemPrompt = `You create engaging weekly product updates for team communication.

Format:
## 📦 Weekly Product Update

### 🚀 What Shipped
- ...

### 🔄 In Progress
- ...

### 📋 Coming Up
- ...

### 🎉 Highlights
- ...

Keep it concise, celebratory, and forward-looking.`;

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate a product update based on:\n\nRecent commits:\n${commits || 'None'}\n\nOpen PRs:\n${prs || 'None'}`
      }]
    });
    return response.content[0].text;
  } catch (error) {
    log('error', 'Product update failed', { error: error.message });
    return null;
  }
}

// Get AI response with context - McKinsey/HBS Quality Standards
// Check if message contains a question
function isQuestion(text) {
  const patterns = config.scout.questionPatterns;
  return patterns.some(pattern => new RegExp(pattern, 'i').test(text));
}

// Check if message contains trigger keywords
function hasTriggerKeyword(text) {
  const keywords = config.scout.triggerKeywords;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// ============ CONTEXT AWARENESS ============

// Detect social greetings
function isGreeting(text) {
  const greetingPatterns = [
    /^(hi|hey|hello|howdy|yo|sup|hiya)[\s!.,?]*$/i,
    /^good\s*(morning|afternoon|evening|day)[\s!.,?]*$/i,
    /^(welcome|thanks|thank you|cheers|appreciated)[\s!.,?]*$/i,
    /^(what'?s up|how'?s it going|how are you)[\s!?.,]*$/i,
    /^(gm|gn|gtg|brb|ttyl)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return greetingPatterns.some(p => p.test(cleanText));
}

// Detect farewell/signoff
function isFarewell(text) {
  const farewellPatterns = [
    /^(bye|goodbye|cya|see ya|later|peace|out)[\s!.,?]*$/i,
    /^(have a good|have a great|enjoy your)[\s\w]*$/i,
    /^(talk soon|catch you later|signing off)[\s!.,?]*$/i
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return farewellPatterns.some(p => p.test(cleanText));
}

// Detect simple acknowledgment
function isAcknowledgment(text) {
  const ackPatterns = [
    /^(ok|okay|k|got it|thanks|thx|ty|cool|nice|great|awesome|perfect|sounds good)[\s!.,?]*$/i,
    /^(will do|on it|sure|yep|yeah|yes|no|nope)[\s!.,?]*$/i,
    /^(👍|✅|🙏|💯|🎉|👏|🔥|💪)+$/
  ];
  const cleanText = text.replace(/@\w+/g, '').trim();
  return ackPatterns.some(p => p.test(cleanText));
}

// Detect Jira/backlog creation request in natural language
function isJiraRequest(text) {
  const lowerText = text.toLowerCase();
  const jiraKeywords = [
    'jira', 'backlog', 'issue', 'issues', 'ticket', 'tickets',
    'task', 'tasks', 'story', 'stories', 'bug', 'bugs'
  ];
  const actionKeywords = [
    'create', 'make', 'add', 'generate', 'build', 'write',
    'analyze', 'extract', 'find', 'identify', 'pull out',
    'turn into', 'convert'
  ];
  const contextKeywords = [
    'conversation', 'discussion', 'notes', 'meeting', 'chat',
    'action items', 'todo', 'to-do', 'to do'
  ];

  const hasJiraKeyword = jiraKeywords.some(k => lowerText.includes(k));
  const hasActionKeyword = actionKeywords.some(k => lowerText.includes(k));
  const hasContextKeyword = contextKeywords.some(k => lowerText.includes(k));

  // Must have jira-related keyword AND (action keyword OR context keyword)
  return hasJiraKeyword && (hasActionKeyword || hasContextKeyword);
}

// Detect GitHub request in natural language
function isGitHubRequest(text) {
  const lowerText = text.toLowerCase();
  const githubKeywords = [
    'github', 'git', 'repo', 'repository', 'commit', 'commits',
    'pr', 'pull request', 'pull requests', 'merge', 'branch'
  ];
  const actionKeywords = [
    'check', 'show', 'what', 'status', 'update', 'latest',
    'recent', 'open', 'pending', 'review'
  ];

  const hasGitHubKeyword = githubKeywords.some(k => lowerText.includes(k));
  const hasActionKeyword = actionKeywords.some(k => lowerText.includes(k));

  return hasGitHubKeyword && hasActionKeyword;
}

// Handle natural language GitHub request
async function handleGitHubRequest(channelId, message) {
  log('info', 'Processing natural language GitHub request', { channelId });

  // Try to extract repo name from message or use default
  const repoMatch = message.match(/(?:repo|repository)[\s:]*([^\s,]+)/i);
  const repo = repoMatch ? repoMatch[1] : null;

  try {
    if (!repo) {
      // General GitHub status
      return `📦 **GitHub Status**\n\nTo check a specific repo, mention it like: "what's the status of repo-name on GitHub"\n\nOr use: \`!github repo-name\``;
    }

    const commits = await getRecentCommits(repo, 5);
    const prs = await getOpenPRs(repo);
    const issues = await getOpenIssues(repo);

    return `📦 **GitHub: ${repo}**\n\n**Recent Commits:**\n${commits || '_None found_'}\n\n**Open PRs:**\n${prs || '_None_'}\n\n**Open Issues:**\n${issues || '_None_'}`;
  } catch (error) {
    log('error', 'Failed to process GitHub request', { error: error.message });
    return `Sorry, I couldn't fetch GitHub info. Try: \`!github repo-name\``;
  }
}

// Handle natural language Jira request
// Detect Jira management intent from message
function detectJiraIntent(message) {
  const lowerMsg = message.toLowerCase();

  // Check for issue key pattern (e.g., SCRUM-123)
  const issueKeyMatch = message.match(/\b([A-Z]+-\d+)\b/);
  const issueKey = issueKeyMatch ? issueKeyMatch[1] : null;

  // Detect intent
  if (lowerMsg.includes('show') && (lowerMsg.includes('backlog') || lowerMsg.includes('issues') || lowerMsg.includes('tickets'))) {
    return { action: 'list', issueKey };
  }
  if (lowerMsg.includes('delete') || lowerMsg.includes('remove')) {
    return { action: 'delete', issueKey };
  }
  if (lowerMsg.includes('update') || lowerMsg.includes('change') || lowerMsg.includes('modify') || lowerMsg.includes('edit')) {
    return { action: 'update', issueKey };
  }
  if (lowerMsg.includes('done') || lowerMsg.includes('complete') || lowerMsg.includes('finish') || lowerMsg.includes('close')) {
    return { action: 'transition', status: 'Done', issueKey };
  }
  if (lowerMsg.includes('in progress') || lowerMsg.includes('start') || lowerMsg.includes('working on')) {
    return { action: 'transition', status: 'In Progress', issueKey };
  }
  if (lowerMsg.includes('reopen') || lowerMsg.includes('todo') || lowerMsg.includes('to do')) {
    return { action: 'transition', status: 'To Do', issueKey };
  }

  // Default: create from conversation
  return { action: 'create', issueKey };
}

async function handleJiraRequest(channelId, message) {
  if (!config.jira?.enabled) {
    return "📋 Jira integration isn't configured yet. Ask your admin to set it up!";
  }

  log('info', 'Processing natural language Jira request', { channelId });

  const intent = detectJiraIntent(message);
  log('info', 'Detected Jira intent', intent);

  // Handle different intents
  switch (intent.action) {
    case 'list': {
      const issues = await getJiraBacklog();
      if (!issues || issues.length === 0) {
        return "📋 **Backlog is empty!** No open issues found.";
      }
      const issueList = issues.slice(0, 15).map(i => {
        const status = i.fields.status?.name || 'Unknown';
        const type = i.fields.issuetype?.name || 'Task';
        return `• **${i.key}** [${type}] ${i.fields.summary} _(${status})_`;
      }).join('\n');
      return `📋 **Current Backlog** (${issues.length} issues):\n\n${issueList}${issues.length > 15 ? '\n\n_...and ' + (issues.length - 15) + ' more_' : ''}`;
    }

    case 'delete': {
      if (!intent.issueKey) {
        return "🗑️ Which issue should I delete? Please mention the issue key (e.g., SCRUM-123).";
      }
      const result = await deleteJiraIssue(intent.issueKey);
      if (result.success) {
        return `🗑️ **Deleted ${intent.issueKey}** - Issue has been removed from the backlog.`;
      }
      return `❌ Couldn't delete ${intent.issueKey}: ${result.error}`;
    }

    case 'update': {
      if (!intent.issueKey) {
        return "✏️ Which issue should I update? Please mention the issue key (e.g., SCRUM-123) and what to change.";
      }
      // Use AI to extract what to update
      const updatePrompt = `Extract what should be updated in Jira issue ${intent.issueKey} from this message.
Output JSON: {"summary": "new title or null", "description": "new description or null", "priority": "High/Medium/Low or null"}
Only include fields that should change.`;
      try {
        const response = await anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 256,
          system: updatePrompt,
          messages: [{ role: 'user', content: message }]
        });
        const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const updates = JSON.parse(jsonMatch[0]);
          const filtered = {};
          if (updates.summary) filtered.summary = updates.summary;
          if (updates.description) filtered.description = updates.description;
          if (updates.priority) filtered.priority = updates.priority;

          if (Object.keys(filtered).length === 0) {
            return `✏️ I couldn't determine what to update. Try: "update ${intent.issueKey} title to 'New Title'" or "change ${intent.issueKey} priority to High"`;
          }

          const result = await updateJiraIssue(intent.issueKey, filtered);
          if (result.success) {
            return `✅ **Updated ${intent.issueKey}**\n\nChanges applied: ${Object.keys(filtered).join(', ')}\n[View Issue](${result.url})`;
          }
          return `❌ Couldn't update ${intent.issueKey}: ${result.error}`;
        }
      } catch (e) {
        log('error', 'Update extraction failed', { error: e.message });
      }
      return `✏️ I couldn't understand what to update. Try being more specific about what to change.`;
    }

    case 'transition': {
      if (!intent.issueKey) {
        return `📊 Which issue should I mark as ${intent.status}? Please mention the issue key (e.g., SCRUM-123).`;
      }
      const result = await transitionJiraIssue(intent.issueKey, intent.status);
      if (result.success) {
        return `✅ **${intent.issueKey}** is now **${result.newStatus}**`;
      }
      return `❌ Couldn't change status: ${result.error}`;
    }

    case 'create':
    default: {
      // Fetch full channel history from Mattermost API
      const channelHistory = await fetchChannelHistory(channelId, 100);

      if (!channelHistory || channelHistory.length < 2) {
        return "I don't see enough conversation history to analyze. Have a discussion first, then ask me to create backlog items!";
      }

      log('info', 'Fetched channel history for Jira analysis', { messageCount: channelHistory.length });

      const messageText = channelHistory.map(m =>
        `[${m.username}]: ${m.content}`
      ).join('\n');

      const summaryPrompt = `Summarize this team discussion concisely, highlighting:
1. Key decisions made
2. Action items identified
3. Open questions

Keep it under 150 words.`;

      try {
        const summaryResponse = await anthropic.messages.create({
          model: config.anthropic.model,
          max_tokens: 512,
          system: summaryPrompt,
          messages: [{ role: 'user', content: messageText }]
        });
        const summary = summaryResponse.content[0].text;

        const jiraResults = await extractAndCreateJiraIssues(messageText, summary);

        // Handle new return format with created and skipped
        if (jiraResults && jiraResults.created) {
          let response = '';

          if (jiraResults.created.length > 0) {
            const jiraSection = jiraResults.created.map(r =>
              `• **${r.key}**: ${r.summary} ([View](${r.url}))`
            ).join('\n');
            response += `📋 **Created ${jiraResults.created.length} issue${jiraResults.created.length > 1 ? 's' : ''}:**\n\n${jiraSection}`;
          }

          if (jiraResults.skipped && jiraResults.skipped.length > 0) {
            const skippedSection = jiraResults.skipped.map(s =>
              `• "${s.summary}" → duplicate of ${s.duplicateOf.join(', ')}`
            ).join('\n');
            response += `\n\n⚠️ **Skipped ${jiraResults.skipped.length} duplicate${jiraResults.skipped.length > 1 ? 's' : ''}:**\n${skippedSection}`;
          }

          if (response) {
            return response + `\n\n**Summary:**\n${summary}`;
          }
        }

        // Legacy format or no results
        if (jiraResults && Array.isArray(jiraResults) && jiraResults.length > 0) {
          const jiraSection = jiraResults.map(r =>
            `• **${r.key}**: ${r.summary} ([View](${r.url}))`
          ).join('\n');
          return `📋 **Created ${jiraResults.length} issue${jiraResults.length > 1 ? 's' : ''}:**\n\n${jiraSection}\n\n**Summary:**\n${summary}`;
        }

        return `📝 **Summary:**\n${summary}\n\n_I didn't find specific actionable items to create as Jira issues. If you have specific tasks in mind, just tell me what to create!_`;
      } catch (error) {
        log('error', 'Failed to process Jira request', { error: error.message });
        return "Sorry, I had trouble analyzing the conversation. Try again in a moment.";
      }
    }
  }
}

// Classify message context
function classifyMessage(text, recentMessages = []) {
  const cleanText = text.replace(/@\w+/g, '').trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;

  // Check explicit patterns first
  if (isGreeting(text)) return { type: 'greeting', confidence: 'high' };
  if (isFarewell(text)) return { type: 'farewell', confidence: 'high' };
  if (isAcknowledgment(text)) return { type: 'acknowledgment', confidence: 'high' };

  // Check for commands
  if (text.startsWith('!')) return { type: 'command', confidence: 'high' };

  // Short messages with @mention - likely casual or need clarification
  if (wordCount <= 3) {
    return { type: 'brief', confidence: 'medium', needsClarification: true };
  }

  // Check for clear questions
  if (isQuestion(text) && wordCount >= 5) {
    return { type: 'question', confidence: 'high' };
  }

  // Check for discussion topics
  if (hasTriggerKeyword(text) && wordCount >= 5) {
    return { type: 'topic', confidence: 'high' };
  }

  // Medium length messages - could be various things
  if (wordCount >= 4 && wordCount <= 10) {
    return { type: 'statement', confidence: 'medium', needsClarification: true };
  }

  // Longer messages - likely substantive
  if (wordCount > 10) {
    return { type: 'discussion', confidence: 'high' };
  }

  return { type: 'unclear', confidence: 'low', needsClarification: true };
}

// LLM-based intent classification - replaces all declarative keyword matching
async function classifyIntent(message, recentMessages = [], channelName = '') {
  // Commands are always handled directly
  if (message.trim().startsWith('!')) {
    return {
      respond: true,
      intent: 'command',
      reason: 'explicit command'
    };
  }

  // Build recent context
  const recentContext = recentMessages.slice(-5).map(m =>
    `[${m.username || 'user'}]: ${m.content}`
  ).join('\n');

  const prompt = `You are classifying user intent for Scout, a Research & PM Assistant bot with social intelligence.

MESSAGE: "${message.substring(0, 1500)}"

RECENT CHANNEL CONTEXT:
${recentContext || '(no recent messages)'}

CHANNEL: ${channelName || 'unknown'}

Respond with JSON only:
{
  "respond": true/false,          // Should Scout respond?
  "intent": "string",             // See INTENTS below
  "reason": "brief explanation",
  "reaction": "emoji or null",    // If not responding, suggest reaction (👍, 🙌, 🎉, 💡, etc.)
  "load_history": true/false,     // Load channel history for context?
  "time_range_hours": number/null, // Hours of history to load (null = default 8)
  "persona": "string"             // One of: default, research, brainstorm, standup, retro
}

INTENTS:
- "summary_request": User ASKS FOR a summary/recap ("summarize", "catch me up", "what'd I miss")
- "feedback_request": User shares content wanting analysis ("what do you think?", "review this", "thoughts on")
- "sharing_info": Sharing info, not asking for feedback (react only)
- "question": Direct question to Scout
- "help_request": Someone is stuck, blocked, or needs help (signals: "help", "stuck", "blocker", "anyone know", "struggling", "can't figure out")
- "research_request": Wants Scout to research/investigate something
- "brainstorm_request": Wants help ideating/brainstorming ("ideas", "thoughts on approach")
- "jira_request": Asking about Jira/tickets/sprints/issues
- "github_request": Asking about GitHub/repos/PRs/code
- "greeting": Simple hello/hi (respond warmly but briefly)
- "thanks": Thanking Scout (react 👍, don't respond)
- "celebration": Sharing a win/success (react 🎉, maybe brief congrats)
- "standup_update": Sharing standup-style update (what I did, doing, blockers)
- "casual_chat": Casual conversation
- "unclear": Can't determine (ask clarifying question)

SOCIAL INTELLIGENCE - Read the room:
1. CONTEXT MATTERS: Analyze the FULL message AND recent channel context to understand actual intent
2. HELP SIGNALS: Watch for "help", "stuck", "blocker", "question", "anyone", "ideas", "thoughts", "feedback", "struggling"
3. QUESTION PATTERNS: Messages ending in "?" or starting with who/what/when/where/why/how/can/could/would/should
4. EMOTIONAL CUES: Frustration ("ugh", "struggling", "stuck"), excitement ("finally!", "we did it!", "shipped!"), uncertainty ("not sure", "maybe", "wondering if")
5. IMPLICIT ASKS: "I can't figure out X" = help_request even without explicit ask. "Here's what happened..." + no question = sharing_info
6. MEETING NOTES/SUMMARIES: If user shares detailed notes and asks "what do you think?" or "@scout thoughts?" = feedback_request (respond substantively!)
7. DON'T OVER-RESPOND: Good news without a question = react with 🎉 instead of long response
8. SUBSTANTIVE ENGAGEMENT: Long messages with real content (meeting notes, updates, proposals) deserve thoughtful analysis when feedback is requested

WHEN TO RESPOND vs REACT:
- respond=true: Questions, help requests, feedback requests, research asks, brainstorming
- respond=false + reaction: Thanks (👍), celebrations (🎉), sharing without asking (👀 or 💡)
- load_history=true: For summary_request, OR when historical context helps answer the question
- Match persona to request type (brainstorm_request → brainstorm, research_request → research)`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      log('info', 'Intent classified', {
        message: message.substring(0, 50),
        intent: result.intent,
        respond: result.respond,
        load_history: result.load_history
      });
      return result;
    }
    // Fallback
    return { respond: true, intent: 'unclear', reason: 'parse_fallback', persona: 'default' };
  } catch (error) {
    log('error', 'Intent classification failed', { error: error.message });
    return { respond: true, intent: 'unclear', reason: 'error_fallback', persona: 'default' };
  }
}

// Generate appropriate greeting response - value-focused, 20 words or less, varied structure
function getGreetingResponse() {
  const responses = [
    // Question-led
    "👋 What's puzzling you? Give me a topic and I'll have insights in minutes.",
    "Hey! Got a question that needs answers? That's my specialty.",
    // Action/Result-led
    "Hi! Research that drives action - what should we explore?",
    "👋 Smarter decisions, faster. What's on your mind?",
    // Invitation-led
    "Hey! Throw me a challenge - I'll turn it into actionable insights.",
    // Direct value
    "Hi! 🔬 Your questions, answered with McKinsey-quality analysis. What do you need?"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate farewell response
function getFarewellResponse() {
  const responses = [
    "Catch you later! 👋",
    "See ya!",
    "Later! Ping me anytime.",
    "Take care! 🙌",
    "👋"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate acknowledgment response (or none)
function getAcknowledgmentResponse() {
  // Often don't need to respond to acknowledgments
  if (Math.random() < 0.7) return null;
  const responses = ["👍", "🙌", "✨"];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate clarifying question
function getClarifyingQuestion(messageType, originalText) {
  const questions = [
    "What would you like me to help with?",
    "Need me to research something, brainstorm, or something else?",
    "Want me to dig into that, or just chatting?",
    "Should I look into this further?",
    "Anything specific you'd like me to do with that?"
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

// Polls moved to Socialite bot - use !pollhelp

// ============ REMINDERS ============
const reminders = new Map(); // id -> { channelId, message, time, userId }

function parseTimeString(timeStr) {
  const match = timeStr.match(/(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)/i);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return num * 60 * 1000;
  if (unit.startsWith('h')) return num * 60 * 60 * 1000;
  if (unit.startsWith('d')) return num * 24 * 60 * 60 * 1000;
  return null;
}

async function setReminder(channelId, userId, timeStr, message) {
  const delay = parseTimeString(timeStr);
  if (!delay) {
    return "I couldn't understand that time. Try: `!remindme 30m Check the build` or `!remindme 2h Review PR`";
  }

  const reminderId = Date.now().toString();
  const reminderTime = new Date(Date.now() + delay);

  reminders.set(reminderId, {
    channelId,
    userId,
    message,
    time: reminderTime
  });

  setTimeout(async () => {
    const reminder = reminders.get(reminderId);
    if (reminder) {
      await postMessage(reminder.channelId, `⏰ **Reminder for <@${reminder.userId}>:**\n\n${reminder.message}`);
      reminders.delete(reminderId);
    }
  }, delay);

  const timeDisplay = reminderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `✅ Got it! I'll remind you at **${timeDisplay}**: "${message}"`;
}

// ============ REACTIONS & CHEERLEADING ============
async function addReaction(postId, emojiName) {
  try {
    await mmApi('/reactions', 'POST', {
      user_id: state.botUserId,
      post_id: postId,
      emoji_name: emojiName
    });
    return true;
  } catch (error) {
    log('error', 'Failed to add reaction', { error: error.message });
    return false;
  }
}

// Detect wins and celebrations
function detectWin(text) {
  const winPatterns = [
    /shipped|launched|released|deployed|went live/i,
    /fixed|resolved|solved|closed/i,
    /completed|finished|done|accomplished/i,
    /merged|approved|passed/i,
    /milestone|achievement|breakthrough/i,
    /\b(won|win|winning)\b/i,
    /great job|well done|kudos|props|shoutout/i,
    /🎉|🚀|✅|💪|🏆|⭐/
  ];
  return winPatterns.some(p => p.test(text));
}

// Cheerleading responses
const cheerMessages = [
  "🎉 That's a win worth celebrating!",
  "🚀 Crushing it! Keep that momentum going.",
  "💪 Love seeing progress like this!",
  "⭐ This is the kind of update that makes my day!",
  "🏆 Another one in the books. Well done!",
  "🔥 On fire! What's the secret sauce?",
  "👏 This deserves recognition. Great work!",
  "✨ Momentum is everything - and you've got it!"
];

function getCheerMessage() {
  return cheerMessages[Math.floor(Math.random() * cheerMessages.length)];
}

// ============ FILE & VIDEO DETECTION ============

// Download file content from Mattermost
async function downloadFile(fileId) {
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    log('error', 'Failed to download file', { fileId, error: error.message });
    return null;
  }
}

// Analyze image using Claude Vision
async function analyzeImage(imageBuffer, mediaType, userMessage = '') {
  const imageBase64 = imageBuffer.toString('base64');

  const systemPrompt = `You are Scout, a helpful assistant with vision capabilities.
You can see and analyze images. When analyzing an image:
- Describe what you see clearly and concisely
- Answer any specific questions the user has about the image
- Provide relevant insights or observations
- If it's a diagram, chart, or document, extract key information
- If it's code or a screenshot, help debug or explain what's shown
- If it's a photo, describe the scene and any notable elements

Be direct and helpful. You CAN see images - don't say otherwise.`;

  const content = [];

  // Add user message if provided
  if (userMessage && userMessage.trim()) {
    // Remove the @scout mention for cleaner context
    const cleanMessage = userMessage.replace(/@scout/gi, '').trim();
    content.push({ type: 'text', text: cleanMessage || 'What do you see in this image? Please describe it and provide any relevant insights.' });
  } else {
    content.push({ type: 'text', text: 'What do you see in this image? Please describe it and provide any relevant insights.' });
  }

  // Add the image
  content.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: imageBase64
    }
  });

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: content
      }]
    });

    return response.content.find(c => c.type === 'text')?.text || 'I could not analyze the image.';
  } catch (error) {
    log('error', 'Image analysis failed', { error: error.message });
    return `I encountered an error analyzing the image: ${error.message}`;
  }
}

// Extract and parse PDF using shared module
async function extractPdfText(fileId, fileName, fileSize = 0) {
  try {
    const buffer = await downloadFile(fileId);
    if (!buffer) return null;

    return await pdfUtils.parsePdf(buffer, fileName, fileSize, log);
  } catch (error) {
    log('error', 'Failed to extract PDF', { fileName, error: error.message });
    return null;
  }
}

// Extract and parse DOCX using shared module
async function extractDocxText(fileId, fileName, fileSize = 0) {
  try {
    const buffer = await downloadFile(fileId);
    if (!buffer) return null;

    return await pdfUtils.parseDocx(buffer, fileName, fileSize, log);
  } catch (error) {
    log('error', 'Failed to extract DOCX', { fileName, error: error.message });
    return null;
  }
}

async function handleFileUpload(post, shouldAnalyzeImages = false) {
  if (!post.file_ids || post.file_ids.length === 0) return;

  try {
    // Get file info with IDs for downloading
    const files = await Promise.all(
      post.file_ids.map(async (id) => {
        const info = await mmApi(`/files/${id}/info`);
        return { ...info, fileId: id };
      })
    );

    // Add all files to the index
    for (const f of files) {
      fileIndex.addFile(f, post.channel_id);
    }

    const fileDescriptions = files.map(f => {
      const ext = f.extension?.toLowerCase() || '';
      const size = (f.size / 1024).toFixed(1);
      const mimeType = f.mime_type || '';

      if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
        return { type: 'video', name: f.name, size, fileId: f.fileId, mimeType };
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        // Map extension to proper media type for Claude Vision
        const mediaTypeMap = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp'
        };
        return { type: 'image', name: f.name, size, fileId: f.fileId, mediaType: mediaTypeMap[ext] || mimeType };
      } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return { type: 'document', name: f.name, size, fileId: f.fileId, mimeType };
      } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
        return { type: 'archive', name: f.name, size, fileId: f.fileId, mimeType };
      }
      return { type: 'file', name: f.name, size, fileId: f.fileId, mimeType };
    });

    // React to the upload
    const reactions = {
      video: 'movie_camera',
      image: 'frame_with_picture',
      document: 'page_facing_up',
      archive: 'package',
      file: 'paperclip'
    };

    for (const file of fileDescriptions) {
      await addReaction(post.id, reactions[file.type] || 'paperclip');
    }

    // Process images with Claude Vision if @scout was mentioned
    const imageFiles = fileDescriptions.filter(f => f.type === 'image');
    if (imageFiles.length > 0 && shouldAnalyzeImages) {
      // Add eyes reaction to show we're analyzing
      await addReaction(post.id, 'eyes');

      const fileReplyTo = post.root_id || post.id;

      for (const imageFile of imageFiles) {
        log('info', 'Analyzing image with Claude Vision', { fileName: imageFile.name, fileId: imageFile.fileId });

        // Download image
        const imageBuffer = await downloadFile(imageFile.fileId);

        if (imageBuffer) {
          // Get the user's message to use as context for the analysis
          const userMessage = post.message || '';

          // Analyze the image with Claude Vision
          const analysis = await analyzeImage(imageBuffer, imageFile.mediaType, userMessage);

          // Post the analysis
          await postMessage(post.channel_id, analysis, fileReplyTo);
        } else {
          await postMessage(post.channel_id,
            `I couldn't download the image **${imageFile.name}** for analysis. Please try uploading it again.`,
            fileReplyTo
          );
        }
      }
      return; // Already handled images, don't show generic messages
    }

    // For images when not auto-analyzing, offer to help
    if (imageFiles.length > 0 && !shouldAnalyzeImages) {
      const fileReplyTo = post.root_id || post.id;
      const imageNames = imageFiles.map(f => f.name).join(', ');
      await postMessage(post.channel_id,
        `I can see you've shared an image: **${imageNames}**\n\nMention me (\`@scout\`) with the image if you'd like me to analyze it!`,
        fileReplyTo
      );
    }

    // Extract and store document content using shared module
    const pdfFiles = files.filter(f => f.extension?.toLowerCase() === 'pdf');
    const docxFiles = files.filter(f => f.extension?.toLowerCase() === 'docx');
    const extractedDocs = [];

    // Process PDFs
    for (const pdfFile of pdfFiles) {
      const pdfContent = await extractPdfText(pdfFile.id, pdfFile.name, pdfFile.size || 0);
      if (pdfContent && pdfContent.text) {
        extractedDocs.push({
          name: pdfFile.name,
          type: 'pdf',
          pages: pdfContent.pages,
          sizeMB: pdfContent.sizeMB,
          chunks: pdfContent.chunks?.length || 0,
          structured: pdfContent.structured || false
        });

        // Store in channel memory using shared formatter
        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (pdfContent.chunks && pdfContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(pdfFile.name, pdfContent.chunks);
            channelState.messages.push(...memoryEntries);
            log('info', 'Stored PDF chunks in channel memory', { fileName: pdfFile.name, chunks: pdfContent.chunks.length, structured: pdfContent.structured });
          } else {
            channelState.messages.push({
              role: 'system',
              content: `[PDF Document: ${pdfFile.name} - ${pdfContent.pages} pages]\n${pdfContent.text.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }
        }

        // Index into vector store for semantic search (non-blocking)
        pdfUtils.indexDocument(pdfContent, pdfFile.name, post.channel_id, log)
          .then(result => {
            if (result.indexed > 0) {
              log('info', 'PDF indexed for semantic search', { fileName: pdfFile.name, chunks: result.indexed });
            }
          })
          .catch(err => log('warn', 'PDF vector indexing failed', { fileName: pdfFile.name, error: err.message }));
      }
    }

    // Process DOCX files
    for (const docxFile of docxFiles) {
      const docxContent = await extractDocxText(docxFile.id, docxFile.name, docxFile.size || 0);
      if (docxContent && docxContent.text) {
        extractedDocs.push({
          name: docxFile.name,
          type: 'docx',
          pages: docxContent.pages,
          sizeMB: docxContent.sizeMB,
          chunks: docxContent.chunks?.length || 0,
          structured: docxContent.structured || false
        });

        // Store in channel memory using shared formatter
        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (docxContent.chunks && docxContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(docxFile.name, docxContent.chunks);
            channelState.messages.push(...memoryEntries);
            log('info', 'Stored DOCX chunks in channel memory', { fileName: docxFile.name, chunks: docxContent.chunks.length, structured: docxContent.structured });
          } else {
            channelState.messages.push({
              role: 'system',
              content: `[DOCX Document: ${docxFile.name} - ~${docxContent.pages} pages]\n${docxContent.text.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }
        }

        // Index into vector store for semantic search (non-blocking)
        pdfUtils.indexDocument(docxContent, docxFile.name, post.channel_id, log)
          .then(result => {
            if (result.indexed > 0) {
              log('info', 'DOCX indexed for semantic search', { fileName: docxFile.name, chunks: result.indexed });
            }
          })
          .catch(err => log('warn', 'DOCX vector indexing failed', { fileName: docxFile.name, error: err.message }));
      }
    }

    // Process spreadsheet files (XLS, XLSX, CSV)
    const spreadsheetFiles = files.filter(f => spreadsheetUtils.isSpreadsheet(f.name));
    for (const xlsFile of spreadsheetFiles) {
      try {
        const buffer = await downloadFile(xlsFile.id);
        if (buffer) {
          const result = spreadsheetUtils.processSpreadsheetAttachment(buffer, xlsFile.name, {
            maxRowsPerSheet: 100,
            format: 'markdown'
          });

          if (result.success) {
            extractedDocs.push({
              name: xlsFile.name,
              type: result.type.replace('.', ''),
              pages: result.sheetCount,
              sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
              chunks: 1,
              structured: true
            });

            // Store in channel memory
            const channelState = state.channels.get(post.channel_id);
            if (channelState) {
              channelState.messages.push({
                role: 'system',
                content: `[Spreadsheet: ${xlsFile.name} - ${result.sheetCount} sheets, ${result.rowCount} rows]\n${result.context.substring(0, 50000)}`,
                timestamp: Date.now()
              });
              log('info', 'Stored spreadsheet in channel memory', {
                fileName: xlsFile.name,
                sheets: result.sheetCount,
                rows: result.rowCount
              });
            }

            // Mark as processed in file index
            fileIndex.markProcessed(xlsFile.id);

            // Index into vector store for semantic search (non-blocking)
            const xlsContent = {
              text: result.context,
              chunks: [{
                text: result.context,
                pageNum: 1,
                heading: `Spreadsheet: ${xlsFile.name}`
              }]
            };
            pdfUtils.indexDocument(xlsContent, xlsFile.name, post.channel_id, log)
              .then(indexResult => {
                if (indexResult.indexed > 0) {
                  log('info', 'Spreadsheet indexed for semantic search', { fileName: xlsFile.name });
                }
              })
              .catch(err => log('warn', 'Spreadsheet vector indexing failed', { fileName: xlsFile.name, error: err.message }));
          } else {
            log('warn', 'Spreadsheet parsing failed', { fileName: xlsFile.name, error: result.error });
          }
        }
      } catch (error) {
        log('error', 'Failed to process spreadsheet', { fileName: xlsFile.name, error: error.message });
      }
    }

    // Generate summary message using shared helper
    const fileReplyTo = post.root_id || post.id;
    if (extractedDocs.length > 0) {
      const summaryMsg = pdfUtils.generateDocSummaryMessage(extractedDocs, 'scout');
      await postMessage(post.channel_id, summaryMsg, fileReplyTo);
    } else if (fileDescriptions.some(f => f.type === 'document')) {
      const docNames = fileDescriptions.filter(f => f.type === 'document').map(f => f.name).join(', ');
      await postMessage(post.channel_id,
        `📄 I see you've shared: **${docNames}**\n\nNeed me to help discuss or analyze what's in there? Just ask!`,
        fileReplyTo
      );
    }

    if (fileDescriptions.some(f => f.type === 'video')) {
      await postMessage(post.channel_id,
        `🎬 Video uploaded! If you want the team to watch and discuss, I can set a reminder or create a discussion thread. Just say the word!`,
        fileReplyTo
      );
    }

  } catch (error) {
    log('error', 'Failed to handle file upload', { error: error.message });
  }
}

// ============ DISCUSSION LEADERSHIP ============
async function startDiscussion(channelId, topic) {
  const systemPrompt = `You are a skilled discussion facilitator. Generate an engaging discussion starter for a team channel.

Create:
1. A thought-provoking opening question or statement
2. 2-3 follow-up angles to explore
3. A "devil's advocate" perspective to consider
4. A call-to-action for team members

Make it conversational, not academic. Use varied opening styles - curious, provocative, or collaborative.
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

    return `💬 **Let's Discuss: ${topic}**\n\n${response.content[0].text}`;
  } catch (error) {
    log('error', 'Discussion generation failed', { error: error.message });
    return null;
  }
}

// Topic engagement - seed conversations with insights
async function engageTopic(channelId, topic, context = '') {
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
async function pinMessage(postId) {
  try {
    await mmApi(`/posts/${postId}/pin`, 'POST');
    return true;
  } catch (error) {
    log('error', 'Failed to pin message', { error: error.message });
    return false;
  }
}

// Get AI response with tool support
async function getAIResponse(messages, persona = 'default', additionalContext = '') {
  const scoutPreamble = `
## YOUR IDENTITY & STYLE
You are Scout, a knowledgeable Research & PM Assistant focused on deep analysis, strategic thinking, and helping teams make informed decisions.

**Core Principles:**
- **Analytical:** Provide well-researched, evidence-based insights
- **Strategic:** Help identify patterns, risks, and opportunities
- **Thorough:** When asked to research, go deep; when asked for quick answers, be concise
- **Proactive:** Surface relevant information and connections

**Communication Style:**
- Use clear, professional language
- Structure information with headers and bullet points when helpful
- Cite sources and provide context
- Be direct but thoughtful
`;

  const personas = {
    default: `${scoutPreamble}
You help teams with research, analysis, and project management.

Available commands:
- !research [topic] - Deep research analysis
- !brainstorm [topic] - Creative ideation with probabilities
- !summary [hours] - Summarize channel discussion
- !github [repo] - GitHub status update
- !story/!bug/!task [description] - Create Jira issues

Be helpful, thorough, and action-oriented.`,

    research: `${scoutPreamble}
You are conducting research. Provide:
- Key findings with evidence
- Multiple perspectives
- Actionable recommendations
- Areas of uncertainty

Be thorough but organized.`,

    brainstorm: `${scoutPreamble}
You are facilitating creative ideation. Generate diverse ideas, evaluate them with rough probability estimates, and help identify the most promising directions.`,

    standup: `${scoutPreamble}
You help with standup updates. Keep things focused on blockers, progress, and next steps.`,

    retro: `${scoutPreamble}
You facilitate retrospectives. Help teams reflect on what went well, what could improve, and concrete action items.`
  };

  const tools = [{
    name: "fetch_url",
    description: "REQUIRED: You MUST use this tool whenever a user provides a URL (http/https) and asks for analysis, summary, or details about it. Do not refuse or say you cannot access URLs. Use this tool to read the website content.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to fetch." }
      },
      required: ["url"]
    }
  }];

  try {
    let systemPrompt = personas[persona] || personas.default;

    if (additionalContext) {
      systemPrompt += `

## CONTEXT & MEMORY
${additionalContext}`;
    }

    // Force tool awareness
    systemPrompt += `

## TOOLS & CAPABILITIES
You have a tool named 'fetch_url' which allows you to read website content. You MUST use this tool if the user provides a URL and wants information about it. Do not say you cannot browse the internet - you CAN fetch URLs.`;

    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

    // Tool loop
    let response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: currentMessages,
      tools: tools
    });

    while (response.stop_reason === "tool_use") {
      const toolBlock = response.content.find(c => c.type === "tool_use");
      if (!toolBlock) break;

      const { name, input, id } = toolBlock;
      let toolResult = "";

      if (name === "fetch_url") {
        log('info', `Tool execution: fetch_url(${input.url})`);
        toolResult = await fetchWebPage(input.url);
      }

      // Add assistant's tool use request
      currentMessages.push({ role: "assistant", content: response.content });

      // Add tool result
      currentMessages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: id,
          content: toolResult
        }]
      });

      // Re-prompt LLM
      response = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: currentMessages,
        tools: tools
      });
    }

    return response.content.find(c => c.type === "text")?.text || "";

  } catch (error) {
    log('error', 'AI response error', { error: error.message });
    return "I encountered an error processing that request.";
  }
}

// Parse commands from message
// Parse dashboard command arguments
function parseDashboardArgs(argsString) {
  const defaults = { days: 7, label: 'Weekly' };
  if (!argsString) return defaults;

  const args = argsString.toLowerCase().split(/\s+/);
  const result = { ...defaults };

  for (const arg of args) {
    if (arg.match(/^\d+d?$/)) {
      result.days = parseInt(arg);
      if (result.days === 14) result.label = 'Bi-Weekly';
      else if (result.days === 30) result.label = 'Monthly';
      else result.label = `${result.days}-Day`;
    } else if (arg === 'weekly') {
      result.days = 7;
      result.label = 'Weekly';
    } else if (arg === 'biweekly') {
      result.days = 14;
      result.label = 'Bi-Weekly';
    } else if (arg === 'monthly') {
      result.days = 30;
      result.label = 'Monthly';
    }
  }

  return result;
}

function parseCommand(message) {
  const commands = {
    research: /!research\s+(.+)/i,
    brainstorm: /!brainstorm\s+(.+)/i,
    github: /!github\s+(\S+)/i,
    summary: /!summary(?:\s+(\d+))?/i,
    backlog: /!backlog(?:\s+(\d+))?/i,
    update: /!update\s+(\S+)/i,
    issue: /!issue\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"/i,
    config: /^!config$/i,
    setfreq: /^!setfreq\s+(quiet|normal|active)$/i,
    setdepth: /^!setdepth\s+(quick|standard|deep)$/i,
    focus: /^!focus\s+(.+)/i,
    remind: /^!remind\s+(.+)/i,
    feedback: /^!feedback\s+(.+)/i,
    askme: /^!askme$/i,
    prefs: /^!prefs$/i,
    // Polls moved to Socialite bot - use !pollhelp
    remindme: /^!remindme\s+(\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days))\s+(.+)/i,
    discuss: /^!discuss\s+(.+)/i,
    engage: /^!engage\s+(.+)/i,
    cheer: /^!cheer\s+(.+)/i,
    pin: /^!pin$/i,
    help: /^!scout\s*help$/i,
    // Command menu
    scout: /^!scout$/i,
    scoutmenu: /^!scout\s+(research|dashboard|jira|github|queues|settings|engage)$/i,
    // GitHub documentation
    save: /^!save\s+(.+)/i,
    savelast: /^!savelast\s+(.+)/i,
    // Jira
    story: /^!story\s+(.+)/i,
    bug: /^!bug\s+(.+)/i,
    task: /^!task\s+(.+)/i,
    jira: /^!jira\s+(.+)/i,
    backlog: /^!backlog\s+(.+)/i,
    // Dashboard
    dashboard: /^!dashboard(?:\s+(.+))?$/i,
    // Research & Follow-up queues
    researchqueue: /^!research-queue(?:\s+(all))?$/i,
    followupqueue: /^!followup-queue(?:\s+(all))?$/i,
    // Document index
    docs: /^!docs(?:\s+(stats|list|search)\s*(.*))?$/i,
    // Semantic memory
    memory: /^!memory(?:\s+(stats|search|graph)\s*(.*))?$/i,
    // File operations (missing patterns - fix 2026-01-04)
    // No ^ anchor so these work with @scout prefix
    files: /!files(?:\s+(scan|stats))?(?:\s|$)/i,
    analyze: /!analyze(?:\s+(.+))?/i,
    tasks: /!tasks(?:\s+(.*))?/i
  };

  for (const [cmd, pattern] of Object.entries(commands)) {
    const match = message.match(pattern);
    if (match) {
      return { command: cmd, args: match.slice(1) };
    }
  }
  return null;
}

// Configuration handlers
function showConfig(channelId) {
  const prefs = getChannelPrefs(channelId);
  return `**Scout Configuration for this channel:**

**Check-in Frequency:** ${prefs.checkInFrequency}
**Research Depth:** ${prefs.researchDepth}
**Proactive Level:** ${prefs.proactiveLevel}

**Focus Topics:** ${prefs.focusTopics.length > 0 ? prefs.focusTopics.join(', ') : 'None set'}
**Reminder Topics:** ${prefs.reminderTopics.length > 0 ? prefs.reminderTopics.join(', ') : 'None set'}

**Commands to customize:**
- \`!setfreq quiet|normal|active\` - How often I check in
- \`!setdepth quick|standard|deep\` - Research thoroughness
- \`!focus [topic]\` - Add a topic I should prioritize
- \`!remind [topic]\` - Add a topic for me to revisit later
- \`!feedback [message]\` - Tell me what to do better
- \`!askme\` - I'll ask what you'd like me to improve`;
}

function showPrefs(channelId) {
  const prefs = getChannelPrefs(channelId);
  return `**Your Scout Preferences:**

| Setting | Value |
|---------|-------|
| Check-ins | ${prefs.checkInFrequency} |
| Research | ${prefs.researchDepth} |
| Proactive | ${prefs.proactiveLevel} |
| Focus Topics | ${prefs.focusTopics.length} |
| Reminders | ${prefs.reminderTopics.length} |
| Feedback Given | ${prefs.feedback.length} |`;
}

async function askForPreferences(channelId) {
  return `**I'd love to work better for you!**

A few questions:
1. **How often would you like me to check in?** (quiet / normal / active)
2. **What topics should I focus on more?** Any areas you want me to prioritize?
3. **Anything I should look at again or revisit?** Topics worth re-researching?
4. **What could I do better?** Any feedback on my responses?
5. **How thorough should my research be?** (quick / standard / deep)

Just reply with any of these:
- \`!setfreq active\` - I'll check in more often
- \`!focus product strategy\` - I'll prioritize this topic
- \`!remind competitor analysis\` - I'll revisit this later
- \`!feedback be more concise\` - I'll improve
- \`!setdepth deep\` - I'll do more thorough research

What would you like to adjust?`;
}

// Handle incoming message
async function handleMessage(post) {
  if (post.user_id === state.botUserId) return;

  // Ignore messages from any bot (Mattermost sets props.from_bot on bot messages)
  if (post.props?.from_bot === 'true' || post.props?.from_bot === true) {
    log('debug', 'Ignoring message from bot (from_bot flag)', { userId: post.user_id });
    return;
  }

  // Also check explicit ignore list as fallback
  const ignoredBots = config.scout.ignoreBotUserIds || [];
  if (ignoredBots.includes(post.user_id)) {
    log('debug', 'Ignoring message from other bot', { userId: post.user_id });
    return;
  }

  const channelId = post.channel_id;
  const message = post.message;

  // Skip if ONLY Spark is mentioned (avoid duplicate bot responses)
  // But respond if Scout is also mentioned
  const mentionsScout = message.toLowerCase().includes('@scout');
  const mentionsSpark = message.toLowerCase().includes('@spark');
  if (mentionsSpark && !mentionsScout) {
    log('info', 'SCOUT SKIPPING - Only Spark mentioned', { channelId });
    return;
  }

  // Initialize channel state
  if (!state.channels.has(channelId)) {
    state.channels.set(channelId, { lastActivity: Date.now(), messages: [] });
  }
  if (!state.conversationHistory.has(channelId)) {
    state.conversationHistory.set(channelId, []);
  }

  const channelState = state.channels.get(channelId);
  channelState.lastActivity = Date.now();
  const msgTimestamp = post.create_at || Date.now();
  channelState.messages.push({
    role: 'user',
    content: message,
    userId: post.user_id,
    timestamp: msgTimestamp
  });

  // Persist message to disk
  memory.appendMessage(channelId, {
    id: post.id,
    content: message,
    userId: post.user_id,
    timestamp: msgTimestamp,
    role: 'user'
  });

  // Index into semantic memory (async, don't block)
  const channelName = state.channels.get(channelId)?.name || channelId;
  const msgUserName = await getUsername(post.user_id);
  semanticMemory.indexMessage({
    text: message,
    channelId,
    channelName,
    userId: post.user_id,
    userName: msgUserName,
    messageId: post.id,
    timestamp: msgTimestamp
  }).catch(err => log('warn', 'Semantic indexing failed', { error: err.message }));

  // Store for summarization (keep last 100 messages)
  const history = state.conversationHistory.get(channelId);
  history.push({
    content: message,
    userId: post.user_id,
    timestamp: Date.now()
  });
  if (history.length > 100) {
    state.conversationHistory.set(channelId, history.slice(-100));
  }

  // Keep only last 20 messages for context
  if (channelState.messages.length > 20) {
    channelState.messages = channelState.messages.slice(-20);
  }

  // Smart Capture: Detect actionable items and ask for approval
  if (config.capture?.enabled) {
    try {
      // Check if this channel has a board mapping
      const boardId = capture.getBoardForChannel(channelId);
      if (!boardId && !config.capture?.enableGlobalCapture) {
        // Channel not mapped, skip capture
      } else if (message.length >= 20 && !message.startsWith('!')) {
        // Get username for context
        let username = 'unknown';
        try {
          const user = await mmApi(`/users/${post.user_id}`);
          username = user.username;
        } catch (e) { /* ignore */ }

        // Get channel name and board name
        const channelName = config.capture.channelNames?.[channelId] || 'unknown';
        const boardName = config.capture.boardNames?.[boardId] || 'Project Board';

        // Detect actionable items
        const detection = await capture.detectActionableItems(anthropic, message, channelName, username);

        if (detection.hasActionableItems && detection.items?.length) {
          // Format and post approval request
          const approvalMsg = capture.formatApprovalRequest(detection, channelName, boardName);
          if (approvalMsg) {
            const captureReplyTo = post.root_id || post.id;
            const approvalPost = await postMessage(channelId, approvalMsg, captureReplyTo);

            // Store pending capture data for when user approves
            if (approvalPost?.id) {
              capture.storePendingCapture(approvalPost.id, {
                detection,
                channelId,
                channelName,
                username,
                originalPostId: post.id
              });
              log('info', 'Capture approval requested', {
                postId: approvalPost.id,
                items: detection.items.length
              });
            }
          }
        }
      }
    } catch (captureError) {
      log('error', 'Capture detection failed', { error: captureError.message });
    }
  }

  // Check for commands first
  const cmd = parseCommand(message);
  if (cmd) {
    let response = null;
    const replyTo = post.root_id || post.id; // For thread-safe replies
    log('debug', 'Command parsed, computing replyTo', {
      command: cmd.command,
      postId: post.id,
      rootId: post.root_id,
      replyTo,
      channelId
    });

    // Try modular router first (skills, workflows, documents)
    if (commandRouter.isRouterCommand(cmd.command)) {
      try {
        log('info', 'Using modular router for command', { command: cmd.command });
        await postMessage(channelId, `Processing \`!${cmd.command}\`...`, replyTo);

        // Gather context
        const routerPrefs = getChannelPrefs(channelId);
        const routerDepthMap = { quick: 20, standard: 50, deep: 100 };
        const routerHistoryLimit = routerDepthMap[routerPrefs.researchDepth] || 50;
        const routerHistory = await fetchChannelHistory(channelId, routerHistoryLimit);
        const routerChannelContext = routerHistory
          .filter(m => m.content && m.content.trim())
          .map(m => `[${m.username}]: ${m.content}`)
          .join('\n');

        // Get semantic context
        let routerSemanticContext = '';
        try {
          const memCtx = await semanticMemory.getContext(cmd.args.join(' ') || cmd.command, {
            maxDocs: 20,
            maxConvs: 20,
            includeGraph: true
          });
          if (memCtx) routerSemanticContext = memCtx;
        } catch (err) {
          log('warn', 'Semantic memory for router failed', { error: err.message });
        }

        const routerResult = await commandRouter.routeCommand(cmd, {}, {
          botName: 'scout',
          channelContext: routerChannelContext,
          semanticContext: routerSemanticContext,
          depth: routerPrefs.researchDepth || 'standard',
          logFn: (msg) => log('info', msg)
        });

        if (routerResult) {
          await postWithSplitting(channelId, routerResult.text, replyTo, cmd.command);
          return; // Command handled by router
        }
      } catch (routerErr) {
        log('error', 'Router failed, falling through to legacy', { error: routerErr.message });
        // Fall through to legacy switch statement
      }
    }

    // Legacy command handling (backward compatibility)
    switch (cmd.command) {
      case 'research':
        await postMessage(channelId, "🔬 Conducting research analysis... This may take a moment.", replyTo);
        // Fetch deeper channel history based on research depth preference
        const researchPrefs = getChannelPrefs(channelId);
        const researchDepthMap = { quick: 20, standard: 50, deep: 100 };
        const researchHistoryLimit = researchDepthMap[researchPrefs.researchDepth] || 50;
        const researchHistory = await fetchChannelHistory(channelId, researchHistoryLimit);
        const researchContext = researchHistory
          .filter(m => m.content && m.content.trim())
          .map(m => `[${m.username}]: ${m.content}`)
          .join('\n');

        // Get semantic context from memory (documents + conversations + graph)
        let semanticContext = '';
        try {
          const memoryContext = await semanticMemory.getContext(cmd.args[0], {
            maxDocs: 20,
            maxConvs: 20,
            includeGraph: true
          });
          if (memoryContext) {
            semanticContext = memoryContext;
            log('info', 'Added semantic memory context', { channelId, query: cmd.args[0] });
          }
        } catch (err) {
          log('warn', 'Semantic memory search failed, continuing without', { error: err.message });
        }

        // Combine channel history with semantic context
        const fullContext = semanticContext
          ? `${semanticContext}\n\n## Recent Channel Discussion\n${researchContext}`
          : researchContext;

        log('info', 'Research using channel history + semantic memory', {
          channelId,
          messages: researchHistory.length,
          hasSemanticContext: !!semanticContext,
          depth: researchPrefs.researchDepth
        });
        const researchResult = await performResearch(cmd.args[0], fullContext);
        await postWithSplitting(channelId, researchResult, replyTo, 'research');
        // response stays null - already posted via postWithSplitting
        break;

      case 'brainstorm':
        await postMessage(channelId, "💡 Brainstorming with probabilistic analysis...", replyTo);
        // Fetch deeper channel history for brainstorming context
        const brainstormPrefs = getChannelPrefs(channelId);
        const brainstormDepthMap = { quick: 20, standard: 50, deep: 100 };
        const brainstormHistoryLimit = brainstormDepthMap[brainstormPrefs.researchDepth] || 50;
        const brainstormHistory = await fetchChannelHistory(channelId, brainstormHistoryLimit);
        const brainstormChannelContext = brainstormHistory
          .filter(m => m.content && m.content.trim())
          .map(m => `[${m.username}]: ${m.content}`)
          .join('\n');

        // Get semantic context from memory
        let brainstormSemanticContext = '';
        try {
          const memContext = await semanticMemory.getContext(cmd.args[0], {
            maxDocs: 20,
            maxConvs: 20,
            includeGraph: true
          });
          if (memContext) {
            brainstormSemanticContext = memContext;
            log('info', 'Added semantic memory to brainstorm', { query: cmd.args[0] });
          }
        } catch (err) {
          log('warn', 'Semantic memory for brainstorm failed', { error: err.message });
        }

        const brainstormFullContext = brainstormSemanticContext
          ? `${brainstormSemanticContext}\n\n## Recent Discussion\n${brainstormChannelContext}`
          : brainstormChannelContext;

        log('info', 'Brainstorm using channel history + semantic memory', {
          channelId,
          messages: brainstormHistory.length,
          hasSemanticContext: !!brainstormSemanticContext
        });
        const brainstormResult = await brainstormWithProbabilities(cmd.args[0], brainstormFullContext);
        await postWithSplitting(channelId, brainstormResult, replyTo, 'brainstorm');
        // response stays null - already posted via postWithSplitting
        break;

      case 'crew':
        // Multi-agent crew orchestration commands
        const crewSubCmd = (cmd.args[0] || 'help').toLowerCase();
        const crewTopic = cmd.args.slice(1).join(' ') || 'general analysis';

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

        switch (crewSubCmd) {
          case 'research':
            await postMessage(channelId, `🔬 **Crew Research Pipeline**: ${crewTopic}\n\nDeploying multi-agent research crew (4 stages)...`, replyTo);
            try {
              const researchResult = await crew.runPipeline('research', crewTopic, crewFullContext, {
                log: (msg) => log('info', `Crew: ${msg}`)
              });
              const researchOutput = `## 🔬 Crew Research: ${crewTopic}\n\n${researchResult.finalOutput}`;
              await postWithSplitting(channelId, researchOutput, replyTo, 'crew-research');
            } catch (err) {
              log('error', 'Crew research failed', { error: err.message });
              response = `❌ Crew research failed: ${err.message}`;
            }
            break;

          case 'brainstorm':
            await postMessage(channelId, `💡 **Crew Brainstorm Pipeline**: ${crewTopic}\n\nDeploying creative crew (4 stages)...`, replyTo);
            try {
              const brainstormCrewResult = await crew.runPipeline('brainstorm', crewTopic, crewFullContext, {
                log: (msg) => log('info', `Crew: ${msg}`)
              });
              const brainstormOutput = `## 💡 Crew Brainstorm: ${crewTopic}\n\n${brainstormCrewResult.finalOutput}`;
              await postWithSplitting(channelId, brainstormOutput, replyTo, 'crew-brainstorm');
            } catch (err) {
              log('error', 'Crew brainstorm failed', { error: err.message });
              response = `❌ Crew brainstorm failed: ${err.message}`;
            }
            break;

          case 'dialectic':
            await postMessage(channelId, `⚖️ **Dialectic Debate**: ${crewTopic}\n\nRunning thesis-antithesis-synthesis debate (2 rounds)...`, replyTo);
            try {
              const dialecticResult = await crew.runDialectic(crewTopic, 2, {
                log: (msg) => log('info', `Crew: ${msg}`)
              });
              const dialecticOutput = `## ⚖️ Dialectic Analysis: ${crewTopic}\n\n### Final Synthesis\n${dialecticResult.finalSynthesis}\n\n### Validation\n${dialecticResult.validation}`;
              await postWithSplitting(channelId, dialecticOutput, replyTo, 'crew-dialectic');
            } catch (err) {
              log('error', 'Crew dialectic failed', { error: err.message });
              response = `❌ Crew dialectic failed: ${err.message}`;
            }
            break;

          case 'analysis':
            await postMessage(channelId, `📊 **Crew Analysis Pipeline**: ${crewTopic}\n\nDeploying analytical crew (4 stages)...`, replyTo);
            try {
              const analysisResult = await crew.runPipeline('analysis', crewTopic, crewFullContext, {
                log: (msg) => log('info', `Crew: ${msg}`)
              });
              const analysisOutput = `## 📊 Crew Analysis: ${crewTopic}\n\n${analysisResult.finalOutput}`;
              await postWithSplitting(channelId, analysisOutput, replyTo, 'crew-analysis');
            } catch (err) {
              log('error', 'Crew analysis failed', { error: err.message });
              response = `❌ Crew analysis failed: ${err.message}`;
            }
            break;

          default:
            response = `## 🤖 Crew Orchestration Commands

**Multi-agent pipelines** that use specialized AI agents working together:

| Command | Description |
|---------|-------------|
| \`!crew research [topic]\` | 4-stage research pipeline (gather → analyze → challenge → synthesize) |
| \`!crew brainstorm [topic]\` | Creative ideation pipeline (diverge → evaluate → structure → converge) |
| \`!crew dialectic [topic]\` | Thesis-antithesis-synthesis debate (2 rounds) |
| \`!crew analysis [topic]\` | Analytical pipeline with proof gate |

**Example:**
\`!crew research AI adoption in healthcare\`
\`!crew dialectic Should we prioritize mobile over web?\`

Each pipeline runs multiple specialized agents:
• **Researcher** - Gathers information
• **Analyst** - Generates hypotheses
• **Critic** - Challenges assumptions (Proof Gate)
• **Synthesizer** - Creates actionable recommendations`;
        }
        break;

      case 'github':
        const repo = cmd.args[0];
        const commits = await getRecentCommits(repo);
        const prs = await getOpenPRs(repo);
        const issues = await getOpenIssues(repo);
        response = `## GitHub Update: ${repo}\n\n### Recent Commits\n${commits || 'None found'}\n\n### Open PRs\n${prs || 'None'}\n\n### Open Issues\n${issues || 'None'}`;
        break;

      case 'summary':
        const hours = cmd.args[0] ? parseInt(cmd.args[0]) : 24;
        response = await summarizeChannel(channelId, hours);
        break;

      // ===== FILE COMMANDS =====

      case 'files':
        // List files in channel or scan for new ones
        const filesSubCmd = (cmd.args[0] || 'list').toLowerCase();

        if (filesSubCmd === 'scan') {
          await postMessage(channelId, "📂 Scanning channel for files...", replyTo);
          const scanResult = await fileIndex.scanChannelFiles(channelId, mmApi, { log });
          response = `📂 **File Scan Complete**\n\n- Posts scanned: ${scanResult.scanned}\n- New files indexed: ${scanResult.added}\n\nUse \`!files\` to see all indexed files.`;
        } else if (filesSubCmd === 'stats') {
          const stats = fileIndex.getStats();
          response = `📊 **File Index Statistics**\n\n- Total files: ${stats.totalFiles}\n- Processed: ${stats.processedFiles}\n- Unprocessed: ${stats.unprocessedFiles}\n- Channels with files: ${stats.channelCount}\n\n**By Type:**\n${Object.entries(stats.byType).map(([t, c]) => `- ${t}: ${c}`).join('\n')}`;
        } else {
          // List files in this channel
          const channelFiles = fileIndex.getChannelFiles(channelId);
          if (channelFiles.length === 0) {
            response = `📂 No files indexed for this channel yet.\n\nUse \`!files scan\` to scan for files, or upload a new file.`;
          } else {
            const fileList = channelFiles.slice(0, 15).map(f => {
              const processed = fileIndex.isProcessed(f.id) ? '✓' : '○';
              const size = (f.size / 1024).toFixed(1) + 'KB';
              return `${processed} **${f.name}** (${size}) - \`${f.id.substring(0, 8)}\``;
            }).join('\n');
            response = `📂 **Channel Files** (${channelFiles.length} total)\n\n${fileList}\n\n_✓ = processed, ○ = not processed_\n\nUse \`!analyze [filename or id]\` to process a file.`;
          }
        }
        break;

      case 'tasks':
        // View and manage Scout's task queue
        const tasksSubCmd = (cmd.args[0] || 'list').toLowerCase();
        const tasksArg = cmd.args.slice(1).join(' ');

        switch (tasksSubCmd) {
          case 'list':
          case 'pending': {
            const pending = taskQueue.getPendingTasks({ channelId });
            const allPending = taskQueue.getPendingTasks();

            if (pending.length === 0 && allPending.length === 0) {
              response = `📋 **No pending tasks**\n\nI'm all caught up! Use commands like \`!research\`, \`!crew\`, or \`!remindme\` to add work.`;
            } else {
              let taskList = '';
              if (pending.length > 0) {
                taskList += `**This Channel (${pending.length}):**\n`;
                taskList += pending.slice(0, 10).map(t => {
                  const status = t.status === 'in_progress' ? '🔄' : '⏳';
                  const scheduled = t.scheduledFor ? ` (scheduled: ${new Date(t.scheduledFor).toLocaleString()})` : '';
                  return `${status} \`${t.id.substring(0, 8)}\` ${t.title}${scheduled}`;
                }).join('\n');
                if (pending.length > 10) taskList += `\n_...and ${pending.length - 10} more_`;
              }

              if (allPending.length > pending.length) {
                const otherCount = allPending.length - pending.length;
                taskList += `\n\n**Other Channels:** ${otherCount} tasks`;
              }

              const stats = taskQueue.getStats();
              response = `📋 **Task Queue**\n\n${taskList}\n\n**Stats:** ${stats.pending} pending, ${stats.totalCompleted} completed, ${stats.totalFailed} failed\n\nCommands: \`!tasks done [id]\`, \`!tasks cancel [id]\`, \`!tasks retry [id]\``;
            }
            break;
          }

          case 'all': {
            const all = taskQueue.getPendingTasks();
            if (all.length === 0) {
              response = `📋 No pending tasks across any channel.`;
            } else {
              const taskList = all.slice(0, 15).map(t => {
                const status = t.status === 'in_progress' ? '🔄' : '⏳';
                return `${status} \`${t.id.substring(0, 8)}\` [${t.type}] ${t.title}`;
              }).join('\n');
              response = `📋 **All Pending Tasks (${all.length})**\n\n${taskList}${all.length > 15 ? `\n_...and ${all.length - 15} more_` : ''}`;
            }
            break;
          }

          case 'done':
          case 'complete': {
            if (!tasksArg) {
              response = `Usage: \`!tasks done [task_id]\``;
              break;
            }
            const task = taskQueue.getPendingTasks().find(t => t.id.startsWith(tasksArg));
            if (task) {
              taskQueue.completeTask(task.id, { manuallyCompleted: true });
              response = `✅ Marked task as done: **${task.title}**`;
            } else {
              response = `❌ Task not found: ${tasksArg}`;
            }
            break;
          }

          case 'cancel': {
            if (!tasksArg) {
              response = `Usage: \`!tasks cancel [task_id]\``;
              break;
            }
            const task = taskQueue.getPendingTasks().find(t => t.id.startsWith(tasksArg));
            if (task) {
              taskQueue.cancelTask(task.id);
              response = `🚫 Cancelled task: **${task.title}**`;
            } else {
              response = `❌ Task not found: ${tasksArg}`;
            }
            break;
          }

          case 'retry': {
            if (!tasksArg) {
              response = `Usage: \`!tasks retry [task_id]\``;
              break;
            }
            const failed = taskQueue.getFailedTasks(50);
            const task = failed.find(t => t.id.startsWith(tasksArg));
            if (task) {
              taskQueue.retryTask(task.id);
              response = `🔄 Retrying task: **${task.title}**`;
            } else {
              response = `❌ Failed task not found: ${tasksArg}`;
            }
            break;
          }

          case 'failed': {
            const failed = taskQueue.getFailedTasks(10);
            if (failed.length === 0) {
              response = `✅ No failed tasks!`;
            } else {
              const failedList = failed.map(t =>
                `❌ \`${t.id.substring(0, 8)}\` ${t.title}\n   Error: ${t.error || 'Unknown'}`
              ).join('\n');
              response = `📋 **Failed Tasks**\n\n${failedList}\n\nUse \`!tasks retry [id]\` to retry.`;
            }
            break;
          }

          case 'stats': {
            const stats = taskQueue.getStats();
            response = `📊 **Task Queue Stats**\n\n` +
              `- Pending: ${stats.pending}\n` +
              `- In Progress: ${stats.inProgress}\n` +
              `- Scheduled: ${stats.scheduled}\n` +
              `- Ready: ${stats.ready}\n\n` +
              `**Totals:**\n` +
              `- Created: ${stats.totalCreated}\n` +
              `- Completed: ${stats.totalCompleted}\n` +
              `- Failed: ${stats.totalFailed}\n\n` +
              `**By Type:**\n${Object.entries(stats.byType).map(([t, c]) => `- ${t}: ${c}`).join('\n') || 'None'}`;
            break;
          }

          case 'add': {
            // Add a manual task/follow-up
            if (!tasksArg) {
              response = `Usage: \`!tasks add [description]\`\n\nExample: \`!tasks add Follow up on LYNA pricing discussion\``;
              break;
            }
            const task = taskQueue.TaskFactory.followUp(tasksArg, channelId, userId);
            response = `📌 Added follow-up task: **${tasksArg}**\n\nTask ID: \`${task.id.substring(0, 8)}\``;
            break;
          }

          default:
            response = `📋 **Task Commands**\n\n` +
              `| Command | Description |\n` +
              `|---------|-------------|\n` +
              `| \`!tasks\` | List pending tasks in this channel |\n` +
              `| \`!tasks all\` | List all pending tasks |\n` +
              `| \`!tasks add [desc]\` | Add a follow-up task |\n` +
              `| \`!tasks done [id]\` | Mark task as complete |\n` +
              `| \`!tasks cancel [id]\` | Cancel a task |\n` +
              `| \`!tasks failed\` | Show failed tasks |\n` +
              `| \`!tasks retry [id]\` | Retry a failed task |\n` +
              `| \`!tasks stats\` | Show queue statistics |`;
        }
        break;

      case 'analyze':
        // Process a specific file on-demand
        const fileQuery = cmd.args.join(' ');
        if (!fileQuery) {
          response = `Usage: \`!analyze [filename or file_id]\`\n\nExamples:\n- \`!analyze budget.xlsx\`\n- \`!analyze s8b51sog\``;
          break;
        }

        await postMessage(channelId, `📄 Searching for file: **${fileQuery}**...`, replyTo);

        // Search for the file
        let targetFile = fileIndex.getFile(fileQuery); // Try direct ID first
        if (!targetFile) {
          const matches = fileIndex.searchFiles(fileQuery, channelId);
          if (matches.length === 0) {
            // Try scanning channel first
            await fileIndex.scanChannelFiles(channelId, mmApi, { log });
            const retryMatches = fileIndex.searchFiles(fileQuery, channelId);
            if (retryMatches.length > 0) {
              targetFile = retryMatches[0];
            }
          } else {
            targetFile = matches[0];
          }
        }

        if (!targetFile) {
          response = `❌ Could not find file matching: **${fileQuery}**\n\nTry \`!files scan\` to index files, then \`!files\` to see available files.`;
          break;
        }

        // Check if already processed
        const alreadyProcessed = fileIndex.isProcessed(targetFile.id);
        if (alreadyProcessed) {
          await postMessage(channelId, `📄 File **${targetFile.name}** was already processed. Re-analyzing...`, replyTo);
        } else {
          await postMessage(channelId, `📄 Processing: **${targetFile.name}**...`, replyTo);
        }

        try {
          // Download the file
          const fileBuffer = await downloadFile(targetFile.id);
          if (!fileBuffer) {
            response = `❌ Failed to download file: ${targetFile.name}`;
            break;
          }

          // Process based on type
          const processResult = await fileIndex.processFile(targetFile, fileBuffer, { log });

          if (processResult.success) {
            // Store in channel memory
            const channelState = state.channels.get(channelId);
            if (channelState) {
              channelState.messages.push({
                role: 'system',
                content: `[${processResult.type.toUpperCase()}: ${processResult.name}]\n${processResult.context.substring(0, 50000)}`,
                timestamp: Date.now()
              });
            }

            // Index for vector search (skip if already processed to avoid duplicates)
            if (!alreadyProcessed) {
              const indexContent = {
                text: processResult.context,
                chunks: [{ text: processResult.context, pageNum: 1, heading: processResult.name }]
              };
              pdfUtils.indexDocument(indexContent, processResult.name, channelId, log)
                .catch(err => log('warn', 'Vector indexing failed', { error: err.message }));
            }

            // Build response based on file type
            let summaryLines = [];
            if (processResult.type === 'spreadsheet') {
              summaryLines = [
                `- **Sheets**: ${processResult.summary.sheets}`,
                `- **Rows**: ${processResult.summary.rows}`,
                `- **Formulas**: ${processResult.summary.formulas}`,
                processResult.summary.hasComplexFormulas ? `- **Complex formulas**: Yes` : null
              ].filter(Boolean);
            } else if (processResult.type === 'pdf' || processResult.type === 'document') {
              summaryLines = [
                `- **Pages**: ${processResult.summary.pages}`,
                `- **Chunks**: ${processResult.summary.chunks}`
              ];
            }

            // Post the analysis
            const analysisContent = processResult.context.substring(0, 10000);
            const analysisMsg = `## 📄 File Analysis: ${processResult.name}\n\n**Summary:**\n${summaryLines.join('\n')}\n\n---\n\n${analysisContent}${processResult.context.length > 10000 ? '\n\n_... content truncated. Full file is now in memory for questions._' : ''}`;

            await postWithSplitting(channelId, analysisMsg, replyTo, 'file-analysis');
          } else {
            response = `❌ Failed to process file: ${processResult.error}`;
          }
        } catch (err) {
          log('error', 'File analysis failed', { file: targetFile.name, error: err.message });
          response = `❌ Error processing file: ${err.message}`;
        }
        break;

      case 'backlog':
        await postMessage(channelId, "📋 Analyzing discussion and creating backlog items...", replyTo);
        const backlogHours = cmd.args[0] ? parseInt(cmd.args[0]) : 24;
        response = await summarizeChannel(channelId, backlogHours, true);
        break;

      case 'update':
        await postMessage(channelId, "📦 Generating product update...", replyTo);
        response = await generateProductUpdate(cmd.args[0]);
        break;

      case 'issue':
        const issueResult = await createGitHubIssue(cmd.args[0], cmd.args[1], cmd.args[2]);
        response = issueResult ? `✅ Issue created: ${issueResult}` : "❌ Failed to create issue";
        break;

      case 'config':
        response = showConfig(channelId);
        break;

      case 'prefs':
        response = showPrefs(channelId);
        break;

      case 'askme':
        response = await askForPreferences(channelId);
        break;

      case 'setfreq':
        const freq = cmd.args[0].toLowerCase();
        const prefsFreq = getChannelPrefs(channelId);
        prefsFreq.checkInFrequency = freq;
        savePreferences();
        response = `✅ Check-in frequency set to **${freq}**. ${freq === 'quiet' ? "I'll be less chatty." : freq === 'active' ? "I'll check in more often!" : "I'll check in at a normal pace."}`;
        break;

      case 'setdepth':
        const depth = cmd.args[0].toLowerCase();
        const prefsDepth = getChannelPrefs(channelId);
        prefsDepth.researchDepth = depth;
        savePreferences();
        response = `✅ Research depth set to **${depth}**. ${depth === 'quick' ? "I'll give faster, shorter answers." : depth === 'deep' ? "I'll provide thorough, comprehensive research." : "I'll balance speed and depth."}`;
        break;

      case 'focus':
        const focusTopic = cmd.args[0];
        const prefsFocus = getChannelPrefs(channelId);
        if (!prefsFocus.focusTopics.includes(focusTopic)) {
          prefsFocus.focusTopics.push(focusTopic);
          savePreferences();
          response = `✅ Added **"${focusTopic}"** to focus topics. I'll prioritize this in research and discussions.\n\nCurrent focus: ${prefsFocus.focusTopics.join(', ')}`;
        } else {
          response = `"${focusTopic}" is already in your focus topics.`;
        }
        break;

      case 'remind':
        const remindTopic = cmd.args[0];
        const prefsRemind = getChannelPrefs(channelId);
        prefsRemind.reminderTopics.push({
          topic: remindTopic,
          addedAt: Date.now(),
          nextReminder: Date.now() + (7 * 24 * 60 * 60 * 1000) // 1 week default
        });
        savePreferences();
        response = `✅ I'll remind you about **"${remindTopic}"** in about a week. I'll bring it up when relevant or during check-ins.`;
        break;

      case 'feedback':
        const feedbackMsg = cmd.args[0];
        const prefsFeedback = getChannelPrefs(channelId);
        prefsFeedback.feedback.push({
          message: feedbackMsg,
          timestamp: Date.now()
        });
        savePreferences();
        response = `Thank you for the feedback! I've noted: **"${feedbackMsg}"**\n\nI'll work on improving. Your feedback helps me serve you better!`;
        break;

      // Polls moved to Socialite bot - use !pollhelp

      case 'remindme':
        const timeArg = cmd.args[0];
        const reminderMsg = cmd.args[1];
        response = await setReminder(channelId, post.user_id, timeArg, reminderMsg);
        break;

      case 'discuss':
        const discussTopic = cmd.args[0];
        await postMessage(channelId, "💬 Starting a discussion thread...", replyTo);
        response = await startDiscussion(channelId, discussTopic);
        break;

      case 'engage':
        const engageTopic = cmd.args[0];
        const contextMsgs = channelState.messages.slice(-5).map(m => m.content).join('\n');
        response = await engageTopic(channelId, engageTopic, contextMsgs);
        break;

      case 'cheer':
        const cheerTarget = cmd.args[0];
        await addReaction(post.id, 'tada');
        response = `🎉 **Shoutout to ${cheerTarget}!**\n\n${getCheerMessage()}`;
        break;

      case 'pin':
        // Pin the message this is replying to
        if (post.root_id) {
          const pinned = await pinMessage(post.root_id);
          response = pinned ? "📌 Message pinned!" : "Couldn't pin that message.";
        } else {
          response = "Reply to a message with `!pin` to pin it.";
        }
        break;

      case 'savelast':
        // Save the last substantial bot response to GitHub
        const docName = cmd.args[0];
        const lastResponse = getLastBotResponse(channelState.messages);

        if (!lastResponse) {
          response = "I don't have a recent response to save. Run a `!research` or `!brainstorm` first, then use `!savelast [name]`.";
        } else {
          await postMessage(channelId, "📄 Saving to GitHub...", replyTo);
          const result = await saveToGitHub(docName, lastResponse, `docs: Add ${docName} from Scout research`);

          if (result.success) {
            response = `✅ **Saved to GitHub!**\n\n📁 File: \`${result.filepath}\`\n🔗 [View on GitHub](https://github.com/hwillGIT/playbook-templates/blob/main/${result.filepath})`;
          } else {
            response = `❌ Failed to save: ${result.error}`;
          }
        }
        break;

      case 'save':
        // Save custom content provided inline
        const saveArgs = cmd.args[0];
        const nameMatch = saveArgs.match(/^"([^"]+)"\s+(.+)$/s);

        if (!nameMatch) {
          response = `**Usage:** \`!save "filename" [content]\`\n\nOr use \`!savelast [filename]\` to save my last research/brainstorm output.`;
        } else {
          const fileName = nameMatch[1];
          const content = nameMatch[2];

          await postMessage(channelId, "📄 Saving to GitHub...", replyTo);
          const saveResult = await saveToGitHub(fileName, content, `docs: Add ${fileName}`);

          if (saveResult.success) {
            response = `✅ **Saved to GitHub!**\n\n📁 File: \`${saveResult.filepath}\`\n🔗 [View on GitHub](https://github.com/hwillGIT/playbook-templates/blob/main/${saveResult.filepath})`;
          } else {
            response = `❌ Failed to save: ${saveResult.error}`;
          }
        }
        break;

      // ===== COMMAND MENU =====
      case 'scout':
        response = `## 🔍 Scout - Command Menu

Type \`!scout [category]\` to see commands, or use directly:

| Category | Command | What it does |
|----------|---------|--------------|
| 📊 **dashboard** | \`!scout dashboard\` | PM dashboards & project status |
| 🔬 **research** | \`!scout research\` | Deep analysis & brainstorming |
| 📋 **jira** | \`!scout jira\` | Create stories, bugs, tasks |
| 🐙 **github** | \`!scout github\` | Commits, PRs, save docs |
| 📅 **queues** | \`!scout queues\` | Research & follow-up tracking |
| 💬 **engage** | \`!scout engage\` | Discussions, cheers, polls |
| ⚙️ **settings** | \`!scout settings\` | Configure Scout behavior |

**Quick Actions:**
• \`!dashboard\` - Generate PM dashboard now
• \`!research-queue all\` - See all research items
• \`!summary\` - Summarize this channel

_Or just @scout with any question!_`;
        break;

      case 'scoutmenu':
        const menuCategory = cmd.args[0]?.toLowerCase();
        switch (menuCategory) {
          case 'dashboard':
            response = `## 📊 Dashboard Commands

| Command | Description |
|---------|-------------|
| \`!dashboard\` | Weekly PM dashboard (all projects) |
| \`!dashboard 14d\` | Last 14 days |
| \`!dashboard monthly\` | Last 30 days |
| \`!research-queue\` | Research items (this channel) |
| \`!research-queue all\` | Research items (all projects) |
| \`!followup-queue\` | Follow-ups (this channel) |
| \`!followup-queue all\` | Follow-ups (all projects) |

_Dashboard auto-posts Mon 9am & Fri 4pm to #pm-dashboard_`;
            break;

          case 'research':
            response = `## 🔬 Research & Analysis Commands

| Command | Description |
|---------|-------------|
| \`!research [topic]\` | Deep probabilistic analysis |
| \`!brainstorm [topic]\` | Creative ideas with success odds |
| \`!summary\` | Channel digest (last 24h) |
| \`!summary 48\` | Channel digest (last 48h) |

**Example:**
\`!research best practices for user onboarding in SaaS\``;
            break;

          case 'jira':
            response = `## 📋 Jira Commands

| Command | Description |
|---------|-------------|
| \`!story [description]\` | Create User Story with acceptance criteria |
| \`!bug [description]\` | Create Bug with steps to reproduce |
| \`!task [description]\` | Create Task |
| \`!jira [description]\` | Auto-detect type and create |
| \`!backlog [hours]\` | Summarize channel & create issues |

**Examples:**
\`!story As a user, I want to export data to CSV\`
\`!bug Login button not working on mobile Safari\``;
            break;

          case 'github':
            response = `## 🐙 GitHub Commands

| Command | Description |
|---------|-------------|
| \`!github [repo]\` | Show commits, PRs, issues |
| \`!update [repo]\` | Generate product update summary |
| \`!issue [repo] "title" "body"\` | Create GitHub issue |
| \`!savelast [filename]\` | Save last research to GitHub |
| \`!save "filename" [content]\` | Save custom content |

**Example:**
\`!github opal-app\``;
            break;

          case 'queues':
            response = `## 📅 Queue Commands

**Research Queue** (items needing investigation):
| Command | Description |
|---------|-------------|
| \`!research-queue\` | This channel's research items |
| \`!research-queue all\` | All projects' research items |

**Follow-up Queue** (items awaiting response):
| Command | Description |
|---------|-------------|
| \`!followup-queue\` | This channel's follow-ups |
| \`!followup-queue all\` | All projects' follow-ups |

_Items are auto-detected from conversations_`;
            break;

          case 'engage':
            response = `## 💬 Engagement Commands

| Command | Description |
|---------|-------------|
| \`!discuss [topic]\` | Start a discussion thread |
| \`!engage [topic]\` | Add insight to conversation |
| \`!cheer [person/team]\` | Celebrate someone! 🎉 |
| \`!pin\` | Pin a message (reply to it) |
| \`!remindme [time] [msg]\` | Set reminder (30m, 2h, 1d) |

**Example:**
\`!remindme 2h check on build status\``;
            break;

          case 'settings':
            response = `## ⚙️ Settings Commands

| Command | Description |
|---------|-------------|
| \`!config\` | View current settings |
| \`!setfreq quiet\` | Less frequent check-ins |
| \`!setfreq normal\` | Normal check-ins |
| \`!setfreq active\` | More frequent check-ins |
| \`!setdepth quick\` | Faster, shorter research |
| \`!setdepth standard\` | Balanced research |
| \`!setdepth deep\` | Thorough research |
| \`!focus [topic]\` | Add priority topic |
| \`!feedback [msg]\` | Send feedback to improve Scout |`;
            break;

          default:
            response = `Unknown category. Try: \`!scout dashboard\`, \`!scout research\`, \`!scout jira\`, \`!scout github\`, \`!scout queues\`, \`!scout engage\`, or \`!scout settings\``;
        }
        break;

      case 'help':
        response = `## 🔍 Scout Commands

**Research & Analysis:**
• \`!research [topic]\` - Deep probabilistic analysis
• \`!brainstorm [topic]\` - Creative ideas with success odds
• \`!crew [research|brainstorm|dialectic|analysis] [topic]\` - Multi-agent pipelines
• \`!summary [hours]\` - Channel activity digest (default: 24h)
• \`!backlog [hours]\` - Summarize & auto-create Jira issues from action items

**Files & Documents:**
• \`!files\` - List indexed files in channel
• \`!files scan\` - Scan channel for files to index
• \`!analyze [filename]\` - Process and analyze a file (XLS, PDF, DOCX)

**Task Queue:**
• \`!tasks\` - View pending tasks
• \`!tasks add [desc]\` - Add a follow-up task
• \`!tasks done [id]\` - Mark task complete

**GitHub:**
• \`!github [repo]\` - Commits, PRs, issues
• \`!update [repo]\` - Product update summary
• \`!issue [repo] "title" "body"\` - Create GitHub issue
• \`!savelast [filename]\` - Save last research/brainstorm to GitHub
• \`!save "filename" [content]\` - Save custom content to GitHub

**Jira Backlog:**
• \`!story [description]\` - Create a User Story with acceptance criteria
• \`!bug [description]\` - Create a Bug with steps to reproduce
• \`!task [description]\` - Create a Task
• \`!backlog [description]\` - Auto-detect type and create issue

**Polls & Voting:**
• \`!poll "Question?" "Opt1" "Opt2" "Opt3"\` - Multi-option poll
• \`!quickpoll yesno|agree|priority|rating [question]\` - Quick poll
• \`!vote [question]\` - Simple yes/no vote

**Engagement:**
• \`!discuss [topic]\` - Start a discussion thread
• \`!engage [topic]\` - Add an insight to the conversation
• \`!cheer [person/team]\` - Celebrate someone!
• \`!pin\` - Pin a message (reply to the message)

**Reminders:**
• \`!remindme [time] [message]\` - Set a reminder (e.g., 30m, 2h, 1d)

**Dashboard & Queues:**
• \`!dashboard\` - Weekly PM dashboard (all projects)
• \`!dashboard 14d\` - Last 14 days
• \`!research-queue\` - View research items needing investigation
• \`!research-queue all\` - Research items across all projects
• \`!followup-queue\` - View pending follow-up items
• \`!followup-queue all\` - Follow-ups across all projects

**Settings:**
• \`!config\` - View settings
• \`!setfreq quiet|normal|active\` - Check-in frequency
• \`!setdepth quick|standard|deep\` - Research depth
• \`!focus [topic]\` - Add a priority topic
• \`!feedback [message]\` - Help me improve

_Or just @scout me with any question!_`;
        break;

      // ===== JIRA COMMANDS =====

      case 'story':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const storyRequest = cmd.args[0];
          await postMessage(channelId, "📝 Creating Jira Story...", replyTo);

          // Use AI to generate well-structured story
          const storyData = await generateJiraIssue(storyRequest, 'Story');
          if (storyData) {
            const result = await createJiraStory(
              storyData.summary,
              storyData.description,
              storyData.acceptanceCriteria || ''
            );
            if (result.success) {
              response = `✅ **Story Created!**\n\n📋 **${result.key}**: ${storyData.summary}\n🔗 [View in Jira](${result.url})\n\n**Acceptance Criteria:**\n${storyData.acceptanceCriteria || '_None specified_'}`;
            } else {
              response = `❌ Failed to create story: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try: `!story As a user, I want to...`";
          }
        }
        break;

      case 'bug':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const bugRequest = cmd.args[0];
          await postMessage(channelId, "🐛 Creating Jira Bug...", replyTo);

          const bugData = await generateJiraIssue(bugRequest, 'Bug');
          if (bugData) {
            const result = await createJiraBug(
              bugData.summary,
              bugData.description,
              bugData.stepsToReproduce || ''
            );
            if (result.success) {
              response = `✅ **Bug Created!**\n\n🐛 **${result.key}**: ${bugData.summary}\n🔗 [View in Jira](${result.url})\n\n**Steps to Reproduce:**\n${bugData.stepsToReproduce || '_Please add steps to reproduce_'}`;
            } else {
              response = `❌ Failed to create bug: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try: `!bug Login button doesn't work on mobile`";
          }
        }
        break;

      case 'task':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const taskRequest = cmd.args[0];
          await postMessage(channelId, "📌 Creating Jira Task...", replyTo);

          const taskData = await generateJiraIssue(taskRequest, 'Task');
          if (taskData) {
            const result = await createJiraTask(taskData.summary, taskData.description);
            if (result.success) {
              response = `✅ **Task Created!**\n\n📌 **${result.key}**: ${taskData.summary}\n🔗 [View in Jira](${result.url})`;
            } else {
              response = `❌ Failed to create task: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try: `!task Update dependencies to latest versions`";
          }
        }
        break;

      case 'jira':
      case 'backlog':
        if (!config.jira?.enabled) {
          response = "❌ Jira integration is not configured. Ask your admin to set up Jira in config.json.";
        } else {
          const backlogRequest = cmd.args[0];
          await postMessage(channelId, "📋 Creating backlog item...", replyTo);

          // Try to auto-detect issue type from content
          const lowerReq = backlogRequest.toLowerCase();
          let issueType = 'Task';
          if (lowerReq.includes('as a ') || lowerReq.includes('user story') || lowerReq.includes('feature')) {
            issueType = 'Story';
          } else if (lowerReq.includes('bug') || lowerReq.includes('broken') || lowerReq.includes('fix') || lowerReq.includes('error') || lowerReq.includes('issue')) {
            issueType = 'Bug';
          }

          const backlogData = await generateJiraIssue(backlogRequest, issueType);
          if (backlogData) {
            let result;
            if (issueType === 'Story') {
              result = await createJiraStory(backlogData.summary, backlogData.description, backlogData.acceptanceCriteria || '');
            } else if (issueType === 'Bug') {
              result = await createJiraBug(backlogData.summary, backlogData.description, backlogData.stepsToReproduce || '');
            } else {
              result = await createJiraTask(backlogData.summary, backlogData.description);
            }

            if (result.success) {
              const typeEmoji = { Story: '📋', Bug: '🐛', Task: '📌' };
              response = `✅ **${issueType} Created!**\n\n${typeEmoji[issueType]} **${result.key}**: ${backlogData.summary}\n🔗 [View in Jira](${result.url})`;
            } else {
              response = `❌ Failed to create ${issueType.toLowerCase()}: ${result.error}`;
            }
          } else {
            response = "❌ Couldn't process that request. Try describing what you need in plain language.";
          }
        }
        break;

      // ===== DASHBOARD COMMAND =====
      case 'dashboard':
        await postMessage(channelId, ":chart_with_upwards_trend: Generating PM Dashboard... This may take a moment.", replyTo);
        try {
          const dashArgs = parseDashboardArgs(cmd.args[0]);
          const dashboardData = await dashboard.generateDashboard(dashArgs.days, dashArgs.label);

          // Post the main dashboard
          await postMessage(channelId, dashboardData.formatted_text, replyTo);

          // Post charts as a follow-up (URLs to QuickChart.io images)
          if (dashboardData.charts) {
            let chartMsg = '**Dashboard Charts:**\n\n';
            if (dashboardData.charts.flow_velocity) {
              chartMsg += `[Flow Velocity Chart](${dashboardData.charts.flow_velocity})\n`;
            }
            if (dashboardData.charts.activity_trend) {
              chartMsg += `[Activity Trend Chart](${dashboardData.charts.activity_trend})\n`;
            }
            if (dashboardData.charts.task_distribution) {
              chartMsg += `[Task Distribution Chart](${dashboardData.charts.task_distribution})\n`;
            }
            await postMessage(channelId, chartMsg, replyTo);
          }

          response = null; // Already posted
        } catch (err) {
          console.error('[DASHBOARD] Error generating dashboard:', err);
          response = `:x: Failed to generate dashboard: ${err.message}`;
        }
        break;

      // ===== RESEARCH & FOLLOW-UP QUEUE COMMANDS =====
      case 'researchqueue':
        const showAllResearch = cmd.args[0] === 'all';
        if (showAllResearch) {
          // Show research queue across all channels
          const allChannelIds = memory.getAllChannelIds();
          const channelNames = config.capture?.channelNames || {};
          let allItems = [];

          for (const chId of allChannelIds) {
            const queue = memory.getResearchQueue(chId, 'open');
            const chName = channelNames[chId] || chId.substring(0, 8);
            for (const item of queue) {
              allItems.push({
                ...item,
                channel: chName,
                age_days: Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000))
              });
            }
          }

          if (allItems.length === 0) {
            response = "🔬 **Research Queue (All Projects)**\n\n_No research items pending across any project._";
          } else {
            allItems.sort((a, b) => (a.priority === 'high' ? -1 : 1));
            let msg = `🔬 **Research Queue (All Projects)** - ${allItems.length} item(s)\n\n`;
            for (const item of allItems.slice(0, 15)) {
              const priorityIcon = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
              msg += `${priorityIcon} **[${item.channel}]** ${item.title}\n`;
              if (item.description && item.description !== item.title) {
                msg += `   _${item.description.substring(0, 80)}${item.description.length > 80 ? '...' : ''}_\n`;
              }
              msg += `   Age: ${item.age_days}d | Status: ${item.status}\n\n`;
            }
            if (allItems.length > 15) {
              msg += `_...and ${allItems.length - 15} more items_`;
            }
            response = msg;
          }
        } else {
          // Show research queue for current channel only
          const queue = memory.getResearchQueue(channelId, 'open');
          if (queue.length === 0) {
            response = "🔬 **Research Queue (This Channel)**\n\n_No research items pending for this channel._\n\nUse `!research-queue all` to see items across all projects.";
          } else {
            let msg = `🔬 **Research Queue (This Channel)** - ${queue.length} item(s)\n\n`;
            for (const item of queue) {
              const age = Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000));
              const priorityIcon = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
              msg += `${priorityIcon} **${item.title}**\n`;
              if (item.description && item.description !== item.title) {
                msg += `   _${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}_\n`;
              }
              msg += `   Age: ${age}d | Priority: ${item.priority} | Status: ${item.status}\n\n`;
            }
            msg += `\n_Use \`!research-queue all\` to see items across all projects._`;
            response = msg;
          }
        }
        break;

      case 'followupqueue':
        const showAllFollowups = cmd.args[0] === 'all';
        if (showAllFollowups) {
          // Show follow-up queue across all channels
          const allChannelIds = memory.getAllChannelIds();
          const channelNames = config.capture?.channelNames || {};
          let allItems = [];

          for (const chId of allChannelIds) {
            const queue = memory.getFollowUpQueue(chId, 'pending');
            const chName = channelNames[chId] || chId.substring(0, 8);
            for (const item of queue) {
              allItems.push({
                ...item,
                channel: chName,
                age_days: Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000))
              });
            }
          }

          if (allItems.length === 0) {
            response = "📅 **Follow-up Queue (All Projects)**\n\n_No follow-up items pending across any project._";
          } else {
            let msg = `📅 **Follow-up Queue (All Projects)** - ${allItems.length} item(s)\n\n`;
            for (const item of allItems.slice(0, 15)) {
              msg += `• **[${item.channel}]** ${item.title}\n`;
              if (item.due_context) {
                msg += `   ⏰ ${item.due_context}\n`;
              }
              msg += `   Age: ${item.age_days}d | Status: ${item.status}\n\n`;
            }
            if (allItems.length > 15) {
              msg += `_...and ${allItems.length - 15} more items_`;
            }
            response = msg;
          }
        } else {
          // Show follow-up queue for current channel only
          const queue = memory.getFollowUpQueue(channelId, 'pending');
          if (queue.length === 0) {
            response = "📅 **Follow-up Queue (This Channel)**\n\n_No follow-up items pending for this channel._\n\nUse `!followup-queue all` to see items across all projects.";
          } else {
            let msg = `📅 **Follow-up Queue (This Channel)** - ${queue.length} item(s)\n\n`;
            for (const item of queue) {
              const age = Math.round((Date.now() - (item.created_at || 0)) / (24 * 60 * 60 * 1000));
              msg += `• **${item.title}**\n`;
              if (item.due_context) {
                msg += `   ⏰ ${item.due_context}\n`;
              }
              msg += `   Age: ${age}d | Status: ${item.status}\n\n`;
            }
            msg += `\n_Use \`!followup-queue all\` to see items across all projects._`;
            response = msg;
          }
        }
        break;

      // ===== DOCUMENT INDEX COMMANDS =====
      case 'docs':
        const docsSubCmd = (cmd.args[0] || 'stats').toLowerCase();
        const docsArg = cmd.args[1] || '';

        if (docsSubCmd === 'stats') {
          const stats = await pdfUtils.getVectorStats(channelId);
          if (!stats) {
            response = "📚 **Document Index**\n\n_Vector store not available._";
          } else if (stats.totalChunks === 0) {
            response = "📚 **Document Index**\n\n_No documents indexed yet._\n\nUpload PDFs or DOCX files to enable semantic search.";
          } else {
            let msg = `📚 **Document Index Stats**\n\n`;
            msg += `• **Total chunks indexed:** ${stats.totalChunks}\n`;
            msg += `• **Documents:** ${stats.documents}\n\n`;
            if (Object.keys(stats.byFile).length > 0) {
              msg += `**By Document:**\n`;
              for (const [file, count] of Object.entries(stats.byFile)) {
                msg += `• ${file}: ${count} chunks\n`;
              }
            }
            msg += `\n_Use \`!docs search [query]\` to find relevant content._`;
            response = msg;
          }
        } else if (docsSubCmd === 'list') {
          const vectorStore = await import('../shared/vectorstore.js');
          const docs = await vectorStore.listDocuments(channelId);
          if (!docs || docs.length === 0) {
            response = "📚 **Indexed Documents (This Channel)**\n\n_No documents indexed._";
          } else {
            let msg = `📚 **Indexed Documents (This Channel)** - ${docs.length} document(s)\n\n`;
            for (const doc of docs) {
              const date = new Date(doc.createdAt).toLocaleDateString();
              msg += `• **${doc.fileName}** - ${doc.chunks} chunks (${date})\n`;
            }
            response = msg;
          }
        } else if (docsSubCmd === 'search' && docsArg) {
          const results = await pdfUtils.searchDocuments(docsArg, { channelId, limit: 5 });
          if (!results || results.length === 0) {
            response = `🔍 **Document Search:** "${docsArg}"\n\n_No matching content found._`;
          } else {
            let msg = `🔍 **Document Search:** "${docsArg}"\n\n`;
            for (const r of results) {
              const source = r.section ? `${r.fileName} > ${r.section}` : r.fileName;
              const score = (r.score * 100).toFixed(0);
              msg += `**[${score}%] ${source}**\n`;
              msg += `> ${r.text.substring(0, 300)}${r.text.length > 300 ? '...' : ''}\n\n`;
            }
            response = msg;
          }
        } else {
          response = `📚 **Document Index Commands**\n\n• \`!docs\` or \`!docs stats\` - Show index statistics\n• \`!docs list\` - List indexed documents\n• \`!docs search [query]\` - Search document content`;
        }
        break;

      // ===== SEMANTIC MEMORY COMMANDS =====
      case 'memory':
        const memSubCmd = (cmd.args[0] || 'stats').toLowerCase();
        const memArg = cmd.args[1] || '';

        if (memSubCmd === 'stats') {
          try {
            const stats = await semanticMemory.getStats();
            let msg = `🧠 **Semantic Memory Stats**\n\n`;
            msg += `**Documents:**\n`;
            msg += `• Files: ${stats.documents.files}\n`;
            msg += `• Chunks: ${stats.documents.chunks}\n\n`;
            msg += `**Conversations:**\n`;
            msg += `• Messages: ${stats.conversations.messages}\n`;
            msg += `• Channels: ${stats.conversations.channels}\n`;
            msg += `• Users: ${stats.conversations.users}\n\n`;
            msg += `**Knowledge Graph:**\n`;
            msg += `• Nodes: ${stats.graph.nodes}\n`;
            msg += `• Edges: ${stats.graph.edges}\n`;
            if (stats.graph.byType) {
              msg += `• Types: ${Object.entries(stats.graph.byType).map(([k,v]) => `${k}(${v})`).join(', ')}\n`;
            }
            response = msg;
          } catch (err) {
            response = `🧠 **Semantic Memory**\n\n_Error getting stats: ${err.message}_`;
          }
        } else if (memSubCmd === 'search' && memArg) {
          try {
            const results = await semanticMemory.search(memArg, { limit: 5 });
            let msg = `🔍 **Memory Search:** "${memArg}"\n\n`;

            if (results.conversations.length > 0) {
              msg += `**Conversations:**\n`;
              for (const r of results.conversations.slice(0, 3)) {
                const date = new Date(r.timestamp).toLocaleDateString();
                const score = (r.score * 100).toFixed(0);
                msg += `• [${score}%] **${r.userName}** in #${r.channelName} (${date})\n`;
                msg += `  > ${r.text.substring(0, 150)}${r.text.length > 150 ? '...' : ''}\n`;
              }
            }

            if (results.documents.length > 0) {
              msg += `\n**Documents:**\n`;
              for (const r of results.documents.slice(0, 3)) {
                const score = (r.score * 100).toFixed(0);
                msg += `• [${score}%] **${r.fileName}**\n`;
                msg += `  > ${r.text.substring(0, 150)}${r.text.length > 150 ? '...' : ''}\n`;
              }
            }

            if (results.conversations.length === 0 && results.documents.length === 0) {
              msg += `_No matching content found._`;
            }
            response = msg;
          } catch (err) {
            response = `🔍 **Memory Search**\n\n_Error: ${err.message}_`;
          }
        } else if (memSubCmd === 'graph' && memArg) {
          try {
            const personContext = await semanticMemory.getPersonContext(memArg);
            let msg = `🕸️ **Knowledge Graph:** ${memArg}\n\n`;
            if (personContext.topics.length > 0) {
              msg += `**Topics mentioned:** ${personContext.topics.slice(0, 10).join(', ')}\n`;
            }
            if (personContext.decisions.length > 0) {
              msg += `**Decisions:** ${personContext.decisions.length}\n`;
            }
            if (personContext.mentions.length > 0) {
              msg += `**Mentions:** ${personContext.mentions.length}\n`;
            }
            if (personContext.topics.length === 0 && personContext.decisions.length === 0) {
              msg += `_No graph data found for "${memArg}"._`;
            }
            response = msg;
          } catch (err) {
            response = `🕸️ **Knowledge Graph**\n\n_Error: ${err.message}_`;
          }
        } else {
          response = `🧠 **Semantic Memory Commands**\n\n• \`!memory\` or \`!memory stats\` - Show memory statistics\n• \`!memory search [query]\` - Search conversations & documents\n• \`!memory graph [userId]\` - Show knowledge graph for a user`;
        }
        break;
    }

    if (response) {
      // Use root_id for thread replies, otherwise reply to the post
      const replyTo = post.root_id || post.id;
      await postMessage(channelId, maybeAddHint(channelId, response), replyTo);
    }
    return;
  }

  // Handle file uploads - analyze images if @scout was mentioned
  if (post.file_ids && post.file_ids.length > 0) {
    const shouldAnalyzeImages = message.toLowerCase().includes('@scout');
    await handleFileUpload(post, shouldAnalyzeImages);
  }

  // ============ LLM-FIRST INTENT CLASSIFICATION ============
  // Check if Scout is mentioned - if so, use AI to understand intent
  const isMentioned = message.toLowerCase().includes('@scout');

  if (!isMentioned) {
    // Not mentioned - only do passive reactions (celebrate wins, etc.)
    if (detectWin(message) && Math.random() < 0.3) {
      await addReaction(post.id, 'tada');
    }
    return; // Don't respond if not mentioned
  }

  // Scout was mentioned - classify intent using LLM
  log('info', 'Scout mentioned, classifying intent...', { channelId });
  const channelData = state.channels.get(channelId);
  const intent = await classifyIntent(message, channelState.messages, channelData?.name || '');

  // Handle based on classified intent
  if (!intent.respond) {
    log('info', 'Intent classified as no-response', { intent: intent.intent, reason: intent.reason });
    if (intent.reaction) {
      const emojiMap = { '👍': 'thumbsup', '🙌': 'raised_hands', '✨': 'sparkles', '👋': 'wave', '🎉': 'tada' };
      const emojiName = emojiMap[intent.reaction] || 'thumbsup';
      await addReaction(post.id, emojiName);
    }
    return;
  }

  log('info', 'Responding to message', { intent: intent.intent, persona: intent.persona });

  // Handle special intents with dedicated handlers
  if (intent.intent === 'jira_request') {
    const jiraResponse = await handleJiraRequest(channelId, message);
    await postMessage(channelId, jiraResponse, post.root_id || post.id);
    channelState.messages.push({ role: 'assistant', content: jiraResponse, timestamp: Date.now() });
    return;
  }

  if (intent.intent === 'github_request') {
    const githubResponse = await handleGitHubRequest(channelId, message);
    await postMessage(channelId, githubResponse, post.root_id || post.id);
    channelState.messages.push({ role: 'assistant', content: githubResponse, timestamp: Date.now() });
    return;
  }

  // Build conversation context based on intent
  let conversationMessages;
  let historyContext = '';
  const persona = intent.persona || 'default';

  if (intent.load_history) {
    // Load from persistent history for summary requests
    let historyMessages;
    const hours = intent.time_range_hours || 8; // Default 8 hours
    const startTime = Date.now() - (hours * 60 * 60 * 1000);
    historyMessages = memory.getHistoryByTimeRange(channelId, startTime, Date.now());
    log('info', 'Loading history for summary', { channelId, hours, messages: historyMessages.length });

    if (historyMessages.length > 0) {
      historyContext = `\n[Channel Message History - ${historyMessages.length} messages from last ${hours} hours]\n` +
        historyMessages.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.username || 'unknown'}: ${m.content}`).join('\n') +
        '\n[End of History]\n';
    }
    conversationMessages = [{ role: 'user', content: message }];
  } else {
    // Normal conversation - use recent in-memory messages
    conversationMessages = channelState.messages.slice(-10).map(m => ({
      role: m.role || 'user',
      content: m.content
    }));
  }

  // --- MEMORY INJECTION ---
  const username = await getUsername(post.user_id);
  const userMem = memory.getUserMemory(username);
  const channelMem = memory.getChannelMemory(channelId);
  const globalFacts = memory.getGlobalFacts();

  // Detect target channel override
  let targetChannelId = channelId;
  const channelMention = message.match(/#([a-z0-9_-]+)/i);
  if (channelMention) {
    const targetName = channelMention[1].toLowerCase();
    for (const [id, data] of state.channels) {
      if ((data.name || '').toLowerCase() === targetName) {
        targetChannelId = id;
        break;
      }
    }
  }
  const activeChannelMem = (targetChannelId === channelId) ? channelMem : memory.getChannelMemory(targetChannelId);

  let projectMem = null;
  const projectMatch = message.match(/\b(OPAL|SCRUM|ESP32)\b/i);
  if (projectMatch) {
    projectMem = memory.getProjectMemory(projectMatch[1].toUpperCase());
  }

  const memoryContext = `
[User Context]
User: @${username}
Role: ${userMem.identity?.role || 'Unknown'}
Preferences: ${JSON.stringify(userMem.preferences || {})}

[Channel Context]
Topics: ${activeChannelMem.current_topics?.join(", ") || 'None'}
Decisions: ${activeChannelMem.recent_decisions?.join(", ") || 'None'}

[Global Facts]
${globalFacts.general_knowledge?.join("\n") || ''}

${projectMem ? `[Project Status (${projectMem.source})]
${JSON.stringify(projectMem, null, 2)}` : ""}
${historyContext}
`;
  // ------------------------

  const response = await getAIResponse(conversationMessages, persona, memoryContext);

  if (response) {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    await postMessage(channelId, maybeAddHint(channelId, response), post.root_id || post.id);

    channelState.messages.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });
  }
}

// Proactive check-in for silent channels
async function checkSilentChannels() {
  if (!config.scout.enableSilenceBreaking) return;

  const now = Date.now();
  const silenceThreshold = config.scout.silenceThresholdMinutes * 60 * 1000;

  for (const [channelId, channelState] of state.channels) {
    // Check channel preferences
    const safeName = (channelState.name || channelId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const channelMem = memory.getChannelMemory(safeName);
    const freq = channelMem.preferences?.checkInFrequency || getChannelPrefs(channelId).checkInFrequency || 'normal';

    if (freq === 'quiet') {
      continue; // Skip quiet channels
    }

    const silenceDuration = now - channelState.lastActivity;

    if (silenceDuration > silenceThreshold) {
      if (!channelState.lastCheckIn || (now - channelState.lastCheckIn) > silenceThreshold * 2) {
        const prompts = [
          "Hey team! It's been quiet here. Anyone working on something interesting they'd like to share? 💬",
          "Quick check-in: How's everyone doing? Any wins to celebrate or challenges to discuss? 🎯",
          "Hello! Just checking in. Need any help with research, brainstorming, or GitHub updates? Use `!research`, `!brainstorm`, or `!github` commands!",
          "The channel's been quiet - hope that means great focus time! Let me know if you need anything. 🚀",
          "Any updates, blockers, or topics you'd like to explore? I can help with `!research [topic]` for deep analysis or `!brainstorm [topic]` for creative ideas!"
        ];

        const message = prompts[Math.floor(Math.random() * prompts.length)];
        await postMessage(channelId, message);

        channelState.lastCheckIn = now;
        channelState.lastActivity = now;

        log('info', 'Sent silence-breaking message', { channelId, silenceDuration });
      }
    }
  }
}

// Command offerings - rotate through these to keep it fresh
const commandOfferings = [
  {
    title: "Research & Analysis",
    commands: [
      "`!research [topic]` - Get 5 hypotheses with probabilities",
      "`!brainstorm [topic]` - Creative ideas with success odds"
    ],
    example: "Try: `!research best practices for remote teams`"
  },
  {
    title: "GitHub Integration",
    commands: [
      "`!github [owner/repo]` - See commits, PRs, and issues",
      "`!update [owner/repo]` - Generate a product update"
    ],
    example: "Try: `!github hwillGIT/OPALproject`"
  },
  {
    title: "Channel Tools",
    commands: [
      "`!summary` - Digest of recent discussions",
      "`!summary 48` - Last 48 hours of activity"
    ],
    example: "Try: `!summary` to catch up on what you missed"
  },
  {
    title: "Customize Me",
    commands: [
      "`!config` - See your current settings",
      "`!askme` - I'll ask how to serve you better",
      "`!focus [topic]` - Topics I should prioritize"
    ],
    example: "Try: `!askme` and tell me what to improve!"
  }
];

function getRandomOffering() {
  return commandOfferings[Math.floor(Math.random() * commandOfferings.length)];
}

// Scheduled check-ins
async function scheduledCheckIn() {
  if (!config.scout.enableProactiveCheckins) return;

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const minute = now.getMinutes();

  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  if (hour < 9 || hour > 17) return;

  let message = null;

  // Morning (9 AM)
  if (hour === 9 && minute < 15) {
      message = `☀️ **What's the one thing worth exploring today?**\n\nDrop me a topic - research, brainstorm, or summary. I'll deliver insights in minutes.\n\n_Example: "Scout, research best practices for remote team communication"_`;
  }
  // Late morning (11 AM Tue/Thu)
  else if ((dayOfWeek === 2 || dayOfWeek === 4) && hour === 11 && minute < 15) {
      message = `💡 **Got a question that's been nagging you?**\n\nThrow it my way. You'll have 5 hypotheses with probabilities before lunch.\n\nTry: 
!research [your question]`;
  }
  // Midday (12 PM Wed)
  else if (dayOfWeek === 3 && hour === 12 && minute < 15) {
      message = `🔬 **What's blocking progress this week?**\n\nName the challenge. McKinsey-quality analysis, delivered in minutes.\n\n!research [your biggest blocker]`;
  }
  // End of day (4 PM)
  else if (hour === 16 && minute < 15) {
      message = `🌅 **Before you sign off - anything worth capturing?**\n\n• !summary - Today's discussions, distilled\n• !savelast [name] - Lock in that research for later\n\n_Don't let good insights slip away._`;
  }
  // Friday (3 PM)
  else if (dayOfWeek === 5 && hour === 15 && minute < 15) {
      message = `🎯 **What do you know now that you wish you knew Monday?**\n\nLet's turn it into next week's advantage:\n• !summary 168 - This week's key discussions\n• !research [a lesson learned] - Go deeper on what worked (or didn't)`;
  }

  if (message) {
    for (const [channelId, channelData] of state.channels) {
        // SOCIAL INTELLIGENCE: Check Memory Preferences
        const safeName = (channelData.name || channelId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const channelMem = memory.getChannelMemory(safeName);
        const freq = channelMem.preferences?.checkInFrequency || 'normal';

        if (freq === 'quiet') {
            log('info', `Skipping check-in for ${channelData.name} (quiet mode)`);
            continue;
        }
        
        await postMessage(channelId, message);
    }
  }
}
// Handle reaction for capture approval
async function handleReaction(reaction) {
  const postId = reaction.post_id;
  const emojiName = reaction.emoji_name;
  const userId = reaction.user_id;

  // Ignore bot's own reactions
  if (userId === state.botUserId) return;

  // Check if this is a pending capture approval
  if (!capture.hasPendingCapture(postId)) return;

  // Only process checkmark or x reactions
  if (emojiName !== 'white_check_mark' && emojiName !== 'heavy_check_mark' &&
      emojiName !== '+1' && emojiName !== 'x' && emojiName !== '-1') {
    return;
  }

  const pendingData = capture.getPendingCapture(postId);
  if (!pendingData) return;

  const isApproved = emojiName === 'white_check_mark' ||
                     emojiName === 'heavy_check_mark' ||
                     emojiName === '+1';

  if (isApproved) {
    log('info', 'Capture approved', { postId, userId });
    try {
      const results = await capture.executeCapture(anthropic, pendingData);
      const resultMsg = capture.formatCaptureMessage(results);
      if (resultMsg) {
        await postMessage(pendingData.channelId, `✅ **Captured!**\n\n${resultMsg}`, postId);
      }
    } catch (err) {
      log('error', 'Failed to execute approved capture', { error: err.message });
      await postMessage(pendingData.channelId, `❌ Failed to capture items: ${err.message}`, postId);
    }
  } else {
    log('info', 'Capture rejected', { postId, userId });
    await postMessage(pendingData.channelId, `👍 No problem - skipped capture.`, postId);
  }
}

// Handle when Scout is added to a channel - post welcome message
const CHANNEL_ADD_LOCK_DIR = '/opt/mattermost/bots-v2/shared/data/channel-locks';

async function handleBotAddedToChannel(channelId) {
  try {
    // File-based lock to prevent duplicate posts from multiple workers
    const lockFile = `${CHANNEL_ADD_LOCK_DIR}/${channelId}.lock`;
    try {
      if (!fs.existsSync(CHANNEL_ADD_LOCK_DIR)) {
        fs.mkdirSync(CHANNEL_ADD_LOCK_DIR, { recursive: true });
      }
      // Check if lock exists and is recent (within 30 seconds)
      if (fs.existsSync(lockFile)) {
        const lockTime = fs.statSync(lockFile).mtimeMs;
        if (Date.now() - lockTime < 30000) {
          return; // Another worker is handling this
        }
      }
      // Create/update lock file
      fs.writeFileSync(lockFile, Date.now().toString());
    } catch (lockErr) {
      // Lock failed, skip to avoid duplicates
      return;
    }

    // Also skip if we've already introduced ourselves
    if (state.introducedChannels.has(channelId)) {
      return;
    }

    log('info', 'Scout added to channel', { channelId });

    const welcomeMessage = `👋 **Hi, I'm Scout** - your research & PM assistant!

**Quick start:** Type \`!scout\` to see all my commands

**Popular commands:**
• \`!research [topic]\` - Deep analysis with web search
• \`!brainstorm [idea]\` - Probabilistic brainstorming
• \`!dashboard\` - Project status overview
• \`!jira [type] [title]\` - Create Jira issues

Or just ask me a question naturally - I'm always listening!

_Tip: Use \`!setdepth deep\` for more thorough research._`;

    await postMessage(channelId, welcomeMessage);
    state.introducedChannels.add(channelId);
  } catch (error) {
    log('error', 'Failed to post welcome message', { channelId, error: error.message });
  }
}

// WebSocket message handler
function handleWebSocketMessage(data) {
  try {
    const event = JSON.parse(data);

    if (event.event === 'posted') {
      const post = JSON.parse(event.data.post);
      handleMessage(post);
    } else if (event.event === 'reaction_added') {
      const reaction = JSON.parse(event.data.reaction);
      handleReaction(reaction);
    } else if (event.event === 'channel_viewed') {
      const channelId = event.data.channel_id;
      if (state.channels.has(channelId)) {
        state.channels.get(channelId).lastActivity = Date.now();
      }
    } else if (event.event === 'user_added') {
      // Check if Scout was added to a channel
      const userId = event.data.user_id;
      const channelId = event.broadcast?.channel_id;
      if (userId === state.botUserId && channelId) {
        handleBotAddedToChannel(channelId);
      }
    }
  } catch (error) {
    log('error', 'WebSocket message parse error', { error: error.message });
  }
}

// Connect to WebSocket
async function connectWebSocket() {
  return new Promise((resolve, reject) => {
    const wsUrl = `${config.mattermost.wsUrl}/api/v4/websocket`;
    log('info', 'Connecting to WebSocket', { url: wsUrl });

    state.ws = new WebSocket(wsUrl);

    state.ws.on('open', () => {
      log('info', 'WebSocket connected');
      state.ws.send(JSON.stringify({
        seq: 1,
        action: 'authentication_challenge',
        data: { token: config.mattermost.botToken }
      }));
      state.reconnectAttempts = 0;
      resolve();
    });

    state.ws.on('message', handleWebSocketMessage);

    state.ws.on('close', () => {
      log('warn', 'WebSocket closed, reconnecting...');
      scheduleReconnect();
    });

    state.ws.on('error', (error) => {
      log('error', 'WebSocket error', { error: error.message });
      reject(error);
    });
  });
}

// Reconnect logic
function scheduleReconnect() {
  if (state.reconnectAttempts >= state.maxReconnectAttempts) {
    log('error', 'Max reconnect attempts reached, exiting');
    process.exit(1);
  }

  state.reconnectAttempts++;
  const delay = state.reconnectDelay * Math.pow(2, state.reconnectAttempts - 1);
  log('info', `Reconnecting in ${delay}ms`, { attempt: state.reconnectAttempts });

  setTimeout(async () => {
    try {
      await connectWebSocket();
    } catch (error) {
      scheduleReconnect();
    }
  }, delay);
}

// ============ TASK QUEUE PROCESSOR ============

let taskProcessorRunning = false;

/**
 * Process pending tasks from the queue
 */
async function processTaskQueue() {
  if (taskProcessorRunning) return; // Prevent concurrent processing
  taskProcessorRunning = true;

  try {
    const task = taskQueue.getNextTask();
    if (!task) {
      taskProcessorRunning = false;
      return;
    }

    log('info', 'Processing task', { id: task.id, type: task.type, title: task.title });
    taskQueue.startTask(task.id);

    try {
      switch (task.type) {
        case taskQueue.TASK_TYPE.FILE_PROCESS: {
          const { fileId, fileName } = task.data;
          const fileInfo = fileIndex.getFile(fileId);

          if (!fileInfo) {
            throw new Error(`File not found in index: ${fileId}`);
          }

          // Download and process
          const buffer = await downloadFile(fileId);
          if (!buffer) {
            throw new Error('Failed to download file');
          }

          const result = await fileIndex.processFile(fileInfo, buffer, { log });
          if (!result.success) {
            throw new Error(result.error || 'Processing failed');
          }

          // Store in channel memory
          const channelState = state.channels.get(task.channelId);
          if (channelState) {
            channelState.messages.push({
              role: 'system',
              content: `[${result.type.toUpperCase()}: ${result.name}]\n${result.context.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }

          // Index for vector search
          const indexContent = {
            text: result.context,
            chunks: [{ text: result.context, pageNum: 1, heading: result.name }]
          };
          await pdfUtils.indexDocument(indexContent, result.name, task.channelId, log);

          // Generate comprehensive AI analysis of the file content
          if (task.channelId) {
            let summaryLines = [];
            if (result.type === 'spreadsheet') {
              summaryLines = [
                `- **Sheets**: ${result.summary.sheets}`,
                `- **Rows**: ${result.summary.rows}`,
                `- **Formulas**: ${result.summary.formulas}`,
                result.summary.hasComplexFormulas ? `- **Complex formulas**: Yes` : null
              ].filter(Boolean);
            } else if (result.type === 'pdf' || result.type === 'document') {
              summaryLines = [
                `- **Pages**: ${result.summary.pages}`,
                `- **Chunks**: ${result.summary.chunks}`
              ];
            }

            // Use deep research workflow for comprehensive analysis
            try {
              await postMessage(task.channelId, `📊 **Analyzing ${fileName}**...\n\nPerforming deep analysis using McKinsey/HBS framework. This may take a moment.`);

              const deepAnalysisPrompt = result.type === 'spreadsheet'
                ? `You are a senior McKinsey consultant and Harvard Business School financial analyst delivering world-class strategic analysis of this spreadsheet.

## QUALITY STANDARDS (Non-negotiable)

### McKinsey Standards:
- **MECE Thinking**: Mutually Exclusive, Collectively Exhaustive - no overlaps, no gaps
- **Hypothesis-Driven**: Lead with insights, then prove them with data from the spreadsheet
- **So-What Test**: Every finding must have clear business implications
- **80/20 Focus**: Prioritize the vital few metrics over trivial many

### Harvard Business School Standards:
- **Evidence-Based**: Cite SPECIFIC numbers, cells, and calculations from the data
- **Framework Application**: Apply relevant frameworks (DCF, Unit Economics, CAC/LTV, etc.)
- **Strategic Lens**: Connect tactical numbers to strategic implications
- **Scenario Analysis**: Identify assumptions and their sensitivities

## DEEP ANALYSIS OUTPUT FORMAT

## Executive Summary
[3-5 sentences capturing the key strategic insight - what a CEO/investor needs to know in 60 seconds]

**The Core Thesis:** [One powerful sentence summarizing what this model reveals]

---

## 1. Business Model Deep Dive

### What This Spreadsheet Reveals
[Detailed analysis of the business model, pricing strategy, and go-to-market approach]

### Revenue Architecture
| Component | Value | % of Total | Strategic Implication |
|-----------|-------|------------|----------------------|
[Extract and analyze all revenue components with specific numbers]

### Unit Economics Analysis
| Metric | Value | Benchmark | Assessment |
|--------|-------|-----------|------------|
[CAC, LTV, Payback Period, Gross Margin, etc. with specific numbers from the data]

---

## 2. Financial Model Architecture

### Key Assumptions (Sensitivity Analysis)
For each major assumption, analyze:
- Current value in model
- Impact if 20% higher/lower
- Confidence level (High/Medium/Low)

### Formula Logic & Dependencies
[Trace the key calculations and their dependencies across sheets]

### Model Integrity Check
- Are the formulas internally consistent?
- What are the circular dependencies (if any)?
- What happens at boundary conditions?

---

## 3. Growth & Scaling Analysis

### Growth Trajectory
| Timeframe | Key Metric | Value | Growth Rate | Achievability |
|-----------|------------|-------|-------------|---------------|
[Extract year-by-year projections with specific numbers]

### Path to Key Milestones
[Analyze the path to major milestones like $1M ARR, $10M ARR, etc.]

### Bottlenecks & Constraints
[Identify what could limit growth based on the model assumptions]

---

## 4. Risk & Scenario Analysis

### Bull Case (What Would Make This Better)
[Specific scenarios with numbers]

### Bear Case (What Could Go Wrong)
[Specific risks with quantified impact]

### Key Assumptions to Monitor
| Assumption | Current Value | Break-Even Threshold | Risk Level |
|------------|---------------|---------------------|------------|

---

## 5. Strategic Recommendations

### Immediate Actions (0-3 months)
1. [Specific, actionable recommendation with rationale]
2. [...]
3. [...]

### Strategic Priorities (3-12 months)
1. [...]
2. [...]

### Key Questions for Leadership
- [Provocative question that challenges assumptions]
- [Question about market validation]
- [Question about resource allocation]

---

## 6. Detailed Data Tables

### Sheet-by-Sheet Key Data
[For EACH sheet, extract the most important data in well-formatted tables with ALL columns]

---

## Appendix: Raw Metrics Reference
[Comprehensive list of all key numbers extracted from the spreadsheet for quick reference]

---
*Deep analysis delivered at McKinsey/HBS standards with MECE structure and evidence-based reasoning.*`
                : `You are a senior McKinsey consultant delivering world-class document analysis.

## DEEP ANALYSIS OUTPUT FORMAT

## Executive Summary
[3-5 sentences capturing the key insights]

## Document Purpose & Context
[What is this document for? Who is the audience?]

## Key Arguments & Findings
[Detailed analysis of main points with specific citations]

## Strategic Implications
[What does this mean for decision-making?]

## Critical Assessment
[Strengths, weaknesses, gaps in the document]

## Recommendations
[Actionable next steps based on the document content]

---
*Analysis delivered at McKinsey standards.*`;

              // Use full context for deep analysis (up to 60k chars)
              const fullContext = result.context.substring(0, 60000);

              // Generate comprehensive chunked analysis using model router
              await postMessage(task.channelId, `🔍 **Starting Deep Analysis**: ${result.name}\n\nThis will generate a comprehensive 30+ page report with:\n• Executive Summary & Business Overview\n• Financial Deep Dive\n• Strategic Recommendations & Risk Analysis\n\n_This may take 2-3 minutes..._`);

              const analysisText = await generateDeepAnalysis(fullContext, result.type, log);

              // Generate PDF for the full analysis
              const pdfFileName = `Analysis_${result.name.replace(/\.[^.]+$/, '')}_${Date.now()}.pdf`;
              const pdfPath = path.join('/tmp', pdfFileName);

              try {
                await generateAnalysisPDF(`Deep Analysis: ${result.name}`, analysisText, pdfPath);
                const pdfSize = fs.statSync(pdfPath).size;
                log('info', 'Generated analysis PDF', { pdfPath, size: pdfSize });

                // Upload PDF to Mattermost
                const fileId = await uploadFileToMattermost(pdfPath, task.channelId, pdfFileName);
                log('info', 'Uploaded analysis PDF', { fileId, fileName: pdfFileName });

                // Extract just the executive summary for the channel post (first section up to first ---)
                const execSummary = analysisText.split('---')[0].substring(0, 4000);

                // Post summary with PDF attachment
                const summaryMsg = `## 📊 Deep Analysis Complete: ${result.name}\n\n**File Info:**\n${summaryLines.join('\n')}\n\n---\n\n**Executive Summary:**\n\n${execSummary}\n\n---\n📎 **Full ${Math.round(pdfSize / 1024)}KB analysis attached as PDF** (${Math.round(analysisText.length / 1000)}k characters)\n\n_The complete analysis includes Financial Deep Dive and Strategic Recommendations. File content is in memory for follow-up questions._`;

                // Post with file attachment
                const postBody = {
                  channel_id: task.channelId,
                  message: summaryMsg.length > 16000 ? summaryMsg.substring(0, 16000) + '\n\n...(see attached PDF for complete analysis)' : summaryMsg,
                  file_ids: [fileId]
                };

                const postResponse = await fetch(`${config.mattermost.url}/api/v4/posts`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${config.mattermost.botToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(postBody)
                });

                if (!postResponse.ok) {
                  throw new Error(`Post failed: ${postResponse.status}`);
                }

                // Clean up temp file
                fs.unlinkSync(pdfPath);
                log('info', 'Posted deep AI analysis with PDF', { fileName, type: result.type, analysisLength: analysisText.length, pdfSize });

              } catch (pdfError) {
                log('error', 'PDF generation/upload failed, falling back to text', { error: pdfError.message });
                // Fallback: try to post with splitting
                const analysisMsg = `## 📊 Deep Analysis: ${result.name}\n\n**File Info:**\n${summaryLines.join('\n')}\n\n---\n\n${analysisText}\n\n---\n_Full file content is now in memory. Ask follow-up questions for deeper dives into specific areas._`;
                await postWithSplitting(task.channelId, analysisMsg, null, 'file-analysis');
              }
            } catch (aiError) {
              log('error', 'Deep analysis failed, posting raw summary', { error: aiError.message });
              // Fallback to basic summary
              const basicMsg = `## 📄 File Processed: ${result.name}\n\n**Summary:**\n${summaryLines.join('\n')}\n\n_File content is now in memory for questions. Ask "@scout analyze the spreadsheet" for deep analysis._`;
              await postMessage(task.channelId, basicMsg);
            }
          }

          taskQueue.completeTask(task.id, { type: result.type, summary: result.summary });
          break;
        }

        case taskQueue.TASK_TYPE.FILE_SCAN: {
          const result = await fileIndex.scanChannelFiles(task.channelId, mmApi, { log });

          // Create tasks for unprocessed files found
          const unprocessed = fileIndex.getChannelFiles(task.channelId, { unprocessedOnly: true });
          for (const file of unprocessed) {
            const fileType = fileIndex.getFileType(file);
            if (['spreadsheet', 'pdf', 'document'].includes(fileType)) {
              taskQueue.TaskFactory.fileProcess(file, task.channelId, 'scout');
            }
          }

          if (task.channelId) {
            await postMessage(task.channelId,
              `✅ **Scan Complete**: Found ${result.added} new files\n- Created ${unprocessed.length} processing tasks\n\nUse \`!tasks\` to see pending work.`
            );
          }

          taskQueue.completeTask(task.id, result);
          break;
        }

        case taskQueue.TASK_TYPE.REMINDER: {
          const { message } = task.data;
          if (task.channelId) {
            await postMessage(task.channelId, `⏰ **Reminder**: ${message}`);
          }
          taskQueue.completeTask(task.id);
          break;
        }

        case taskQueue.TASK_TYPE.FOLLOW_UP: {
          const { item } = task.data;
          if (task.channelId) {
            await postMessage(task.channelId,
              `📌 **Follow-up**: ${item}\n\n_This was scheduled for follow-up. Reply to discuss or use \`!task done ${task.id.substring(0, 8)}\` to mark complete._`
            );
          }
          taskQueue.completeTask(task.id);
          break;
        }

        case taskQueue.TASK_TYPE.CREW_PIPELINE: {
          const { pipelineType, topic } = task.data;

          // Get channel context
          let context = '';
          const channelState = state.channels.get(task.channelId);
          if (channelState) {
            context = channelState.messages
              .slice(-30)
              .filter(m => m.content)
              .map(m => m.content)
              .join('\n');
          }

          await postMessage(task.channelId, `🤖 **Starting Crew ${pipelineType}**: ${topic}...`);

          const result = await crew.runPipeline(pipelineType, topic, context, { log });

          await postWithSplitting(task.channelId,
            `## 🤖 Crew ${pipelineType}: ${topic}\n\n${result.finalOutput}`,
            null, `crew-${pipelineType}`
          );

          taskQueue.completeTask(task.id, { stages: result.stages.length });
          break;
        }

        default:
          log('warn', 'Unknown task type', { type: task.type });
          taskQueue.completeTask(task.id, { skipped: true });
      }
    } catch (err) {
      log('error', 'Task processing failed', { id: task.id, error: err.message });
      taskQueue.failTask(task.id, err.message);
    }
  } catch (err) {
    log('error', 'Task queue processor error', { error: err.message });
  } finally {
    taskProcessorRunning = false;
  }
}

/**
 * Scan and index files on startup - files are auto-loaded into context when uploaded
 */
async function populateTasksFromUnprocessedFiles() {
  try {
    let totalFiles = 0;

    // Scan all monitored channels for files
    for (const [channelId, channelData] of state.channels) {
      const scanResult = await fileIndex.scanChannelFiles(channelId, mmApi, { log, limit: 50 });
      totalFiles += scanResult.added;
      if (scanResult.added > 0) {
        log('info', 'Indexed files from channel', { channel: channelData.name, files: scanResult.added });
      }
    }

    // Just log stats - files are already in context from upload, no need to create tasks
    const fileStats = fileIndex.getStats();
    const taskStats = taskQueue.getStats();

    log('info', 'Startup scan complete', {
      newFilesIndexed: totalFiles,
      totalFilesKnown: fileStats.totalFiles,
      pendingTasks: taskStats.pending
    });
  } catch (err) {
    log('error', 'Failed to scan files on startup', { error: err.message });
  }
}

// Initialize bot
// Dashboard scheduler state
const dashboardState = {
  lastPostedDates: {} // Track when dashboard was last posted for each schedule
};

// Check and run scheduled dashboard
async function checkDashboardSchedule() {
  if (!config.dashboard?.enabled) return;

  const schedules = config.dashboard.schedules || [];
  const targetChannel = config.dashboard.targetChannel;
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];
  const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
  const currentHour = now.getHours();

  for (const schedule of schedules) {
    const scheduleKey = `${schedule.dayOfWeek}-${schedule.hour}`;

    // Check if it's time for this schedule
    if (currentDay === schedule.dayOfWeek &&
        currentHour === schedule.hour &&
        dashboardState.lastPostedDates[scheduleKey] !== todayKey) {

      log('info', `Running scheduled dashboard: ${schedule.label || 'Weekly'}`);

      try {
        // Find the target channel
        let channelId = null;
        for (const [id, data] of state.channels) {
          if (data.name && data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').includes(targetChannel.toLowerCase())) {
            channelId = id;
            break;
          }
        }

        // Try to find by channel name via API if not in cache
        if (!channelId) {
          const teams = await mmApi('/users/me/teams');
          for (const team of teams) {
            try {
              const channel = await mmApi(`/teams/${team.id}/channels/name/${targetChannel}`);
              if (channel) {
                channelId = channel.id;
                break;
              }
            } catch (e) {
              // Channel not found in this team, continue
            }
          }
        }

        if (channelId) {
          // Generate and post dashboard
          const dashboardData = await dashboard.generateDashboard(
            config.dashboard.timeRangeDays || 7,
            schedule.label || 'Weekly'
          );

          await postMessage(channelId, dashboardData.formatted_text);

          // Post chart links
          if (config.dashboard.includeCharts && dashboardData.charts) {
            let chartMsg = '**Dashboard Charts:**\n\n';
            if (dashboardData.charts.flow_velocity) {
              chartMsg += `[Flow Velocity](${dashboardData.charts.flow_velocity})\n`;
            }
            if (dashboardData.charts.activity_trend) {
              chartMsg += `[Activity Trend](${dashboardData.charts.activity_trend})\n`;
            }
            if (dashboardData.charts.task_distribution) {
              chartMsg += `[Task Distribution](${dashboardData.charts.task_distribution})\n`;
            }
            await postMessage(channelId, chartMsg);
          }

          dashboardState.lastPostedDates[scheduleKey] = todayKey;
          log('info', `Dashboard posted to #${targetChannel}`);
        } else {
          log('warn', `Dashboard channel not found: ${targetChannel}`);
        }
      } catch (err) {
        log('error', 'Scheduled dashboard failed', { error: err.message });
      }
    }
  }
}

async function init() {
  log('info', 'Starting Scout Bot - Research & PM Assistant');

  // Load saved preferences
  loadPreferences();

  // Initialize semantic memory (vector + graph stores)
  try {
    await semanticMemory.init({ log: (level, msg, data) => log(level, `[Memory] ${msg}`, data) });
    log('info', 'Semantic memory initialized');
  } catch (err) {
    log('warn', 'Semantic memory init failed, continuing without', { error: err.message });
  }

  try {
    const me = await mmApi('/users/me');
    state.botUserId = me.id;
    log('info', 'Bot authenticated', { userId: me.id, username: me.username });

    const teams = await mmApi('/users/me/teams');
    for (const team of teams) {
      const channels = await mmApi(`/users/me/teams/${team.id}/channels`);
      for (const channel of channels) {
        if (channel.type === 'O' || channel.type === 'P') {
          // PREFETCH HISTORY - fetch from API and persist to disk
          let initialMessages = [];
          const ignoredBots = config.scout?.ignoreBotUserIds || [];
          try {
              const hist = await mmApi(`/channels/${channel.id}/posts?per_page=100`);
              if (hist && hist.posts) {
                  const posts = Object.values(hist.posts).sort((a, b) => a.create_at - b.create_at);
                  // Filter out bot messages to prevent echo chamber in history
                  const filteredPosts = posts.filter(p => {
                      // Skip messages from bots (from_bot flag)
                      if (p.props?.from_bot === 'true' || p.props?.from_bot === true) return false;
                      // Skip messages from ignored bot IDs
                      if (ignoredBots.includes(p.user_id)) return false;
                      // Skip empty messages
                      if (!p.message || p.message.trim() === '') return false;
                      return true;
                  });
                  initialMessages = filteredPosts.map(p => ({
                      id: p.id,
                      role: p.user_id === state.botUserId ? 'assistant' : 'user',
                      content: p.message,
                      userId: p.user_id,
                      timestamp: p.create_at
                  }));
                  // Persist to disk
                  const result = memory.bulkAppendMessages(channel.id, initialMessages);
                  log('info', `Synced history for ${channel.name}`, { added: result.added, total: result.total, filtered: posts.length - filteredPosts.length });
              }
          } catch (err) {
              log('warn', `Failed to prefetch history for ${channel.name}`, { error: err.message });
              // Try loading from persistent storage if API fails
              initialMessages = memory.getRecentHistory(channel.id, 100);
              if (initialMessages.length > 0) {
                  log('info', `Loaded ${initialMessages.length} messages from disk for ${channel.name}`);
              }
          }

          state.channels.set(channel.id, {
            lastActivity: Date.now(),
            messages: initialMessages,
            name: channel.display_name
          });
          state.conversationHistory.set(channel.id, []);
        }
      }
    }

    log('info', 'Monitoring channels', { count: state.channels.size });

    await connectWebSocket();

    // Scheduled tasks - DISABLED: respond only when mentioned
    // setInterval(checkSilentChannels, 5 * 60 * 1000);
    // setInterval(scheduledCheckIn, 15 * 60 * 1000);

    // Dashboard scheduler - check every 15 minutes
    if (config.dashboard?.enabled) {
      setInterval(checkDashboardSchedule, 15 * 60 * 1000);
      log('info', 'Dashboard scheduler enabled', {
        schedules: config.dashboard.schedules?.length || 0,
        targetChannel: config.dashboard.targetChannel
      });
    }

    // Task processor - check every 30 seconds
    setInterval(processTaskQueue, 30 * 1000);
    log('info', 'Task processor enabled', { interval: '30s' });

    // Populate task queue with unprocessed files on startup
    await populateTasksFromUnprocessedFiles();

    log('info', 'Scout Bot started successfully');
    log('info', 'Commands available: !research, !brainstorm, !github, !summary, !update, !issue, !dashboard, !files, !analyze, !tasks');

  } catch (error) {
    log('error', 'Initialization failed', { error: error.message });
    process.exit(1);
  }
}

init();

async function getUsername(userId) {
  if (state.userCache.has(userId)) {
    return state.userCache.get(userId);
  }
  try {
    const user = await mmApi(`/users/${userId}`);
    state.userCache.set(userId, user.username);
    return user.username;
  } catch (err) {
    log("error", "Failed to fetch username", { userId, error: err.message });
    return "unknown_user";
  }
}

