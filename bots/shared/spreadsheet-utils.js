/**
 * Spreadsheet Utilities
 *
 * Read and process XLS/XLSX files for Scout and Spark bots.
 * Includes formula analysis, worksheet metadata, and advanced object extraction.
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Read a spreadsheet file and return parsed workbook
 * @param {string|Buffer} input - File path or buffer
 * @param {Object} options - Read options
 * @returns {Object} Parsed workbook
 */
export function readSpreadsheet(input, options = {}) {
  const readOpts = {
    type: Buffer.isBuffer(input) ? 'buffer' : 'file',
    cellFormula: true,    // Extract formulas
    cellStyles: true,     // Extract styles
    cellNF: true,         // Number formats
    cellDates: true,      // Parse dates
    sheetStubs: true,     // Include empty cells
    ...options
  };

  if (Buffer.isBuffer(input)) {
    return XLSX.read(input, readOpts);
  }
  return XLSX.readFile(input, readOpts);
}

/**
 * Get sheet names from a workbook
 * @param {Object} workbook - XLSX workbook object
 * @returns {string[]} Array of sheet names
 */
export function getSheetNames(workbook) {
  return workbook.SheetNames;
}

/**
 * Extract all formulas from a sheet
 * @param {Object} sheet - XLSX sheet object
 * @param {string} sheetName - Name of the sheet
 * @returns {Object[]} Array of formula objects with cell reference, formula, and calculated value
 */
export function extractFormulas(sheet, sheetName) {
  const formulas = [];
  if (!sheet['!ref']) return formulas;

  const range = XLSX.utils.decode_range(sheet['!ref']);

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellRef];

      if (cell && cell.f) {
        formulas.push({
          cell: cellRef,
          sheet: sheetName,
          formula: cell.f,
          value: cell.v,
          type: cell.t // s=string, n=number, b=boolean, d=date, e=error
        });
      }
    }
  }

  return formulas;
}

/**
 * Analyze formula dependencies and patterns
 * @param {Object[]} formulas - Array of formula objects
 * @returns {Object} Formula analysis
 */
export function analyzeFormulas(formulas) {
  const analysis = {
    total: formulas.length,
    byType: {},
    complexFormulas: [],
    crossSheetRefs: [],
    aggregations: [],
    lookups: []
  };

  const patterns = {
    SUM: /\bSUM\(/i,
    AVERAGE: /\bAVERAGE\(/i,
    COUNT: /\bCOUNT[A]?\(/i,
    IF: /\bIF\(/i,
    VLOOKUP: /\bVLOOKUP\(/i,
    HLOOKUP: /\bHLOOKUP\(/i,
    INDEX: /\bINDEX\(/i,
    MATCH: /\bMATCH\(/i,
    SUMIF: /\bSUMIF[S]?\(/i,
    COUNTIF: /\bCOUNTIF[S]?\(/i,
    PIVOT: /\bGETPIVOTDATA\(/i
  };

  for (const f of formulas) {
    // Categorize by function type
    for (const [name, regex] of Object.entries(patterns)) {
      if (regex.test(f.formula)) {
        analysis.byType[name] = (analysis.byType[name] || 0) + 1;
      }
    }

    // Detect cross-sheet references
    if (f.formula.includes('!')) {
      analysis.crossSheetRefs.push(f);
    }

    // Complex formulas (nested or long)
    const nesting = (f.formula.match(/\(/g) || []).length;
    if (nesting > 3 || f.formula.length > 100) {
      analysis.complexFormulas.push({
        ...f,
        complexity: nesting
      });
    }

    // Aggregation formulas
    if (/\b(SUM|AVERAGE|COUNT|MAX|MIN|STDEV)\(/i.test(f.formula)) {
      analysis.aggregations.push(f);
    }

    // Lookup formulas
    if (/\b(VLOOKUP|HLOOKUP|INDEX|MATCH|XLOOKUP)\(/i.test(f.formula)) {
      analysis.lookups.push(f);
    }
  }

  return analysis;
}

/**
 * Get named ranges from workbook
 * @param {Object} workbook - XLSX workbook object
 * @returns {Object[]} Array of named range definitions
 */
export function getNamedRanges(workbook) {
  const namedRanges = [];

  if (workbook.Workbook?.Names) {
    for (const name of workbook.Workbook.Names) {
      namedRanges.push({
        name: name.Name,
        ref: name.Ref,
        scope: name.Sheet !== undefined ? workbook.SheetNames[name.Sheet] : 'Workbook',
        hidden: name.Hidden || false
      });
    }
  }

  return namedRanges;
}

/**
 * Get merged cell regions from a sheet
 * @param {Object} sheet - XLSX sheet object
 * @returns {string[]} Array of merged cell ranges (e.g., "A1:C3")
 */
export function getMergedCells(sheet) {
  return sheet['!merges']?.map(merge => {
    return XLSX.utils.encode_range(merge);
  }) || [];
}

/**
 * Get cell comments/notes from a sheet
 * @param {Object} sheet - XLSX sheet object
 * @returns {Object[]} Array of comments with cell reference and text
 */
export function getComments(sheet) {
  const comments = [];

  if (sheet['!comments']) {
    for (const [cell, comment] of Object.entries(sheet['!comments'])) {
      comments.push({
        cell,
        author: comment.a || 'Unknown',
        text: comment.t || ''
      });
    }
  }

  return comments;
}

/**
 * Analyze column data types and statistics
 * @param {Object} sheet - XLSX sheet object
 * @param {number} sampleSize - Number of rows to sample
 * @returns {Object[]} Array of column analysis
 */
export function analyzeColumns(sheet, sampleSize = 100) {
  if (!sheet['!ref']) return [];

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (data.length < 2) return [];

  // Find the actual header row (first row with multiple non-empty cells)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] || [];
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '');
    if (nonEmptyCells.length >= 2) {
      headerRowIndex = i;
      break;
    }
    if (nonEmptyCells.length === 1 && String(nonEmptyCells[0]).length > 20) {
      continue;
    }
    if (i === 0 && nonEmptyCells.length >= 1) {
      break;
    }
  }

  const headers = data[headerRowIndex] || [];
  const maxCols = Math.max(...data.slice(headerRowIndex, headerRowIndex + 50).map(row => (row || []).length));

  // Build effective headers for all columns
  const effectiveHeaders = [];
  for (let i = 0; i < maxCols; i++) {
    const h = headers[i];
    effectiveHeaders.push(h !== null && h !== undefined && h !== '' ? h : `Col${i + 1}`);
  }

  const rows = data.slice(headerRowIndex + 1, headerRowIndex + 1 + sampleSize);
  const columns = [];

  for (let c = 0; c < effectiveHeaders.length; c++) {
    const values = rows.map(row => row ? row[c] : undefined).filter(v => v !== null && v !== undefined && v !== '');

    const analysis = {
      header: effectiveHeaders[c],
      index: c,
      nonEmpty: values.length,
      empty: rows.length - values.length,
      types: {}
    };

    // Analyze value types
    for (const val of values) {
      let type = typeof val;
      if (type === 'number') {
        type = Number.isInteger(val) ? 'integer' : 'decimal';
      } else if (type === 'object' && val instanceof Date) {
        type = 'date';
      } else if (type === 'string') {
        // Check for patterns
        if (/^\d{4}-\d{2}-\d{2}/.test(val)) type = 'date-string';
        else if (/^[\d,]+\.?\d*$/.test(val)) type = 'numeric-string';
        else if (/^[$€£¥]/.test(val)) type = 'currency';
        else if (/@/.test(val)) type = 'email';
        else if (/^https?:\/\//.test(val)) type = 'url';
      }
      analysis.types[type] = (analysis.types[type] || 0) + 1;
    }

    // Determine primary type
    const sortedTypes = Object.entries(analysis.types).sort((a, b) => b[1] - a[1]);
    analysis.primaryType = sortedTypes[0]?.[0] || 'unknown';

    // Numeric statistics
    const numericVals = values.filter(v => typeof v === 'number');
    if (numericVals.length > 0) {
      analysis.stats = {
        min: Math.min(...numericVals),
        max: Math.max(...numericVals),
        sum: numericVals.reduce((a, b) => a + b, 0),
        avg: numericVals.reduce((a, b) => a + b, 0) / numericVals.length
      };
    }

    // Unique values (for categorical detection)
    const uniqueVals = new Set(values.map(v => String(v)));
    analysis.uniqueCount = uniqueVals.size;
    if (uniqueVals.size <= 10 && values.length > 5) {
      analysis.categorical = true;
      analysis.categories = [...uniqueVals].slice(0, 10);
    }

    columns.push(analysis);
  }

  return columns;
}

/**
 * Get data validation rules from a sheet
 * @param {Object} sheet - XLSX sheet object
 * @returns {Object[]} Array of validation rules
 */
export function getDataValidation(sheet) {
  const validations = [];

  if (sheet['!dataValidations']) {
    for (const dv of sheet['!dataValidations']) {
      validations.push({
        range: dv.sqref,
        type: dv.type,
        operator: dv.operator,
        formula1: dv.formula1,
        formula2: dv.formula2,
        allowBlank: dv.allowBlank,
        showDropDown: dv.showDropDown,
        errorTitle: dv.errorTitle,
        error: dv.error,
        promptTitle: dv.promptTitle,
        prompt: dv.prompt
      });
    }
  }

  return validations;
}

/**
 * Convert a sheet to JSON array of objects
 * @param {Object} workbook - XLSX workbook object
 * @param {string} sheetName - Name of sheet (optional, uses first sheet if not provided)
 * @param {Object} options - Parsing options
 * @returns {Object[]} Array of row objects
 */
export function sheetToJSON(workbook, sheetName = null, options = {}) {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, {
    header: options.header,
    defval: options.defaultValue || '',
    raw: options.raw !== false
  });
}

/**
 * Convert a sheet to CSV string
 * @param {Object} workbook - XLSX workbook object
 * @param {string} sheetName - Name of sheet (optional)
 * @returns {string} CSV string
 */
export function sheetToCSV(workbook, sheetName = null) {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) return '';

  return XLSX.utils.sheet_to_csv(sheet);
}

/**
 * Convert a sheet to Markdown table
 * @param {Object} workbook - XLSX workbook object
 * @param {string} sheetName - Name of sheet (optional)
 * @param {Object} options - Formatting options
 * @returns {string} Markdown table string
 */
export function sheetToMarkdown(workbook, sheetName = null, options = {}) {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) return '';

  const maxRows = options.maxRows || 100;
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) return '_Empty sheet_';

  // Find the actual header row (first row with multiple non-empty cells)
  // This handles spreadsheets with title rows or merged header cells
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] || [];
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '');
    // If this row has 2+ non-empty cells, it's likely the header row
    if (nonEmptyCells.length >= 2) {
      headerRowIndex = i;
      break;
    }
    // If this row has only 1 cell but it looks like a title (long text), skip it
    if (nonEmptyCells.length === 1 && String(nonEmptyCells[0]).length > 20) {
      continue;
    }
    // If first row has multiple cells, use it as header
    if (i === 0 && nonEmptyCells.length >= 1) {
      break;
    }
  }

  const headers = data[headerRowIndex] || [];
  // Get all column indices that have data
  const maxCols = Math.max(...data.slice(headerRowIndex, headerRowIndex + 50).map(row => (row || []).length));

  // Ensure we have headers for all columns
  const effectiveHeaders = [];
  for (let i = 0; i < maxCols; i++) {
    const h = headers[i];
    effectiveHeaders.push(h !== null && h !== undefined && h !== '' ? String(h).trim() : `Col${i + 1}`);
  }

  const rows = data.slice(headerRowIndex + 1, headerRowIndex + 1 + maxRows);

  // Build markdown table with all columns
  let md = '| ' + effectiveHeaders.join(' | ') + ' |\n';
  md += '| ' + effectiveHeaders.map(() => '---').join(' | ') + ' |\n';

  for (const row of rows) {
    const cells = effectiveHeaders.map((_, i) => {
      const val = row ? row[i] : undefined;
      if (val === null || val === undefined) return '';
      return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    });
    md += '| ' + cells.join(' | ') + ' |\n';
  }

  if (data.length > headerRowIndex + 1 + maxRows) {
    md += `\n_... and ${data.length - headerRowIndex - 1 - maxRows} more rows_`;
  }

  return md;
}

/**
 * Get comprehensive spreadsheet summary with advanced analysis
 * @param {Object} workbook - XLSX workbook object
 * @param {Object} options - Analysis options
 * @returns {Object} Complete summary with formulas, ranges, etc.
 */
export function getSpreadsheetSummary(workbook, options = {}) {
  const includeFormulas = options.includeFormulas !== false;
  const includeColumns = options.includeColumns !== false;

  const summary = {
    sheetCount: workbook.SheetNames.length,
    sheets: [],
    formulas: {
      total: 0,
      bySheet: {},
      analysis: null
    },
    namedRanges: getNamedRanges(workbook),
    workbookProperties: workbook.Props || {}
  };

  const allFormulas = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find the actual header row (first row with multiple non-empty cells)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i] || [];
      const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '');
      if (nonEmptyCells.length >= 2) {
        headerRowIndex = i;
        break;
      }
      if (nonEmptyCells.length === 1 && String(nonEmptyCells[0]).length > 20) {
        continue;
      }
      if (i === 0 && nonEmptyCells.length >= 1) {
        break;
      }
    }

    const rawHeaders = data[headerRowIndex] || [];
    const maxCols = Math.max(...data.slice(headerRowIndex, headerRowIndex + 50).map(row => (row || []).length), 1);

    // Build effective headers for all columns
    const effectiveHeaders = [];
    for (let i = 0; i < maxCols; i++) {
      const h = rawHeaders[i];
      effectiveHeaders.push(h !== null && h !== undefined && h !== '' ? String(h) : `Col${i + 1}`);
    }

    const sheetInfo = {
      name,
      rows: data.length - headerRowIndex,
      columns: maxCols,
      headers: effectiveHeaders,
      hasData: data.length > headerRowIndex + 1,
      mergedCells: getMergedCells(sheet),
      comments: getComments(sheet),
      dataValidation: getDataValidation(sheet),
      headerRowIndex
    };

    // Sample first few data rows for preview
    if (data.length > 1) {
      sheetInfo.sampleRows = data.slice(1, 4);
    }

    // Extract formulas
    if (includeFormulas) {
      const sheetFormulas = extractFormulas(sheet, name);
      sheetInfo.formulaCount = sheetFormulas.length;
      allFormulas.push(...sheetFormulas);
      summary.formulas.bySheet[name] = sheetFormulas.length;
    }

    // Column analysis
    if (includeColumns && data.length > 1) {
      sheetInfo.columnAnalysis = analyzeColumns(sheet, 50);
    }

    summary.sheets.push(sheetInfo);
  }

  // Aggregate formula analysis
  if (includeFormulas && allFormulas.length > 0) {
    summary.formulas.total = allFormulas.length;
    summary.formulas.analysis = analyzeFormulas(allFormulas);
    summary.formulas.samples = allFormulas.slice(0, 20); // First 20 formulas
  }

  return summary;
}

/**
 * Convert entire workbook to a format suitable for LLM processing
 * @param {Object} workbook - XLSX workbook object
 * @param {Object} options - Conversion options
 * @returns {string} Formatted string representation
 */
export function workbookToLLMContext(workbook, options = {}) {
  const maxRowsPerSheet = options.maxRowsPerSheet || 50;
  const format = options.format || 'markdown';
  const includeFormulas = options.includeFormulas !== false;
  const includeAdvanced = options.includeAdvanced !== false;

  const summary = getSpreadsheetSummary(workbook, {
    includeFormulas,
    includeColumns: includeAdvanced
  });

  let output = `## Spreadsheet Analysis\n\n`;

  // Workbook properties
  if (summary.workbookProperties.Title || summary.workbookProperties.Author) {
    output += `**Title**: ${summary.workbookProperties.Title || 'Untitled'}\n`;
    output += `**Author**: ${summary.workbookProperties.Author || 'Unknown'}\n`;
    if (summary.workbookProperties.LastAuthor) {
      output += `**Last Modified By**: ${summary.workbookProperties.LastAuthor}\n`;
    }
    output += '\n';
  }

  output += `### Overview\n`;
  output += `- **Sheets**: ${summary.sheetCount} (${summary.sheets.map(s => s.name).join(', ')})\n`;
  output += `- **Total Formulas**: ${summary.formulas.total}\n`;

  if (summary.namedRanges.length > 0) {
    output += `- **Named Ranges**: ${summary.namedRanges.length}\n`;
  }
  output += '\n';

  // Named Ranges
  if (summary.namedRanges.length > 0 && includeAdvanced) {
    output += `### Named Ranges\n`;
    for (const nr of summary.namedRanges.slice(0, 10)) {
      output += `- **${nr.name}**: \`${nr.ref}\` (${nr.scope})\n`;
    }
    if (summary.namedRanges.length > 10) {
      output += `- _...and ${summary.namedRanges.length - 10} more_\n`;
    }
    output += '\n';
  }

  // Formula Analysis
  if (summary.formulas.total > 0 && includeFormulas) {
    output += `### Formula Analysis\n`;
    const fa = summary.formulas.analysis;

    if (Object.keys(fa.byType).length > 0) {
      output += `**Functions Used**:\n`;
      for (const [func, count] of Object.entries(fa.byType).sort((a, b) => b[1] - a[1])) {
        output += `- ${func}: ${count}\n`;
      }
      output += '\n';
    }

    if (fa.crossSheetRefs.length > 0) {
      output += `**Cross-Sheet References**: ${fa.crossSheetRefs.length}\n`;
    }
    if (fa.lookups.length > 0) {
      output += `**Lookup Formulas**: ${fa.lookups.length}\n`;
    }
    if (fa.complexFormulas.length > 0) {
      output += `**Complex Formulas**: ${fa.complexFormulas.length}\n`;
      output += '\nSample complex formulas:\n';
      for (const cf of fa.complexFormulas.slice(0, 3)) {
        output += `- \`${cf.cell}\`: \`=${cf.formula.substring(0, 80)}${cf.formula.length > 80 ? '...' : ''}\`\n`;
      }
    }
    output += '\n';
  }

  // Per-sheet details
  for (const sheetInfo of summary.sheets) {
    output += `---\n### Sheet: ${sheetInfo.name}\n`;
    output += `- **Size**: ${sheetInfo.rows} rows × ${sheetInfo.columns} columns\n`;

    if (sheetInfo.formulaCount > 0) {
      output += `- **Formulas**: ${sheetInfo.formulaCount}\n`;
    }
    if (sheetInfo.mergedCells.length > 0) {
      output += `- **Merged Cells**: ${sheetInfo.mergedCells.length} regions\n`;
    }
    if (sheetInfo.comments.length > 0) {
      output += `- **Comments**: ${sheetInfo.comments.length}\n`;
      for (const c of sheetInfo.comments.slice(0, 3)) {
        output += `  - ${c.cell}: "${c.text.substring(0, 50)}${c.text.length > 50 ? '...' : ''}" (${c.author})\n`;
      }
    }
    if (sheetInfo.dataValidation.length > 0) {
      output += `- **Data Validation Rules**: ${sheetInfo.dataValidation.length}\n`;
    }

    // Column analysis
    if (sheetInfo.columnAnalysis && includeAdvanced) {
      output += '\n**Column Analysis**:\n';
      for (const col of sheetInfo.columnAnalysis.slice(0, 10)) {
        output += `- **${col.header}**: ${col.primaryType}`;
        if (col.stats) {
          output += ` (min: ${col.stats.min.toFixed(2)}, max: ${col.stats.max.toFixed(2)}, avg: ${col.stats.avg.toFixed(2)})`;
        }
        if (col.categorical) {
          output += ` [${col.categories.slice(0, 5).join(', ')}${col.categories.length > 5 ? '...' : ''}]`;
        }
        output += '\n';
      }
    }

    output += '\n';

    if (sheetInfo.hasData) {
      output += `**Headers**: ${sheetInfo.headers.join(', ')}\n\n`;

      if (format === 'markdown') {
        output += sheetToMarkdown(workbook, sheetInfo.name, { maxRows: maxRowsPerSheet });
      } else if (format === 'csv') {
        output += '```csv\n';
        output += sheetToCSV(workbook, sheetInfo.name);
        output += '\n```';
      } else {
        const json = sheetToJSON(workbook, sheetInfo.name);
        output += '```json\n';
        output += JSON.stringify(json.slice(0, maxRowsPerSheet), null, 2);
        output += '\n```';
      }
    } else {
      output += '_Empty sheet_\n';
    }
    output += '\n\n';
  }

  return output;
}

/**
 * Process a spreadsheet file attachment
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Processing options
 * @returns {Object} Processed result with context and metadata
 */
export function processSpreadsheetAttachment(buffer, filename, options = {}) {
  try {
    const workbook = readSpreadsheet(buffer);
    const summary = getSpreadsheetSummary(workbook, options);
    const context = workbookToLLMContext(workbook, options);

    return {
      success: true,
      filename,
      type: path.extname(filename).toLowerCase(),
      summary,
      context,
      rowCount: summary.sheets.reduce((acc, s) => acc + s.rows, 0),
      sheetCount: summary.sheetCount,
      formulaCount: summary.formulas.total,
      namedRangeCount: summary.namedRanges.length,
      hasComplexFormulas: summary.formulas.analysis?.complexFormulas?.length > 0
    };
  } catch (error) {
    return {
      success: false,
      filename,
      error: error.message
    };
  }
}

/**
 * Check if a file is a supported spreadsheet format
 * @param {string} filename - Filename to check
 * @returns {boolean} True if supported
 */
export function isSpreadsheet(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.xls', '.xlsx', '.xlsm', '.xlsb', '.csv', '.ods'].includes(ext);
}

export default {
  readSpreadsheet,
  getSheetNames,
  extractFormulas,
  analyzeFormulas,
  getNamedRanges,
  getMergedCells,
  getComments,
  analyzeColumns,
  getDataValidation,
  sheetToJSON,
  sheetToCSV,
  sheetToMarkdown,
  getSpreadsheetSummary,
  workbookToLLMContext,
  processSpreadsheetAttachment,
  isSpreadsheet
};
