/**
 * AI Student Assistant - File Upload Middleware
 * Handles study materials (PDF, PPTX, TXT, DOCX) and assignment files.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitized}`);
  }
});

// File filter supporting documents, code solutions, datasets, and archives
const fileFilter = (req, file, cb) => {
  const allowedExts = /pdf|txt|pptx|ppt|docx|doc|jpeg|jpg|png|webp|zip|tar|gz|py|js|ts|java|c|cpp|cs|html|css|json|md|csv|xlsx|ipynb/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  if (allowedExts.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Allowed formats: PDF, DOCX, TXT, code files (.py, .js, .java, .cpp), and archives (.zip).'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: fileFilter
});

module.exports = upload;
