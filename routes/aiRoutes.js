/**
 * AI Student Assistant - AI & Study Planner Routes
 * Powered by Google Gemini and academic scheduling algorithms.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const geminiService = require('../services/geminiService');
const classroomService = require('../services/classroomService');
const StudyPlan = require('../models/StudyPlan');

/**
 * @desc Conversational Chat / Voice Query
 * @route POST /api/ai/chat
 */
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, context, history } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const result = await geminiService.chatWithAssistant({
      message,
      context: context || {},
      history: history || []
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Summarize Study Text / Notes
 * @route POST /api/ai/summarize
 */
router.post('/summarize', protect, async (req, res) => {
  try {
    const { content, filename } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const result = await geminiService.summarizeStudyNotes(content, filename || 'Document');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Generate Flashcards & Practice MCQs
 * @route POST /api/ai/practice
 */
router.post('/practice', protect, async (req, res) => {
  try {
    const { topic, sourceText } = req.body;

    if (!topic && !sourceText) {
      return res.status(400).json({ success: false, message: 'Topic or source text is required' });
    }

    const result = await geminiService.generatePracticeQuestions(sourceText || topic, topic || 'General');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Get User's Active Study Plan
 * @route GET /api/ai/study-plan
 */
router.get('/study-plan', protect, async (req, res) => {
  try {
    let plan = await StudyPlan.findOne({ userId: req.user._id }).sort({ createdAt: -1 });

    if (!plan) {
      // Auto-generate initial plan if none exists
      const data = await classroomService.getAssignments(req.user);
      const generated = await geminiService.createSmartStudyPlan(data.assignments, {
        dailyStudyHours: req.user.preferences?.dailyStudyHours || 3
      });

      const formattedTasks = (generated.data?.tasks || []).map((t) => ({
        ...t,
        scheduledDate: new Date(t.scheduledDate || Date.now())
      }));

      plan = await StudyPlan.create({
        userId: req.user._id,
        title: generated.data?.title || 'Weekly Study Schedule',
        notes: generated.data?.notes || '',
        tasks: formattedTasks
      });
    }

    res.status(200).json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Generate New Smart Study Plan from Active Assignments
 * @route POST /api/ai/study-plan/generate
 */
router.post('/study-plan/generate', protect, async (req, res) => {
  try {
    const { dailyStudyHours } = req.body;
    const data = await classroomService.getAssignments(req.user);

    const generated = await geminiService.createSmartStudyPlan(data.assignments, {
      dailyStudyHours: dailyStudyHours || req.user.preferences?.dailyStudyHours || 3
    });

    const formattedTasks = (generated.data?.tasks || []).map((t) => ({
      ...t,
      scheduledDate: new Date(t.scheduledDate || Date.now())
    }));

    const plan = await StudyPlan.create({
      userId: req.user._id,
      title: generated.data?.title || 'Weekly Study Schedule',
      notes: generated.data?.notes || '',
      tasks: formattedTasks
    });

    res.status(200).json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Toggle Study Task Completion Status
 * @route PUT /api/ai/study-plan/task/:taskId/toggle
 */
router.put('/study-plan/task/:taskId/toggle', protect, async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({
      userId: req.user._id,
      'tasks._id': req.params.taskId
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Task or plan not found' });
    }

    const task = plan.tasks.id(req.params.taskId);
    task.isCompleted = !task.isCompleted;
    task.completedAt = task.isCompleted ? new Date() : null;

    await plan.save();

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
