/**
 * AI Student Assistant - PDF Document Generator Utility
 * Uses PDFKit to produce student reports, essays, and code solutions.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateStudentPDF = ({ title, courseName, content, authorName, outputPath }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Header Banner
      doc
        .fontSize(10)
        .fillColor('#7c3aed')
        .text((courseName || 'STUDENT SUBMISSION').toUpperCase(), { align: 'left', tracking: 1 });

      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text(`Generated on ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`, { align: 'right' });

      doc.moveDown(0.5);

      // Title
      doc
        .fontSize(20)
        .fillColor('#1e1b4b')
        .text(title || 'Assignment Solution', { bold: true });

      doc.moveDown(0.3);

      // Student info
      doc
        .fontSize(10)
        .fillColor('#4b5563')
        .text(`Author: ${authorName || 'Student'} | Platform: Aura AI Student Assistant`);

      // Horizontal Divider
      doc.moveDown(0.5);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(1);

      // Content Body
      const lines = (content || '').split('\n');
      for (const line of lines) {
        if (line.startsWith('### ')) {
          doc.moveDown(0.5);
          doc.fontSize(13).fillColor('#6d28d9').text(line.replace('### ', ''), { bold: true });
          doc.moveDown(0.2);
        } else if (line.startsWith('## ')) {
          doc.moveDown(0.8);
          doc.fontSize(15).fillColor('#1e1b4b').text(line.replace('## ', ''), { bold: true });
          doc.moveDown(0.3);
        } else if (line.startsWith('# ')) {
          doc.moveDown(1);
          doc.fontSize(17).fillColor('#1e1b4b').text(line.replace('# ', ''), { bold: true });
          doc.moveDown(0.4);
        } else if (line.startsWith('```')) {
          // Code block indicator
          doc.moveDown(0.3);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          doc.fontSize(10.5).fillColor('#374151').text(`  •  ${line.substring(2)}`, { lineGap: 3 });
        } else if (/^\d+\.\s/.test(line)) {
          doc.fontSize(10.5).fillColor('#374151').text(`  ${line}`, { lineGap: 3 });
        } else if (line.trim().length === 0) {
          doc.moveDown(0.5);
        } else {
          doc.fontSize(10.5).fillColor('#374151').text(line, { lineGap: 4, align: 'justify' });
        }
      }

      // Footer
      const totalPages = doc.bufferedPageRange().count || 1;
      doc.fontSize(8).fillColor('#9ca3af').text(
        'Submission prepared with Aura AI Assistant • Ready for Google Classroom Turn-In',
        50,
        780,
        { align: 'center', width: 495 }
      );

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateStudentPDF };
