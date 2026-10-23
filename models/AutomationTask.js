/**
 * AI Student Assistant - Automation Task & Execution Log Model
 * Tracks server-side background cron jobs, deadline reminders, and sync execution logs.
 */

const mongoose = require('mongoose');

const automationTaskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    jobName: {
      type: String,
      required: true,
      enum: ['classroom_sync', 'deadline_scan', 'study_plan_refresh', 'system_heartbeat']
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed'],
      default: 'pending'
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    executedAt: {
      type: Date,
      default: Date.now
    },
    durationMs: {
      type: Number,
      default: 0
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Deadline Reminder Schema
const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    courseId: {
      type: String,
      required: true
    },
    courseName: {
      type: String,
      default: ''
    },
    assignmentId: {
      type: String,
      required: true
    },
    assignmentTitle: {
      type: String,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    reminderType: {
      type: String,
      enum: ['24_hours_before', '12_hours_before', 'overdue', 'study_milestone'],
      required: true
    },
    // Dedup key: userId + assignmentId + reminderType prevents duplicate notifications
    dedupKey: {
      type: String,
      unique: true,
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const AutomationTask = mongoose.model('AutomationTask', automationTaskSchema);
const Reminder = mongoose.model('Reminder', reminderSchema);

module.exports = {
  AutomationTask,
  Reminder
};
