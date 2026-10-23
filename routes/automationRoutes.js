/**
 * AI Student Assistant - Automation & Background Scheduler Routes
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAutomationStatus,
  runClassroomSyncJob,
  runDeadlineScanJob
} = require('../services/automationService');
const { Reminder } = require('../models/AutomationTask');

/**
 * @desc Get Background Automation Status & Job History
 * @route GET /api/automation/status
 */
router.get('/status', protect, async (req, res) => {
  try {
    const status = await getAutomationStatus();
    res.status(200).json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Get User's Active Reminders
 * @route GET /api/automation/reminders
 */
router.get('/reminders', protect, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = reminders.filter((r) => !r.isRead).length;

    res.status(200).json({
      success: true,
      unreadCount,
      reminders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Trigger Immediate Background Sync
 * @route POST /api/automation/trigger-sync
 */
router.post('/trigger-sync', protect, async (req, res) => {
  try {
    await runClassroomSyncJob();
    await runDeadlineScanJob();
    res.status(200).json({
      success: true,
      message: 'Background synchronization and deadline scan triggered successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc Mark Reminder as Read
 * @route PUT /api/automation/reminders/:id/read
 */
router.put('/reminders/:id/read', protect, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    res.status(200).json({ success: true, reminder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
