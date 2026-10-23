/**
 * AI Student Assistant - Document Parser Utility
 * Extracts plain text from PDF, PPTX, and TXT files.
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const extractTextFromFile = async (filePath, mimeType) => {
  const ext = path.extname(filePath).toLowerCase();

  // 1. Plain text / Markdown
  if (ext === '.txt' || ext === '.md' || mimeType === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  // 2. PDF Files
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      if (typeof textResult === 'string') return textResult;
      if (textResult && textResult.text) return textResult.text;
      return String(textResult || '');
    } catch (pdfErr) {
      console.warn('[PDF Parse Warning]:', pdfErr.message);
      // Fallback: extract printable ASCII
      const raw = fs.readFileSync(filePath, 'binary');
      return raw.replace(/[^\x20-\x7E\t\r\n]/g, ' ').substring(0, 10000);
    }
  }

  // 3. PPTX / Documents fallback
  const raw = fs.readFileSync(filePath, 'utf-8');
  return raw.replace(/[^\x20-\x7E\t\r\n]/g, ' ').substring(0, 10000);
};

module.exports = { extractTextFromFile };
