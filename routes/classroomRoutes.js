/**
 * AI Student Assistant - Google Classroom Routes
 * Full assignment assistance, homework draft generation, PDF export,
 * Google Drive upload & direct Classroom submission workflow.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const classroomService = require('../services/classroomService');
const geminiService = require('../services/geminiService');
const { generateStudentPDF } = require('../utils/pdfGenerator');
const AssignmentDraft = require('../models/AssignmentDraft');

/**
 * @desc Get User's Courses
 * @route GET /api/classroom/courses
 */
router.get('/courses', protect, async (req, res) => {
  try {
    const result = await classroomService.getCourses(req.user);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Get Assignments with Search, Filter & Categories
 * @route GET /api/classroom/assignments
 */
router.get('/assignments', protect, async (req, res) => {
  try {
    const { courseId, category, search } = req.query;
    const result = await classroomService.getAssignments(req.user, courseId);

    let list = result.assignments;

    // Filter by Category
    if (category && category !== 'all') {
      list = list.filter((item) => item.category === category);
    }

    // Filter by Search Query
    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.courseName.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    res.status(200).json({
      success: true,
      isDemo: result.isDemo,
      label: result.label,
      total: list.length,
      assignments: list
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Get Single Assignment Detailed Info & Submission Status
 * @route GET /api/classroom/assignment/:courseId/:assignmentId
 */
router.get('/assignment/:courseId/:assignmentId', protect, async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const result = await classroomService.getAssignmentDetails(req.user, courseId, assignmentId);

    // Look up existing draft if any
    const draft = await AssignmentDraft.findOne({
      userId: req.user._id,
      courseWorkId: assignmentId
    });

    res.status(200).json({
      success: true,
      isDemo: result.isDemo,
      assignment: result.assignment,
      draft: draft || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Explain Assignment in Simple Student-Friendly Language
 * @route POST /api/classroom/ai-helper/explain
 */
router.post('/ai-helper/explain', protect, async (req, res) => {
  try {
    const { title, description, courseName } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Assignment title is required' });
    }

    const explanation = await geminiService.explainAssignmentQuestion({
      title,
      description: description || '',
      courseName: courseName || ''
    });

    res.status(200).json(explanation);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Generate Homework Solution Draft (Report, Code, or Derivation)
 * @route POST /api/classroom/ai-helper/generate-draft
 */
router.post('/ai-helper/generate-draft', protect, async (req, res) => {
  try {
    const { title, description, courseName, solutionType, studentNotes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Assignment title is required' });
    }

    const draft = await geminiService.generateAssignmentSolution({
      title,
      description: description || '',
      courseName: courseName || '',
      solutionType: solutionType || 'report',
      studentNotes: studentNotes || ''
    });

    res.status(200).json(draft);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Export Student's Solution Draft to a Downloadable PDF
 * @route POST /api/classroom/ai-helper/export-pdf
 */
router.post('/ai-helper/export-pdf', protect, async (req, res) => {
  try {
    const { title, courseName, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required to export PDF' });
    }

    const uploadsDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sanitizedTitle = (title || 'Assignment').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `submission-${Date.now()}-${sanitizedTitle}.pdf`;
    const outputPath = path.join(uploadsDir, filename);

    await generateStudentPDF({
      title,
      courseName,
      content,
      authorName: req.user.name,
      outputPath
    });

    res.status(200).json({
      success: true,
      message: 'PDF exported successfully',
      filename,
      downloadUrl: `/uploads/${filename}`,
      filePath: outputPath
    });
  } catch (error) {
    console.error('[Export PDF Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Upload Student Homework File from local disk
 * @route POST /api/classroom/upload-homework
 */
router.post('/upload-homework', protect, upload.single('homeworkFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a file to upload' });
    }

    res.status(200).json({
      success: true,
      message: 'Homework file uploaded successfully to workspace',
      file: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileUrl: `/uploads/${req.file.filename}`,
        filePath: req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Save or Update Assignment Draft
 * @route POST /api/classroom/draft
 */
router.post('/draft', protect, async (req, res) => {
  try {
    const { courseId, courseName, assignmentId, assignmentTitle, draftContent, attachedFiles } = req.body;

    if (!courseId || !assignmentId || !assignmentTitle) {
      return res.status(400).json({
        success: false,
        message: 'Missing required assignment fields'
      });
    }

    const draft = await AssignmentDraft.findOneAndUpdate(
      { userId: req.user._id, courseWorkId: assignmentId },
      {
        courseId,
        courseName: courseName || '',
        assignmentTitle,
        draftContent: draftContent || '',
        attachedFiles: attachedFiles || [],
        status: 'ready_for_review',
        confirmedByStudent: false
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Draft saved safely. Explicit confirmation required before submission.',
      draft
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Full Direct Homework Submission Workflow
 * 1. Checks confirmation
 * 2. Uploads file to student's Google Drive (if local file attached)
 * 3. Modifies student submission with Drive file attachment
 * 4. Turns in assignment via Classroom API
 * 5. Verifies API response
 * @route POST /api/classroom/submit-direct
 */
const handleSubmissionWorkflow = async (req, res) => {
  try {
    const { courseId, assignmentId, submissionId, localFilePath, fileName, mimeType, confirmedByUser } = req.body;

    // Safety Step 1: Explicit Confirmation Check
    if (!confirmedByUser) {
      return res.status(400).json({
        success: false,
        message: 'SAFETY CHECK: Explicit user confirmation is required before submitting coursework to Google Classroom.'
      });
    }

    if (!courseId || !assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing courseId or assignmentId.'
      });
    }

    let finalSubmissionId = submissionId;

    // If submissionId not provided, look it up from assignment details
    if (!finalSubmissionId) {
      const details = await classroomService.getAssignmentDetails(req.user, courseId, assignmentId);
      finalSubmissionId = details.assignment?.submissionId || 'demo-sub-1';
    }

    let driveFileResult = null;

    // Step 2 & 3: If student has a file to submit, upload to Google Drive & attach to Classroom
    if (localFilePath) {
      const resolvedPath = path.isAbsolute(localFilePath)
        ? localFilePath
        : path.join(__dirname, '../public', localFilePath.replace(/^\//, ''));

      if (fs.existsSync(resolvedPath)) {
        const uploadName = fileName || path.basename(resolvedPath);
        driveFileResult = await classroomService.uploadFileToDrive(
          req.user,
          resolvedPath,
          uploadName,
          mimeType || 'application/pdf'
        );

        if (driveFileResult && driveFileResult.id) {
          await classroomService.attachDriveFileToSubmission(
            req.user,
            courseId,
            assignmentId,
            finalSubmissionId,
            driveFileResult.id
          );
        }
      }
    }

    // Step 4: Turn In Assignment
    const turnInResult = await classroomService.turnInAssignment(
      req.user,
      courseId,
      assignmentId,
      finalSubmissionId
    );

    // Step 5: Verify API Response & Update Draft in DB
    if (!turnInResult.success) {
      return res.status(502).json({
        success: false,
        message: 'Google Classroom API did not confirm submission. Please try again or check Classroom permissions.',
        details: turnInResult
      });
    }

    await AssignmentDraft.findOneAndUpdate(
      { userId: req.user._id, courseWorkId: assignmentId },
      {
        status: 'submitted',
        confirmedByStudent: true,
        confirmedAt: new Date(),
        submissionResponse: turnInResult
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Homework successfully turned in to Google Classroom!',
      isDemo: turnInResult.isDemo,
      submissionState: turnInResult.submissionState,
      driveFile: driveFileResult,
      turnInDetails: turnInResult.data || null
    });
  } catch (error) {
    console.error('[Direct Submission Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit assignment to Google Classroom',
      nextStep: 'Check that your Google account has granted Classroom and Drive permissions in Settings.'
    });
  }
};

router.post('/submit', protect, handleSubmissionWorkflow);
router.post('/submit-direct', protect, handleSubmissionWorkflow);

/**
 * @desc Reclaim / Unsubmit Assignment
 * @route POST /api/classroom/reclaim
 */
router.post('/reclaim', protect, async (req, res) => {
  try {
    const { courseId, assignmentId, submissionId } = req.body;

    if (!courseId || !assignmentId || !submissionId) {
      return res.status(400).json({ success: false, message: 'Missing courseId, assignmentId, or submissionId' });
    }

    const result = await classroomService.reclaimAssignment(
      req.user,
      courseId,
      assignmentId,
      submissionId
    );

    await AssignmentDraft.findOneAndUpdate(
      { userId: req.user._id, courseWorkId: assignmentId },
      { status: 'draft', confirmedByStudent: false }
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
