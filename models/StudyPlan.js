/**
 * AI Student Assistant - Study Plan Model
 * Stores scheduled tasks, deadlines, priorities, and completion states.
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  courseName: { type: String, default: 'General' },
  courseId: { type: String, default: '' },
  assignmentId: { type: String, default: '' },
  dueDate: { type: Date, default: null },
  scheduledDate: { type: Date, required: true },
  estimatedMinutes: { type: Number, default: 45 },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date, default: null }
});

const studyPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'My Weekly Study Schedule'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    tasks: [taskSchema],
    generatedByAI: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
