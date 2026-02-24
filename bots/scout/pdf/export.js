// Scout PDF generation - deep analysis, pandoc/xelatex, PDFKit fallback
// This is Scout-unique functionality

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import PDFDocument from 'pdfkit';
import { publishPDF } from 'bots-shared/publish-pdf.js';
import llm from 'bots-shared/llm.js';

// Convert ASCII art tables to proper markdown tables
export function convertAsciiTablesToMarkdown(text) {
  const asciiTablePattern = /(\+[-+]+\+[\s\S]*?\+[-+]+\+)/g;

  return text.replace(asciiTablePattern, (table) => {
    const lines = table.split('\n').filter(l => l.trim());
    const dataRows = [];

    for (const line of lines) {
      if (/^[+\-\s]+$/.test(line)) continue;
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

    const mdLines = [];
    const header = dataRows[0];
    mdLines.push('| ' + header.join(' | ') + ' |');
    mdLines.push('| ' + header.map(() => '---').join(' | ') + ' |');

    for (let i = 1; i < dataRows.length; i++) {
      while (dataRows[i].length < header.length) {
        dataRows[i].push('');
      }
      mdLines.push('| ' + dataRows[i].join(' | ') + ' |');
    }

    return '\n' + mdLines.join('\n') + '\n';
  });
}

// Ensure markdown tables have proper format for pandoc
export function fixMarkdownTables(text) {
  const lines = text.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      result.push(line);
      if (i > 0 && !lines[i - 1]?.trim().startsWith('|') &&
          nextLine.trim().startsWith('|') && !nextLine.includes('---')) {
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
export function preprocessMarkdownForPandoc(markdown) {
  let processed = convertAsciiTablesToMarkdown(markdown);
  processed = fixMarkdownTables(processed);

  return processed
    .replace(/[\u2192\u2794\u27A1\u279C]/g, '->')
    .replace(/[\u2190\u2B05]/g, '<-')
    .replace(/[\u2194]/g, '<->')
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&(?!amp;|lt;|gt;|#)/g, '\\&')
    .replace(/_(?![a-zA-Z0-9])/g, '\\_')
    .replace(/\^(?!\{)/g, '\\^{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/([^#\n])#([^#\n])/g, '$1\\#$2')
    .replace(/[^\x00-\x7F\u00C0-\u017F]/g, '');
}

// Comprehensive deep analysis using model router with full token capacity
export async function generateDeepAnalysis(content, type, log) {
  const chunks = [];

  log('info', 'Starting chunked deep analysis', { type, contentLength: content.length });

  const tableFormatInstruction = `

TABLE FORMAT: Use proper markdown pipe tables:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |

Do NOT use ASCII art tables with +---+ borders.`;

  // 1. Executive Summary & Business Overview
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

  // 2. Financial Deep Dive
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
4. **Interpretation**: What does this mean for the business?
5. **Implications**: What should stakeholders do with this information?

## TOPICS TO COVER (with narrative depth)
- Revenue Model & Unit Economics
- Cost Structure: fixed vs variable, scale effects
- Profitability Path: margin trajectory
- Cash Flow & Funding: Runway analysis
- Key Metrics & KPIs

${tableFormatInstruction}

Write with the analytical rigor of a Goldman research report.`,
    maxTokens: 16000
  });
  chunks.push('\n\n---\n\n## Financial Deep Dive\n\n' + financial.text);
  log('info', 'Financial deep dive complete', { tokens: financial.usage?.output_tokens || 'unknown' });

  // 3. Strategic Recommendations & Risk Analysis
  log('info', 'Generating strategic recommendations...');
  const strategy = await llm.research([
    { role: 'user', content: `Based on this analysis, provide strategic recommendations with detailed discussion, risk assessment, and scenario analysis:\n\nEXECUTIVE SUMMARY:\n${chunks[0].substring(0, 20000)}\n\nFINANCIAL DATA:\n${chunks[1].substring(0, 20000)}` }
  ], {
    system: `You are a McKinsey senior partner presenting strategic recommendations to the CEO and board.

## WRITING STYLE REQUIREMENTS

1. **Prescriptive Clarity**: Be specific and actionable
2. **Rationale-First**: Explain WHY before WHAT
3. **Trade-off Discussion**: Acknowledge alternatives considered
4. **Implementation Reality**: Discuss practical considerations
5. **Risk Integration**: Weave risk awareness throughout

## STRUCTURE

### Strategic Recommendations (60% of content - mostly narrative)
For each major recommendation:
- **The Recommendation** (1 sentence)
- **Strategic Rationale** (2-3 paragraphs)
- **Implementation Roadmap** (narrative)
- **Success Metrics**
- **Risks & Mitigations**

### Risk Assessment (with discussion)
- Discuss each major risk category with probability and impact reasoning

### Scenario Analysis (with narrative)
- Don't just show numbers - explain the logic behind each scenario
- Discuss trigger points and decision gates

${tableFormatInstruction}

Write as if presenting to a board that expects strategic depth.`,
    maxTokens: 16000
  });
  chunks.push('\n\n---\n\n## Strategic Recommendations & Risk Analysis\n\n' + strategy.text);
  log('info', 'Strategic recommendations complete', { tokens: strategy.usage?.output_tokens || 'unknown' });

  const fullAnalysis = chunks.join('');
  log('info', 'Deep analysis complete', { totalLength: fullAnalysis.length });

  return fullAnalysis;
}

// Generate PDF using pandoc with xelatex engine
export async function generateAnalysisPDF(title, analysisText, outputPath) {
  const tmpDir = '/tmp/pandoc-' + Date.now();
  const mdFile = path.join(tmpDir, 'analysis.md');

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const cleanedText = preprocessMarkdownForPandoc(analysisText);

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

    fs.writeFileSync(headerFile, latexHeader, 'utf8');

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

    fs.writeFileSync(mdFile, markdownContent, 'utf8');

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

    if (fs.existsSync(outputPath)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log('[PDF] Generated successfully via pandoc/xelatex');
      return outputPath;
    } else {
      throw new Error('PDF not generated');
    }
  } catch (error) {
    console.log('[PDF] Pandoc/xelatex failed:', error.message);
    if (error.stdout) console.log('[PDF] stdout:', error.stdout.toString().slice(-2000));
    if (error.stderr) console.log('[PDF] stderr:', error.stderr.toString().slice(-2000));

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    console.log('[PDF] Falling back to publishPDF...');
    return publishPDF(title, analysisText, outputPath);
  }
}

// Professional PDF generation using pdfkit with proper table formatting
export async function generatePDFWithPDFKit(title, analysisText, outputPath) {
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

      const pageWidth = 495;
      const leftMargin = 50;

      // Title page
      doc.fontSize(24).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text(title, { align: 'center' });
      doc.moveDown(0.5);

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
        const colWidths = [];
        const padding = 8;

        for (let c = 0; c < numCols; c++) {
          let maxWidth = 0;
          for (let r = 0; r < tableRows.length; r++) {
            const cell = tableRows[r][c] || '';
            const estWidth = cell.length * 5.5 + padding * 2;
            maxWidth = Math.max(maxWidth, estWidth);
          }
          colWidths.push(Math.min(180, Math.max(40, maxWidth)));
        }

        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        const scale = Math.min(1, (pageWidth - 10) / totalWidth);
        const scaledWidths = colWidths.map(w => Math.floor(w * scale));

        const actualTotal = scaledWidths.reduce((a, b) => a + b, 0);
        const remainder = pageWidth - 10 - actualTotal;
        if (remainder > 0 && scaledWidths.length > 0) {
          const widestIdx = scaledWidths.indexOf(Math.max(...scaledWidths));
          scaledWidths[widestIdx] += remainder;
        }

        const estTableHeight = (tableRows.length + 1) * 20;
        if (doc.y + estTableHeight > 750) {
          doc.addPage();
        }

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

        doc.font('Helvetica').fontSize(8);
        for (let r = 1; r < tableRows.length; r++) {
          if (doc.y > 740) {
            doc.strokeColor(colors.border).lineWidth(0.5);
            doc.rect(leftMargin, headerY, pageWidth, doc.y - headerY).stroke();
            doc.addPage();
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

          if (isAlt) {
            doc.rect(leftMargin, rowY, pageWidth, rowHeight).fill(colors.rowAlt);
          }

          doc.fillColor(colors.text);
          xPos = leftMargin + 4;
          tableRows[r].forEach((cell, i) => {
            const isNumber = /^[\$\d\,\.\-\%]+$/.test(cell.trim());
            doc.text(cell, xPos, rowY + 5, {
              width: scaledWidths[i] - 6,
              height: rowHeight - 4,
              align: isNumber ? 'right' : 'left',
              lineBreak: false
            });
            xPos += scaledWidths[i];
          });

          doc.strokeColor(colors.border).lineWidth(0.3);
          doc.moveTo(leftMargin, rowY + rowHeight).lineTo(leftMargin + pageWidth, rowY + rowHeight).stroke();

          doc.y = rowY + rowHeight;
        }

        doc.strokeColor(colors.border).lineWidth(0.5);
        doc.rect(leftMargin, headerY, pageWidth, doc.y - headerY).stroke();

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
        if (doc.y > 750) {
          if (inTable) renderTable();
          doc.addPage();
        }

        if (line.startsWith('## ')) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          if (doc.y > 680) { doc.addPage(); }
          doc.moveDown(0.8);
          doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary);
          doc.text(line.replace(/^## /, '').replace(/\*\*/g, ''));
          doc.strokeColor(colors.secondary).lineWidth(1.5);
          doc.moveTo(leftMargin, doc.y + 2).lineTo(leftMargin + 200, doc.y + 2).stroke();
          doc.moveDown(0.4);
          doc.fontSize(10).font('Helvetica').fillColor(colors.text);
          continue;
        }

        if (line.startsWith('### ')) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          if (doc.y > 700) { doc.addPage(); }
          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.secondary);
          doc.text(line.replace(/^### /, '').replace(/\*\*/g, ''));
          doc.moveDown(0.2);
          doc.fontSize(10).font('Helvetica').fillColor(colors.text);
          continue;
        }

        if (line.startsWith('#### ')) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          if (doc.y > 720) { doc.addPage(); }
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.text);
          doc.text(line.replace(/^#### /, '').replace(/\*\*/g, ''));
          doc.moveDown(0.2);
          doc.fontSize(10).font('Helvetica').fillColor(colors.text);
          continue;
        }

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

        if (line.match(/^[\-\*]\s+/)) {
          inList = true;
          const text = line.replace(/^[\-\*]\s+/, '').replace(/\*\*/g, '');
          doc.fillColor(colors.text).text('  -  ' + text, leftMargin, doc.y);
          continue;
        }

        if (line.match(/^\d+\.\s+/)) {
          inList = true;
          const text = line.replace(/\*\*/g, '');
          doc.fillColor(colors.text).text('  ' + text);
          continue;
        }

        if (line.match(/^---+$/)) {
          if (inTable) { renderTable(); inTable = false; }
          if (inList) { inList = false; }
          doc.moveDown(0.3);
          doc.strokeColor(colors.border).lineWidth(0.5);
          doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
          doc.moveDown(0.3);
          continue;
        }

        if (!line.trim()) {
          if (inList) { inList = false; }
          doc.moveDown(0.3);
          continue;
        }

        if (inList) { inList = false; }
        let text = line;
        if (text.includes('**')) {
          const cleanText = text.replace(/\*\*/g, '');
          doc.font('Helvetica').text(cleanText);
        } else {
          doc.text(text);
        }
      }

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
export async function uploadFileToMattermost(filePath, channelId, fileName, config) {
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
