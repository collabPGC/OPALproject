/**
 * publishPDF - Professional PDF Generation Module with LaTeX-Inspired Style System
 *
 * Style structure modeled after LaTeX packages:
 *   - geometry: Page margins and dimensions
 *   - xcolor: Color definitions
 *   - fonts: Font family and size specifications
 *   - titlesec: Section heading formatting
 *   - booktabs: Professional table styling
 *   - fancyhdr: Running headers and footers
 *   - enumitem: List formatting
 *   - parskip: Paragraph spacing
 *
 * Usage:
 *   import { publishPDF, listStyles, loadStyle } from './publish-pdf.js';
 *
 *   // Use default professional style
 *   await publishPDF(title, content, outputPath);
 *
 *   // Use a specific style
 *   await publishPDF(title, content, outputPath, { style: 'executive' });
 *
 *   // List available styles
 *   const styles = await listStyles();
 *
 *   // Load and customize a style
 *   const style = await loadStyle('minimal');
 *   style.xcolor.primary = '#ff0000';
 *   await publishPDF(title, content, outputPath, { styleConfig: style });
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Optional macro engine import - gracefully handle if not available
let MacroEngine = null;
try {
  const macros = await import('./pdf-macros.js');
  MacroEngine = macros.MacroEngine;
} catch (e) {
  // Macros not available - continue without them
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = path.join(__dirname, 'pdf-styles');

// =============================================================================
// DEFAULT CONFIGURATION (LaTeX-inspired structure)
// =============================================================================

const DEFAULT_CONFIG = {
  name: 'Default',
  description: 'Built-in default style',
  version: '2.0',

  document: {
    class: 'report',
    paper: 'A4',
    orientation: 'portrait',
  },

  geometry: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
    headheight: 15,
    headsep: 20,
    footskip: 30,
  },

  xcolor: {
    primary: '#1a365d',
    secondary: '#2962a3',
    accent: '#3b82f6',
    text: '#334155',
    lightText: '#64748b',
    tableHeaderBg: '#2962a3',
    tableHeaderFg: '#ffffff',
    tableRowAlt: '#f1f5f9',
    ruleLine: '#cbd5e0',
  },

  fonts: {
    body: { family: 'Helvetica', size: 10 },
    title: { family: 'Helvetica-Bold', size: 24 },
    h1: { family: 'Helvetica-Bold', size: 18 },
    h2: { family: 'Helvetica-Bold', size: 14 },
    h3: { family: 'Helvetica-Bold', size: 11 },
    h4: { family: 'Helvetica-Bold', size: 10 },
    tableHeader: { family: 'Helvetica-Bold', size: 8 },
    tableBody: { family: 'Helvetica', size: 8 },
    header: { family: 'Helvetica-Bold', size: 8 },
    footer: { family: 'Helvetica-Oblique', size: 8 },
    pageNum: { family: 'Helvetica', size: 9 },
  },

  titlesec: {
    chapter: {
      spaceBefore: 24,
      spaceAfter: 12,
      rule: { show: true, width: 2, length: 250 },
    },
    section: {
      spaceBefore: 18,
      spaceAfter: 8,
      rule: { show: true, width: 1.5, length: 200 },
    },
    subsection: {
      spaceBefore: 12,
      spaceAfter: 6,
      rule: { show: false },
    },
    subsubsection: {
      spaceBefore: 8,
      spaceAfter: 4,
      rule: { show: false },
    },
    orphanThreshold: {
      chapter: 660,
      section: 680,
      subsection: 700,
      subsubsection: 720,
    },
  },

  booktabs: {
    toprule: { width: 1.2 },
    midrule: { width: 0.8 },
    bottomrule: { width: 1.2 },
    cmidrule: { width: 0.5, trim: 2 },
    aboverulesep: 3,
    belowrulesep: 3,
    defaultcolsep: 4,
    showVerticalRules: false,
    alternateRows: true,
    headerHeight: 24,
    rowHeight: 18,
    minColWidth: 40,
    maxColWidth: 200,
    charWidthEstimate: 5.5,
  },

  fancyhdr: {
    headrule: { show: true, width: 1 },
    footrule: { show: false, width: 0.5 },
    head: {
      left: '',
      center: 'Scout AI Analysis',
      right: '',
    },
    foot: {
      left: 'McKinsey/HBS Analytical Framework',
      center: '',
      right: 'Page {page} of {pages}',
    },
  },

  titlepage: {
    show: true,
    titleAlign: 'center',
    accentLine: { show: true, width: 3, margin: 100 },
    subtitle: { show: true, text: 'Scout AI Deep Analysis', size: 14 },
    framework: { show: true, text: 'McKinsey/HBS Analytical Framework', size: 11 },
    date: { show: true, format: 'locale' },
    divider: { show: true, width: 0.5 },
  },

  enumitem: {
    bullet: { marker: '-', indent: 10, itemsep: 2 },
    enumerate: { indent: 10, itemsep: 2 },
  },

  parskip: {
    parskip: 6,
    parindent: 0,
    baselineskip: 14,
  },

  layout: {
    pageBreakThreshold: 750,
    tableOrphanThreshold: 100,
  },

  // longtable: Multi-page table behavior
  longtable: {
    repeatHeader: true,
    repeatFooter: false,
    breakInside: true,
    minRowsBeforeBreak: 3,
    minRowsAfterBreak: 2,
  },

  // tabularx: Column width behavior
  tabularx: {
    columnType: 'proportional', // 'fixed', 'proportional', 'expanding'
    expandToFit: true,
    wrapContent: true,
    maxCellLines: 3,
    truncateOverflow: false,
    overflowIndicator: '...',
  },

  // microtype: Micro-typography (limited support in pdfkit)
  microtype: {
    protrusion: false,
    expansion: { enabled: false, stretch: 20, shrink: 20 },
    tracking: 0,
  },

  // penalties: Widow/orphan control
  penalties: {
    widow: 150,
    orphan: 150,
    brokenHyphen: 100,
  },
};

// =============================================================================
// STYLE MANAGEMENT
// =============================================================================

/**
 * List all available style files
 * @returns {Promise<Array<{name: string, file: string, description: string}>>}
 */
export async function listStyles() {
  const styles = [
    { name: 'default', file: null, description: 'Built-in default style' }
  ];

  try {
    if (fs.existsSync(STYLES_DIR)) {
      const files = fs.readdirSync(STYLES_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const stylePath = path.join(STYLES_DIR, file);
            const styleData = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
            styles.push({
              name: file.replace('.json', ''),
              file: stylePath,
              description: styleData.description || styleData.name || file,
            });
          } catch (e) {
            // Skip invalid style files
          }
        }
      }
    }
  } catch (e) {
    console.error('[publishPDF] Error listing styles:', e.message);
  }

  return styles;
}

/**
 * Load a style by name
 * @param {string} styleName - Name of the style (without .json extension)
 * @returns {Promise<object>} - The style configuration
 */
export async function loadStyle(styleName) {
  if (!styleName || styleName === 'default') {
    return deepClone(DEFAULT_CONFIG);
  }

  const stylePath = path.join(STYLES_DIR, `${styleName}.json`);

  try {
    if (fs.existsSync(stylePath)) {
      const styleData = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
      // Merge with defaults to ensure all properties exist
      return deepMerge(DEFAULT_CONFIG, styleData);
    }
  } catch (e) {
    console.error(`[publishPDF] Error loading style '${styleName}':`, e.message);
  }

  console.warn(`[publishPDF] Style '${styleName}' not found, using default`);
  return deepClone(DEFAULT_CONFIG);
}

/**
 * Save a style to a file
 * @param {string} styleName - Name for the style file
 * @param {object} styleConfig - Style configuration object
 */
export async function saveStyle(styleName, styleConfig) {
  if (!fs.existsSync(STYLES_DIR)) {
    fs.mkdirSync(STYLES_DIR, { recursive: true });
  }

  const stylePath = path.join(STYLES_DIR, `${styleName}.json`);
  fs.writeFileSync(stylePath, JSON.stringify(styleConfig, null, 2), 'utf8');
  console.log(`[publishPDF] Style saved to ${stylePath}`);
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// =============================================================================
// TEXT PREPROCESSING
// =============================================================================

function preprocessText(text) {
  return text
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
    .replace(/[^\x00-\x7F\u00C0-\u017F]/g, '');
}

function stripBold(text) {
  return text.replace(/\*\*/g, '');
}

// =============================================================================
// TABLE RENDERING (booktabs-inspired)
// =============================================================================

function calculateColumnWidths(rows, pageWidth, booktabs, tabularx = {}) {
  if (rows.length === 0) return [];

  const numCols = rows[0].length;
  const { defaultcolsep, minColWidth, maxColWidth, charWidthEstimate } = booktabs;
  const { columnType = 'proportional', expandToFit = true } = tabularx;

  const colWidths = [];
  for (let c = 0; c < numCols; c++) {
    let maxWidth = 0;
    for (const row of rows) {
      const cell = row[c] || '';
      const estWidth = cell.length * charWidthEstimate + defaultcolsep * 2;
      maxWidth = Math.max(maxWidth, estWidth);
    }
    colWidths.push(Math.min(maxColWidth, Math.max(minColWidth, maxWidth)));
  }

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const availableWidth = pageWidth - 10;

  let scaledWidths;

  if (columnType === 'fixed') {
    // Fixed: Keep calculated widths, don't expand
    scaledWidths = colWidths.map(w => Math.min(w, availableWidth / numCols));
  } else if (columnType === 'expanding') {
    // Expanding (X-type in tabularx): Distribute available width equally
    const equalWidth = Math.floor(availableWidth / numCols);
    scaledWidths = colWidths.map(() => equalWidth);
  } else {
    // Proportional (default): Scale proportionally to content
    const scale = Math.min(1, availableWidth / totalWidth);
    scaledWidths = colWidths.map(w => Math.floor(w * scale));
  }

  // expandToFit: Distribute remaining space
  if (expandToFit) {
    const actualTotal = scaledWidths.reduce((a, b) => a + b, 0);
    const remainder = availableWidth - actualTotal;
    if (remainder > 0 && scaledWidths.length > 0) {
      if (columnType === 'expanding') {
        // Distribute remainder equally among all columns
        const perCol = Math.floor(remainder / scaledWidths.length);
        scaledWidths = scaledWidths.map(w => w + perCol);
        // Add leftover to first column
        scaledWidths[0] += remainder - (perCol * scaledWidths.length);
      } else {
        // Add remainder to widest column
        const widestIdx = scaledWidths.indexOf(Math.max(...scaledWidths));
        scaledWidths[widestIdx] += remainder;
      }
    }
  }

  return scaledWidths;
}

function isNumeric(value) {
  return /^[\$\d\,\.\-\%\+]+$/.test(value.trim());
}

function renderTable(doc, rows, leftMargin, pageWidth, config) {
  if (rows.length === 0) return;

  const { xcolor, fonts, booktabs, layout, longtable, tabularx } = config;
  const colWidths = calculateColumnWidths(rows, pageWidth, booktabs, tabularx);
  const { headerHeight, rowHeight, defaultcolsep, showVerticalRules, alternateRows } = booktabs;
  const { toprule, midrule, bottomrule } = booktabs;

  // longtable: Check if we have enough space for minimum rows before break
  const minSpaceNeeded = (longtable?.minRowsBeforeBreak || 3) * rowHeight + headerHeight;
  const remainingSpace = layout.pageBreakThreshold - doc.y;

  // If table won't fit at all, or we don't have enough for min rows, start new page
  const estHeight = (rows.length + 1) * rowHeight;
  if (remainingSpace < minSpaceNeeded) {
    doc.addPage();
  }

  const tableStartY = doc.y;

  // Top rule (booktabs style)
  doc.strokeColor(xcolor.ruleLine).lineWidth(toprule.width);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.y += booktabs.aboverulesep;

  // Header Row
  const headerY = doc.y;
  doc.rect(leftMargin, headerY, pageWidth, headerHeight).fill(xcolor.tableHeaderBg);
  doc.fillColor(xcolor.tableHeaderFg)
     .font(fonts.tableHeader.family)
     .fontSize(fonts.tableHeader.size);

  let xPos = leftMargin + defaultcolsep;
  rows[0].forEach((cell, i) => {
    doc.text(cell, xPos, headerY + 7, {
      width: colWidths[i] - defaultcolsep * 2,
      height: headerHeight - 4,
      lineBreak: false,
    });
    xPos += colWidths[i];
  });
  doc.y = headerY + headerHeight + booktabs.belowrulesep;

  // Mid rule after header (booktabs style)
  doc.strokeColor(xcolor.ruleLine).lineWidth(midrule.width);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.y += booktabs.aboverulesep;

  // Data Rows
  doc.font(fonts.tableBody.family).fontSize(fonts.tableBody.size);

  for (let r = 1; r < rows.length; r++) {
    const rowsRemaining = rows.length - r;
    const minAfterBreak = longtable?.minRowsAfterBreak || 2;

    // longtable: Don't break if we'd leave fewer than minRowsAfterBreak on new page
    // Also respect longtable.breakInside setting
    const shouldBreak = longtable?.breakInside !== false &&
                        doc.y > layout.pageBreakThreshold - rowHeight &&
                        rowsRemaining >= minAfterBreak;

    if (shouldBreak) {
      // Bottom rule before page break
      doc.strokeColor(xcolor.ruleLine).lineWidth(bottomrule.width);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();

      doc.addPage();

      // Top rule on new page
      doc.strokeColor(xcolor.ruleLine).lineWidth(toprule.width);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
      doc.y += booktabs.aboverulesep;

      // Redraw header
      const newHeaderY = doc.y;
      doc.rect(leftMargin, newHeaderY, pageWidth, headerHeight).fill(xcolor.tableHeaderBg);
      doc.fillColor(xcolor.tableHeaderFg)
         .font(fonts.tableHeader.family)
         .fontSize(fonts.tableHeader.size);

      xPos = leftMargin + defaultcolsep;
      rows[0].forEach((cell, i) => {
        doc.text(cell, xPos, newHeaderY + 7, {
          width: colWidths[i] - defaultcolsep * 2,
          height: headerHeight - 4,
          lineBreak: false,
        });
        xPos += colWidths[i];
      });
      doc.y = newHeaderY + headerHeight + booktabs.belowrulesep;

      // Mid rule after header
      doc.strokeColor(xcolor.ruleLine).lineWidth(midrule.width);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
      doc.y += booktabs.aboverulesep;

      doc.font(fonts.tableBody.family).fontSize(fonts.tableBody.size);
    }

    const rowY = doc.y;
    const isAlt = r % 2 === 0;

    if (alternateRows && isAlt) {
      doc.rect(leftMargin, rowY, pageWidth, rowHeight).fill(xcolor.tableRowAlt);
    }

    doc.fillColor(xcolor.text);
    xPos = leftMargin + defaultcolsep;
    rows[r].forEach((cell, i) => {
      const align = isNumeric(cell) ? 'right' : 'left';
      doc.text(cell, xPos, rowY + 5, {
        width: colWidths[i] - defaultcolsep * 2,
        height: rowHeight - 4,
        align,
        lineBreak: false,
      });
      xPos += colWidths[i];
    });

    doc.y = rowY + rowHeight;
  }

  // Bottom rule (booktabs style)
  doc.y += booktabs.belowrulesep;
  doc.strokeColor(xcolor.ruleLine).lineWidth(bottomrule.width);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();

  // Vertical rules (if enabled - note: booktabs discourages these)
  if (showVerticalRules) {
    xPos = leftMargin;
    doc.strokeColor(xcolor.ruleLine).lineWidth(0.3);
    doc.moveTo(xPos, tableStartY).lineTo(xPos, doc.y).stroke();
    for (let i = 0; i < colWidths.length; i++) {
      xPos += colWidths[i];
      doc.moveTo(xPos, tableStartY).lineTo(xPos, doc.y).stroke();
    }
  }

  doc.moveDown(0.5);
}

// =============================================================================
// DOCUMENT HELPERS
// =============================================================================

function resetToBodyText(doc, leftMargin, config) {
  doc.x = leftMargin;
  doc.font(config.fonts.body.family)
     .fontSize(config.fonts.body.size)
     .fillColor(config.xcolor.text);
}

function formatPageText(text, page, pages) {
  return text
    .replace('{page}', String(page))
    .replace('{pages}', String(pages));
}

function addPageFurniture(doc, leftMargin, pageWidth, config) {
  const pages = doc.bufferedPageRange();
  const { fancyhdr, xcolor, fonts, geometry } = config;

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const pageNum = i + 1;
    const totalPages = pages.count;

    // Header
    const headY = geometry.top - geometry.headsep - geometry.headheight;

    if (fancyhdr.head.left) {
      doc.font(fonts.header.family).fontSize(fonts.header.size).fillColor(xcolor.primary);
      doc.text(fancyhdr.head.left, leftMargin, headY, { align: 'left', width: pageWidth });
    }
    if (fancyhdr.head.center) {
      doc.font(fonts.header.family).fontSize(fonts.header.size).fillColor(xcolor.primary);
      doc.text(fancyhdr.head.center, leftMargin, headY, { align: 'center', width: pageWidth });
    }
    if (fancyhdr.head.right) {
      doc.font(fonts.header.family).fontSize(fonts.header.size).fillColor(xcolor.primary);
      doc.text(fancyhdr.head.right, leftMargin, headY, { align: 'right', width: pageWidth });
    }

    if (fancyhdr.headrule.show) {
      doc.strokeColor(xcolor.secondary).lineWidth(fancyhdr.headrule.width);
      doc.moveTo(leftMargin, geometry.top - geometry.headsep + 5)
         .lineTo(leftMargin + pageWidth, geometry.top - geometry.headsep + 5)
         .stroke();
    }

    // Footer
    const footY = 780;

    if (fancyhdr.foot.left) {
      doc.font(fonts.footer.family).fontSize(fonts.footer.size).fillColor(xcolor.lightText);
      doc.text(formatPageText(fancyhdr.foot.left, pageNum, totalPages), leftMargin, footY, { align: 'left', width: pageWidth });
    }
    if (fancyhdr.foot.center) {
      doc.font(fonts.footer.family).fontSize(fonts.footer.size).fillColor(xcolor.lightText);
      doc.text(formatPageText(fancyhdr.foot.center, pageNum, totalPages), leftMargin, footY, { align: 'center', width: pageWidth });
    }
    if (fancyhdr.foot.right) {
      doc.font(fonts.pageNum.family).fontSize(fonts.pageNum.size).fillColor(xcolor.lightText);
      doc.text(formatPageText(fancyhdr.foot.right, pageNum, totalPages), leftMargin, footY, { align: 'right', width: pageWidth });
    }

    if (fancyhdr.footrule.show) {
      doc.strokeColor(xcolor.ruleLine).lineWidth(fancyhdr.footrule.width);
      doc.moveTo(leftMargin, footY - 5).lineTo(leftMargin + pageWidth, footY - 5).stroke();
    }
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Generate a professionally formatted PDF from markdown content
 *
 * @param {string} title - Document title
 * @param {string} content - Markdown content
 * @param {string} outputPath - Output file path
 * @param {object} options - Options
 * @param {string} options.style - Style name to use (e.g., 'professional', 'minimal', 'executive')
 * @param {object} options.styleConfig - Direct style configuration (overrides style file)
 * @returns {Promise<string>} - Resolves with output path on success
 */
export async function publishPDF(title, content, outputPath, options = {}) {
  // Load style
  let config;
  if (options.styleConfig) {
    config = deepMerge(DEFAULT_CONFIG, options.styleConfig);
  } else {
    config = await loadStyle(options.style || 'professional');
  }

  const { geometry, xcolor, fonts, titlesec, titlepage, enumitem, parskip, layout } = config;
  const leftMargin = geometry.left;
  const pageWidth = 595 - geometry.left - geometry.right; // A4 width in points

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: config.document.paper || 'A4',
        margins: {
          top: geometry.top,
          bottom: geometry.bottom,
          left: geometry.left,
          right: geometry.right,
        },
        info: { Title: title, Author: fancyhdrText(config) },
        bufferPages: true,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- Title Page ---
      if (titlepage.show) {
        doc.fontSize(fonts.title.size)
           .font(fonts.title.family)
           .fillColor(xcolor.primary)
           .text(title, { align: titlepage.titleAlign });
        doc.moveDown(0.5);

        if (titlepage.accentLine.show) {
          doc.strokeColor(xcolor.secondary).lineWidth(titlepage.accentLine.width);
          doc.moveTo(leftMargin + titlepage.accentLine.margin, doc.y)
             .lineTo(leftMargin + pageWidth - titlepage.accentLine.margin, doc.y)
             .stroke();
          doc.moveDown(0.8);
        }

        if (titlepage.subtitle.show) {
          doc.fontSize(titlepage.subtitle.size).font('Helvetica').fillColor(xcolor.secondary);
          doc.text(titlepage.subtitle.text, { align: 'center' });
          doc.moveDown(0.3);
        }

        if (titlepage.framework.show) {
          doc.fontSize(titlepage.framework.size).fillColor(xcolor.lightText);
          doc.text(titlepage.framework.text, { align: 'center' });
          doc.moveDown(0.3);
        }

        if (titlepage.date.show) {
          doc.fontSize(10).fillColor(xcolor.lightText);
          doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
          doc.moveDown(1.5);
        }

        if (titlepage.divider.show) {
          doc.strokeColor(xcolor.ruleLine).lineWidth(titlepage.divider.width);
          doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
          doc.moveDown(1);
        }
      }

      // --- Process Content ---
      resetToBodyText(doc, leftMargin, config);

      // Apply macro fixes if engine is available
      let contentToProcess = content;
      if (MacroEngine) {
        const engine = new MacroEngine({
          autoFixCategories: ['encoding', 'content']
        });
        const { content: fixedContent, applied } = engine.applyMacros(content);
        if (applied.length > 0) {
          console.log(`[publishPDF] Applied macros: ${applied.join(', ')}`);
        }
        contentToProcess = fixedContent;
      }

      const processedContent = preprocessText(contentToProcess);
      const lines = processedContent.split('\n');

      let inTable = false;
      let tableRows = [];

      for (const line of lines) {
        if (doc.y > layout.pageBreakThreshold) {
          if (inTable) {
            renderTable(doc, tableRows, leftMargin, pageWidth, config);
            tableRows = [];
            inTable = false;
            resetToBodyText(doc, leftMargin, config);
          }
          doc.addPage();
        }

        // H1 (chapter level)
        if (line.startsWith('# ') && !line.startsWith('## ')) {
          if (inTable) {
            renderTable(doc, tableRows, leftMargin, pageWidth, config);
            tableRows = [];
            inTable = false;
            resetToBodyText(doc, leftMargin, config);
          }
          if (doc.y > titlesec.orphanThreshold.chapter) doc.addPage();

          doc.y += titlesec.chapter.spaceBefore;
          doc.fontSize(fonts.h1.size).font(fonts.h1.family).fillColor(xcolor.primary)
             .text(stripBold(line.replace(/^# /, '')));

          if (titlesec.chapter.rule.show) {
            doc.strokeColor(xcolor.secondary).lineWidth(titlesec.chapter.rule.width);
            doc.moveTo(leftMargin, doc.y + 3)
               .lineTo(leftMargin + titlesec.chapter.rule.length, doc.y + 3)
               .stroke();
          }
          doc.y += titlesec.chapter.spaceAfter;
          resetToBodyText(doc, leftMargin, config);
          continue;
        }

        // H2 (section level)
        if (line.startsWith('## ')) {
          if (inTable) {
            renderTable(doc, tableRows, leftMargin, pageWidth, config);
            tableRows = [];
            inTable = false;
            resetToBodyText(doc, leftMargin, config);
          }
          if (doc.y > titlesec.orphanThreshold.section) doc.addPage();

          doc.y += titlesec.section.spaceBefore;
          doc.fontSize(fonts.h2.size).font(fonts.h2.family).fillColor(xcolor.primary)
             .text(stripBold(line.replace(/^## /, '')));

          if (titlesec.section.rule.show) {
            doc.strokeColor(xcolor.secondary).lineWidth(titlesec.section.rule.width);
            doc.moveTo(leftMargin, doc.y + 2)
               .lineTo(leftMargin + titlesec.section.rule.length, doc.y + 2)
               .stroke();
          }
          doc.y += titlesec.section.spaceAfter;
          resetToBodyText(doc, leftMargin, config);
          continue;
        }

        // H3 (subsection level)
        if (line.startsWith('### ')) {
          if (inTable) {
            renderTable(doc, tableRows, leftMargin, pageWidth, config);
            tableRows = [];
            inTable = false;
            resetToBodyText(doc, leftMargin, config);
          }
          if (doc.y > titlesec.orphanThreshold.subsection) doc.addPage();

          doc.y += titlesec.subsection.spaceBefore;
          doc.fontSize(fonts.h3.size).font(fonts.h3.family).fillColor(xcolor.secondary)
             .text(stripBold(line.replace(/^### /, '')));

          if (titlesec.subsection.rule && titlesec.subsection.rule.show) {
            doc.strokeColor(xcolor.accent).lineWidth(titlesec.subsection.rule.width);
            doc.moveTo(leftMargin, doc.y + 2)
               .lineTo(leftMargin + titlesec.subsection.rule.length, doc.y + 2)
               .stroke();
          }
          doc.y += titlesec.subsection.spaceAfter;
          resetToBodyText(doc, leftMargin, config);
          continue;
        }

        // H4 (subsubsection level)
        if (line.startsWith('#### ')) {
          if (inTable) {
            renderTable(doc, tableRows, leftMargin, pageWidth, config);
            tableRows = [];
            inTable = false;
            resetToBodyText(doc, leftMargin, config);
          }
          if (doc.y > titlesec.orphanThreshold.subsubsection) doc.addPage();

          doc.y += titlesec.subsubsection.spaceBefore;
          doc.fontSize(fonts.h4.size).font(fonts.h4.family).fillColor(xcolor.text)
             .text(stripBold(line.replace(/^#### /, '')));
          doc.y += titlesec.subsubsection.spaceAfter;
          resetToBodyText(doc, leftMargin, config);
          continue;
        }

        // Table
        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.includes('---')) continue;
          inTable = true;
          const cells = line.split('|').filter(c => c.trim()).map(c => stripBold(c.trim()));
          tableRows.push(cells);
          continue;
        } else if (inTable) {
          renderTable(doc, tableRows, leftMargin, pageWidth, config);
          tableRows = [];
          inTable = false;
          resetToBodyText(doc, leftMargin, config);
        }

        // Bullet (enumitem style)
        if (line.match(/^[\-\*]\s+/)) {
          const text = stripBold(line.replace(/^[\-\*]\s+/, ''));
          const indent = ' '.repeat(enumitem.bullet.indent / 2);
          doc.text(indent + enumitem.bullet.marker + '  ' + text, leftMargin, doc.y);
          continue;
        }

        // Numbered list
        if (line.match(/^\d+\.\s+/)) {
          const indent = ' '.repeat(enumitem.enumerate.indent / 2);
          doc.text(indent + stripBold(line));
          continue;
        }

        // Horizontal rule
        if (line.match(/^---+$/)) {
          if (inTable) {
            renderTable(doc, tableRows, leftMargin, pageWidth, config);
            tableRows = [];
            inTable = false;
            resetToBodyText(doc, leftMargin, config);
          }
          doc.moveDown(0.3);
          doc.strokeColor(xcolor.ruleLine).lineWidth(0.5);
          doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
          doc.moveDown(0.3);
          continue;
        }

        // Empty line (parskip)
        if (!line.trim()) {
          doc.y += parskip.parskip;
          continue;
        }

        // Regular text
        doc.text(stripBold(line));
      }

      if (inTable) {
        renderTable(doc, tableRows, leftMargin, pageWidth, config);
        resetToBodyText(doc, leftMargin, config);
      }

      // --- Document Footer ---
      doc.moveDown(2);
      doc.strokeColor(xcolor.ruleLine).lineWidth(0.5);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(fonts.footer.size)
         .font(fonts.footer.family)
         .fillColor(xcolor.lightText)
         .text('Confidential - For Internal Use Only', { align: 'center' });

      // --- Page Furniture (headers/footers) ---
      addPageFurniture(doc, leftMargin, pageWidth, config);

      doc.end();

      stream.on('finish', () => {
        console.log(`[publishPDF] Generated with style '${config.name}': ${outputPath}`);
        resolve(outputPath);
      });
      stream.on('error', reject);

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper to extract header text for PDF metadata
 */
function fancyhdrText(config) {
  const { fancyhdr } = config;
  return fancyhdr.head.center || fancyhdr.head.left || fancyhdr.head.right || 'Scout AI Analysis';
}

// Export utilities
export { DEFAULT_CONFIG as defaultConfig, STYLES_DIR as stylesDirectory };
export default { publishPDF, listStyles, loadStyle, saveStyle, defaultConfig: DEFAULT_CONFIG };
