/**
 * AI Student Assistant - Study Material Model
 * Stores extracted text, AI summaries, formulas, and flashcards for uploaded notes.
 */

const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  topic: { type: String, default: 'General' }
});

const mcqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  explanation: { type: String, default: '' }
});

const studyMaterialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    originalFilename: {
      type: String,
      required: true
    },
    storedFilename: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    extractedText: {
      type: String,
      default: ''
    },
    pageCount: {
      type: Number,
      default: 1
    },
    summary: {
      type: String,
      default: ''
    },
    keyConcepts: [{ type: String }],
    formulas: [{ type: String }],
    flashcards: [flashcardSchema],
    practiceQuestions: [mcqSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);
