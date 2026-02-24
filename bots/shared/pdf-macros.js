/**
 * PDF Macro Rules System
 *
 * These are LOGIC-BASED checks for issues that CANNOT be solved by style rules.
 * Style rules already handle: margins, fonts, colors, orphan/widow thresholds,
 * table spacing, page breaks, etc.
 *
 * Macros handle issues requiring content analysis or rule conflict resolution:
 *
 * 1. Character encoding failures (bullets, arrows, quotes -> font can't render)
 * 2. Malformed markdown (unclosed bold, inconsistent tables)
 * 3. Content quality issues (empty cells, missing separators)
 * 4. Column balance problems (one column 10x wider than another)
 * 5. Content density issues (all tables, no narrative)
 * 6. Markup conflicts (nested bold/italic)
 *
 * NOT handled here (use style rules instead):
 * - Orphan/widow control (use titlesec.orphanThreshold, penalties)
 * - Table styling (use booktabs settings)
 * - Page breaks (use layout.pageBreakThreshold)
 * - Font sizes (use fonts settings)
 *
 * Usage:
 *   import { MacroEngine, preflightCheck, applyMacros } from './pdf-macros.js';
 *
 *   const engine = new MacroEngine(config);
 *   const issues = engine.preflightCheck(content);
 *   const fixedContent = engine.applyMacros(content);
 */

// =============================================================================
// MACRO RULE DEFINITIONS
// =============================================================================

/**
 * Each macro rule has:
 * - id: Unique identifier
 * - name: Human-readable name
 * - category: Classification (content, layout, encoding, state, overflow)
 * - severity: 'error', 'warning', 'info'
 * - detect: Function to detect the issue
 * - fix: Function to fix the issue (if auto-fixable)
 * - description: What this macro checks for
 */

const MACRO_RULES = [

  // ============ ENCODING MACROS ============

  {
    id: 'encoding-bullets',
    name: 'Bullet Character Encoding',
    category: 'encoding',
    severity: 'error',
    description: 'Detects bullet characters that fail to render in standard fonts (●, •, ◦, ‣)',
    detect: (content) => {
      const problematicBullets = /[●•◦‣⁃∙⦾⦿]/g;
      const matches = content.match(problematicBullets);
      return matches ? { found: matches, count: matches.length } : null;
    },
    fix: (content) => {
      return content
        .replace(/[●•◦‣⁃∙⦾⦿]/g, '-');
    }
  },

  {
    id: 'encoding-arrows',
    name: 'Arrow Character Encoding',
    category: 'encoding',
    severity: 'warning',
    description: 'Detects Unicode arrows that may not render correctly',
    detect: (content) => {
      const arrows = /[\u2190-\u21FF\u27A1\u2794\u279C\u2B05]/g;
      const matches = content.match(arrows);
      return matches ? { found: [...new Set(matches)], count: matches.length } : null;
    },
    fix: (content) => {
      return content
        .replace(/[\u2192\u2794\u27A1\u279C]/g, '->')
        .replace(/[\u2190\u2B05]/g, '<-')
        .replace(/[\u2194]/g, '<->');
    }
  },

  {
    id: 'encoding-quotes',
    name: 'Smart Quote Encoding',
    category: 'encoding',
    severity: 'info',
    description: 'Detects smart quotes that may cause rendering issues',
    detect: (content) => {
      const smartQuotes = /[\u2018\u2019\u201C\u201D\u00AB\u00BB\u0060\u00B4]/g;
      const matches = content.match(smartQuotes);
      return matches ? { found: [...new Set(matches)], count: matches.length } : null;
    },
    fix: (content) => {
      return content
        .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
        .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"');
    }
  },

  {
    id: 'encoding-dashes',
    name: 'Em/En Dash Encoding',
    category: 'encoding',
    severity: 'info',
    description: 'Detects em-dashes and en-dashes',
    detect: (content) => {
      const dashes = /[\u2013\u2014\u2015]/g;
      const matches = content.match(dashes);
      return matches ? { found: [...new Set(matches)], count: matches.length } : null;
    },
    fix: (content) => {
      return content.replace(/[\u2013\u2014\u2015]/g, '-');
    }
  },

  {
    id: 'encoding-emoji',
    name: 'Emoji Detection',
    category: 'encoding',
    severity: 'error',
    description: 'Detects emojis which cannot render in standard PDF fonts',
    detect: (content) => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
      const matches = content.match(emojiRegex);
      return matches ? { found: [...new Set(matches)], count: matches.length } : null;
    },
    fix: (content) => {
      return content
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '');
    }
  },

  {
    id: 'encoding-invisible',
    name: 'Invisible Characters',
    category: 'encoding',
    severity: 'warning',
    description: 'Detects zero-width and invisible characters that cause layout issues',
    detect: (content) => {
      const invisible = /[\u200B-\u200D\uFEFF\u00A0]/g;
      const matches = content.match(invisible);
      return matches ? { count: matches.length } : null;
    },
    fix: (content) => {
      return content
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\u00A0]/g, ' ');
    }
  },

  // ============ CONTENT STRUCTURE MACROS ============

  {
    id: 'content-ascii-table',
    name: 'ASCII Art Table Detection',
    category: 'content',
    severity: 'error',
    description: 'Detects ASCII-art tables (+---+, |   |) that should be converted to markdown',
    detect: (content) => {
      // Detect ASCII box-drawing tables
      const asciiTablePatterns = [
        /^\+[-+]+\+$/m,                    // +---+---+
        /^\|[\s\w\d]+\|[\s\w\d]+\|$/m,     // | cell | cell |
        /^[-]{3,}$/m,                       // --- (solo separator)
      ];

      const lines = content.split('\n');
      const asciiLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Box-drawing style
        if (/^\+[-+]+\+$/.test(line)) {
          asciiLines.push({ line: i + 1, type: 'box-drawing', text: line });
        }
        // Pipe-separated without proper markdown format
        else if (/^\|[^|]+\|[^|]+\|$/.test(line) &&
                 !line.includes('---') &&
                 lines[i + 1] && /^\+[-+]+\+$/.test(lines[i + 1])) {
          asciiLines.push({ line: i + 1, type: 'ascii-pipe', text: line });
        }
      }

      return asciiLines.length > 0 ? { asciiLines } : null;
    },
    fix: (content) => {
      // Convert ASCII box tables to markdown
      let result = content;

      // Replace +---+---+ with |---|---|
      result = result.replace(/^\+(-+)\+(-+)\+$/gm, (match, c1, c2) => {
        return '|' + '-'.repeat(c1.length) + '|' + '-'.repeat(c2.length) + '|';
      });

      // Handle multi-column box drawing
      result = result.replace(/^\+([-+]+)\+$/gm, (match, inner) => {
        const parts = inner.split('+');
        return '|' + parts.map(p => '-'.repeat(p.length)).join('|') + '|';
      });

      return result;
    }
  },

  {
    id: 'content-cursor-reset',
    name: 'Cursor Position Risk',
    category: 'content',
    severity: 'warning',
    description: 'Detects content patterns that historically caused cursor position bugs (text beside tables)',
    detect: (content) => {
      const lines = content.split('\n');
      const risks = [];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        // Table row followed immediately by non-empty, non-table, non-header content
        if (line.startsWith('|') && line.endsWith('|') && !line.includes('---')) {
          if (nextLine &&
              !nextLine.startsWith('|') &&
              !nextLine.match(/^#{1,4}\s+/) &&
              !nextLine.match(/^[\-\*]\s+/) &&
              !nextLine.match(/^\d+\.\s+/) &&
              nextLine.trim().length > 0 &&
              !nextLine.match(/^---+$/)) {
            risks.push({
              line: i + 2,
              text: nextLine.substring(0, 40),
              reason: 'Text immediately after table - verify cursor reset'
            });
          }
        }
      }

      return risks.length > 0 ? { risks: risks.slice(0, 5) } : null;
    },
    fix: null // Handled in render code, this is just a warning
  },

  {
    id: 'content-font-state',
    name: 'Font State Change Points',
    category: 'content',
    severity: 'info',
    description: 'Identifies points where font state changes (headers, tables) that historically caused font corruption',
    detect: (content) => {
      const lines = content.split('\n');
      let changes = 0;
      let prevType = 'body';

      for (const line of lines) {
        let currType = 'body';
        if (line.match(/^#{1,4}\s+/)) currType = 'header';
        else if (line.startsWith('|')) currType = 'table';
        else if (line.match(/^[\-\*]\s+/)) currType = 'list';

        if (currType !== prevType && prevType !== 'body') {
          changes++;
        }
        prevType = currType;
      }

      // High number of transitions = more risk of font state issues
      return changes > 20 ? { transitions: changes, risk: 'high' } : null;
    },
    fix: null // Informational only
  },

  {
    id: 'content-empty-table-cells',
    name: 'Empty Table Cells',
    category: 'content',
    severity: 'info',
    description: 'Detects tables with many empty cells which may indicate formatting issues',
    detect: (content) => {
      const tableLines = content.split('\n').filter(l => l.startsWith('|') && l.endsWith('|'));
      let emptyCells = 0;
      let totalCells = 0;

      for (const line of tableLines) {
        if (line.includes('---')) continue;
        const cells = line.split('|').filter(c => c.trim() !== '');
        totalCells += cells.length;
        emptyCells += cells.filter(c => c.trim() === '').length;
      }

      const emptyRatio = totalCells > 0 ? emptyCells / totalCells : 0;
      return emptyRatio > 0.3 ? { emptyCells, totalCells, ratio: emptyRatio.toFixed(2) } : null;
    },
    fix: null
  },

  {
    id: 'content-long-table-rows',
    name: 'Excessively Long Table Rows',
    category: 'overflow',
    severity: 'warning',
    description: 'Detects table rows with content likely to overflow column width',
    detect: (content) => {
      const tableLines = content.split('\n').filter(l => l.startsWith('|') && l.endsWith('|'));
      const longCells = [];

      for (let i = 0; i < tableLines.length; i++) {
        const line = tableLines[i];
        if (line.includes('---')) continue;

        const cells = line.split('|').filter(c => c !== '');
        for (let j = 0; j < cells.length; j++) {
          if (cells[j].trim().length > 60) {
            longCells.push({ row: i + 1, col: j + 1, length: cells[j].trim().length });
          }
        }
      }

      return longCells.length > 0 ? { longCells } : null;
    },
    fix: null // Needs manual review or wrapping logic
  },

  {
    id: 'content-unbalanced-columns',
    name: 'Unbalanced Table Columns',
    category: 'layout',
    severity: 'info',
    description: 'Detects tables where column content lengths vary dramatically',
    detect: (content) => {
      const tableLines = content.split('\n').filter(l =>
        l.startsWith('|') && l.endsWith('|') && !l.includes('---')
      );

      if (tableLines.length < 2) return null;

      const colMaxLengths = [];
      for (const line of tableLines) {
        const cells = line.split('|').filter(c => c !== '');
        cells.forEach((cell, i) => {
          colMaxLengths[i] = Math.max(colMaxLengths[i] || 0, cell.trim().length);
        });
      }

      if (colMaxLengths.length < 2) return null;

      const max = Math.max(...colMaxLengths);
      const min = Math.min(...colMaxLengths);
      const ratio = max / (min || 1);

      return ratio > 5 ? { colMaxLengths, ratio: ratio.toFixed(1) } : null;
    },
    fix: null
  },

  // ============ MARKUP MACROS ============

  {
    id: 'markup-unclosed-bold',
    name: 'Unclosed Bold Markers',
    category: 'content',
    severity: 'error',
    description: 'Detects lines with odd number of ** markers (unclosed bold)',
    detect: (content) => {
      const lines = content.split('\n');
      const problems = [];

      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].match(/\*\*/g);
        if (matches && matches.length % 2 !== 0) {
          problems.push({ line: i + 1, text: lines[i].substring(0, 50) });
        }
      }

      return problems.length > 0 ? { problems } : null;
    },
    fix: (content) => {
      // Simple fix: remove all ** markers since we strip them anyway
      return content.replace(/\*\*/g, '');
    }
  },

  {
    id: 'markup-nested-formatting',
    name: 'Nested Formatting',
    category: 'content',
    severity: 'warning',
    description: 'Detects nested bold/italic which can cause rendering issues',
    detect: (content) => {
      const nested = /\*\*\*[^*]+\*\*\*|\*\*_[^_]+_\*\*|_\*\*[^*]+\*\*_/g;
      const matches = content.match(nested);
      return matches ? { found: matches.slice(0, 5), count: matches.length } : null;
    },
    fix: (content) => {
      // Simplify to just the content
      return content
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
        .replace(/\*\*_([^_]+)_\*\*/g, '$1')
        .replace(/_\*\*([^*]+)\*\*_/g, '$1');
    }
  },

  // ============ TABLE STRUCTURE MACROS ============

  {
    id: 'table-inconsistent-columns',
    name: 'Inconsistent Table Column Count',
    category: 'content',
    severity: 'error',
    description: 'Detects tables where rows have different numbers of columns',
    detect: (content) => {
      const lines = content.split('\n');
      let inTable = false;
      let expectedCols = 0;
      const problems = [];
      let tableStart = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.includes('---')) continue;

          const cols = line.split('|').filter(c => c !== '').length;

          if (!inTable) {
            inTable = true;
            expectedCols = cols;
            tableStart = i + 1;
          } else if (cols !== expectedCols) {
            problems.push({
              line: i + 1,
              expected: expectedCols,
              found: cols,
              tableStart
            });
          }
        } else if (inTable) {
          inTable = false;
          expectedCols = 0;
        }
      }

      return problems.length > 0 ? { problems } : null;
    },
    fix: null // Needs manual review
  },

  {
    id: 'table-missing-separator',
    name: 'Missing Table Header Separator',
    category: 'content',
    severity: 'warning',
    description: 'Detects tables without the |---|---| separator line',
    detect: (content) => {
      const lines = content.split('\n');
      const problems = [];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        if (line.startsWith('|') && line.endsWith('|') &&
            nextLine.startsWith('|') && nextLine.endsWith('|') &&
            !nextLine.includes('---') && !line.includes('---')) {
          // Check if there's no separator in the next few lines
          let hasSep = false;
          for (let j = i; j < Math.min(i + 3, lines.length); j++) {
            if (lines[j].includes('---')) hasSep = true;
          }
          if (!hasSep && i === 0) {
            problems.push({ line: i + 1 });
          }
        }
      }

      return problems.length > 0 ? { problems } : null;
    },
    fix: null
  },

  // ============ NUMERIC CONTENT MACROS ============

  {
    id: 'numeric-inconsistent-format',
    name: 'Inconsistent Number Formatting',
    category: 'content',
    severity: 'info',
    description: 'Detects inconsistent number formats (some with commas, some without)',
    detect: (content) => {
      const withCommas = content.match(/\b\d{1,3}(,\d{3})+\b/g) || [];
      const withoutCommas = content.match(/\b\d{4,}\b/g) || [];

      if (withCommas.length > 0 && withoutCommas.length > 0) {
        return {
          withCommas: withCommas.slice(0, 3),
          withoutCommas: withoutCommas.slice(0, 3)
        };
      }
      return null;
    },
    fix: null // Formatting preference - needs manual review
  },

  {
    id: 'numeric-currency-inconsistent',
    name: 'Inconsistent Currency Format',
    category: 'content',
    severity: 'info',
    description: 'Detects mixed currency formats ($100 vs 100 USD vs $100.00)',
    detect: (content) => {
      const dollarPrefix = content.match(/\$[\d,]+\.?\d*/g) || [];
      const dollarSuffix = content.match(/[\d,]+\.?\d*\s*(USD|dollars?)/gi) || [];

      if (dollarPrefix.length > 0 && dollarSuffix.length > 0) {
        return {
          prefix: dollarPrefix.slice(0, 3),
          suffix: dollarSuffix.slice(0, 3)
        };
      }
      return null;
    },
    fix: null
  },

  // ============ CONTENT DENSITY MACROS ============

  {
    id: 'density-sparse-content',
    name: 'Sparse Content Detection',
    category: 'content',
    severity: 'info',
    description: 'Detects documents with very little narrative content (mostly tables/headers)',
    detect: (content) => {
      const lines = content.split('\n').filter(l => l.trim());
      let narrativeLines = 0;
      let tableLines = 0;
      let headerLines = 0;

      for (const line of lines) {
        if (line.startsWith('|')) tableLines++;
        else if (line.match(/^#{1,4}\s+/)) headerLines++;
        else if (line.match(/^[\-\*\d]\.\?\s+/)) narrativeLines += 0.5; // Lists count as half
        else narrativeLines++;
      }

      const total = narrativeLines + tableLines + headerLines;
      const narrativeRatio = total > 0 ? narrativeLines / total : 0;

      return narrativeRatio < 0.2 ? {
        narrativeLines,
        tableLines,
        headerLines,
        ratio: narrativeRatio.toFixed(2)
      } : null;
    },
    fix: null // Content issue
  }
];

// =============================================================================
// MACRO ENGINE CLASS
// =============================================================================

export class MacroEngine {
  constructor(config = {}) {
    this.config = config;
    this.rules = [...MACRO_RULES];
    this.enabledCategories = config.enabledCategories ||
      ['encoding', 'content', 'layout', 'overflow'];
    this.autoFixCategories = config.autoFixCategories || ['encoding'];
  }

  /**
   * Run preflight check on content
   * @param {string} content - The markdown content to check
   * @returns {object} - Report of all detected issues
   */
  preflightCheck(content) {
    const issues = {
      errors: [],
      warnings: [],
      info: [],
      summary: { total: 0, errors: 0, warnings: 0, info: 0 }
    };

    for (const rule of this.rules) {
      if (!this.enabledCategories.includes(rule.category)) continue;

      try {
        const result = rule.detect(content);
        if (result) {
          const issue = {
            id: rule.id,
            name: rule.name,
            category: rule.category,
            description: rule.description,
            details: result,
            autoFixable: !!rule.fix && this.autoFixCategories.includes(rule.category)
          };

          issues[rule.severity === 'error' ? 'errors' :
                 rule.severity === 'warning' ? 'warnings' : 'info'].push(issue);
          issues.summary.total++;
          issues.summary[rule.severity === 'error' ? 'errors' :
                         rule.severity === 'warning' ? 'warnings' : 'info']++;
        }
      } catch (err) {
        console.error(`[MacroEngine] Rule ${rule.id} failed:`, err.message);
      }
    }

    return issues;
  }

  /**
   * Apply auto-fixes to content
   * @param {string} content - The markdown content to fix
   * @returns {object} - { content: fixedContent, applied: [...ruleIds] }
   */
  applyMacros(content) {
    let fixedContent = content;
    const applied = [];

    for (const rule of this.rules) {
      if (!rule.fix) continue;
      if (!this.autoFixCategories.includes(rule.category)) continue;

      try {
        const detected = rule.detect(fixedContent);
        if (detected) {
          fixedContent = rule.fix(fixedContent);
          applied.push(rule.id);
        }
      } catch (err) {
        console.error(`[MacroEngine] Fix ${rule.id} failed:`, err.message);
      }
    }

    return { content: fixedContent, applied };
  }

  /**
   * Get all available rules
   */
  getRules() {
    return this.rules.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      severity: r.severity,
      description: r.description,
      autoFixable: !!r.fix
    }));
  }

  /**
   * Enable/disable specific rules
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Add a custom rule
   */
  addRule(rule) {
    if (!rule.id || !rule.detect) {
      throw new Error('Rule must have id and detect function');
    }
    this.rules.push({
      severity: 'info',
      category: 'custom',
      ...rule
    });
  }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Quick preflight check with default settings
 */
export function preflightCheck(content, options = {}) {
  const engine = new MacroEngine(options);
  return engine.preflightCheck(content);
}

/**
 * Apply all auto-fixable macros
 */
export function applyMacros(content, options = {}) {
  const engine = new MacroEngine(options);
  return engine.applyMacros(content);
}

/**
 * Get list of all macro rules
 */
export function listMacroRules() {
  return MACRO_RULES.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    severity: r.severity,
    description: r.description,
    autoFixable: !!r.fix
  }));
}

export { MACRO_RULES };
export default { MacroEngine, preflightCheck, applyMacros, listMacroRules, MACRO_RULES };
