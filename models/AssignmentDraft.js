/**
 * AI Student Assistant - Assignment Draft Model
 * Implements Assignment Submission Safety:
 * Preparing an assignment stores a draft that requires explicit user confirmation
 * before invoking any submission API.
 */

const mongoose = require('mongoose');

const assignmentDraftSchema = new mongoose.Schema(
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
    courseWorkId: {
      type: String,
      required: true
    },
    assignmentTitle: {
      type: String,
      required: true
    },
    draftContent: {
      type: String,
      default: ''
    },
    attachedFiles: [
      {
        fileName: String,
        fileUrl: String,
        driveFileId: String
      }
    ],
    status: {
      type: String,
      enum: ['draft', 'ready_for_review', 'submitted', 'cancelled'],
      default: 'draft'
    },
    confirmedByStudent: {
      type: Boolean,
      default: false
    },
    confirmedAt: {
      type: Date,
      default: null
    },
    submissionResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AssignmentDraft', assignmentDraftSchema);
