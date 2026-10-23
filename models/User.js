/**
 * AI Student Assistant - User Model
 * Stores user profiles, Google OAuth tokens, and preferences.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      default: null
    },
    googleId: {
      type: String,
      sparse: true
    },
    avatar: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: ['student', 'admin', 'user'],
      default: 'student'
    },
    googleTokens: {
      access_token: { type: String, default: null },
      refresh_token: { type: String, default: null },
      scope: { type: String, default: null },
      token_type: { type: String, default: null },
      expiry_date: { type: Number, default: null }
    },
    classroomAuthorized: {
      type: Boolean,
      default: false
    },
    preferences: {
      voiceEnabled: { type: Boolean, default: true },
      preferredVoice: { type: String, default: '' },
      speechRate: { type: Number, default: 1.0 },
      dailyStudyHours: { type: Number, default: 3 },
      theme: { type: String, default: 'lavender' }
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user has valid Classroom authorization
userSchema.methods.hasClassroomAccess = function () {
  return !!(
    this.googleTokens &&
    (this.googleTokens.access_token || this.googleTokens.refresh_token) &&
    this.classroomAuthorized
  );
};

module.exports = mongoose.model('User', userSchema);
