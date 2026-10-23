/**
 * AI Student Assistant - Study Material Upload & Parsing Routes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { extractTextFromFile } = require('../utils/documentParser');
const geminiService = require('../services/geminiService');
const StudyMaterial = require('../models/StudyMaterial');

/**
 * @desc Upload Study Material (PDF, PPTX, TXT) & Extract AI Notes
 * @route POST /api/upload/study-material
 */
router.post('/study-material', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a file to upload' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // 1. Extract text
    const extractedText = await extractTextFromFile(filePath, mimeType);

    // 2. Synthesize summaries, key concepts, formulas
    const aiSummary = await geminiService.summarizeStudyNotes(extractedText, req.file.originalname);
    const summaryData = aiSummary.data || {};

    // 3. Save to database
    const material = await StudyMaterial.create({
      userId: req.user._id,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      extractedText: extractedText.substring(0, 50000), // retain first 50k chars
      summary: summaryData.summary || '',
      keyConcepts: summaryData.keyConcepts || [],
      formulas: summaryData.formulas || []
    });

    res.status(201).json({
      success: true,
      message: 'Study notes uploaded and summarized successfully.',
      material: {
        id: material._id,
        filename: material.originalFilename,
        fileUrl: `/uploads/${material.storedFilename}`,
        summary: material.summary,
        keyConcepts: material.keyConcepts,
        formulas: material.formulas,
        pageOrSlideReferences: summaryData.pageOrSlideReferences || [],
        isDemo: aiSummary.isDemo
      }
    });
  } catch (error) {
    console.error('[Upload Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Get User's Uploaded Materials
 * @route GET /api/upload/materials
 */
router.get('/materials', protect, async (req, res) => {
  try {
    const materials = await StudyMaterial.find({ userId: req.user._id })
      .select('-extractedText')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
