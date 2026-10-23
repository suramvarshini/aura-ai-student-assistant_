/**
 * AI Student Assistant - Auth Controller
 * Handles Google Sign-In, Classroom Authorization, Demo Student Mode, and JWT sessions.
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const {
  isGoogleConfigured,
  getOAuth2Client,
  getAuthUrl
} = require('../config/googleAuth');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '7d'
  });
};

/**
 * @desc Get Google OAuth URL (Sign-In or Classroom)
 * @route GET /api/auth/google/url
 */
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const isConfigured = isGoogleConfigured();
    if (!isConfigured) {
      return res.status(200).json({
        success: true,
        isConfigured: false,
        message: 'Google OAuth credentials not configured in .env yet.'
      });
    }

    const { type } = req.query; // 'login' or 'classroom'
    const includeClassroom = type === 'classroom';
    const state = req.user ? req.user._id.toString() : 'guest';
    const url = getAuthUrl(includeClassroom, state);

    res.status(200).json({
      success: true,
      isConfigured: true,
      url
    });
  } catch (error) {
    console.error('[Google Auth URL Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Google OAuth 2.0 Callback
 * @route GET /api/auth/google/callback
 */
exports.googleCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error || 'Access denied')}`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Retrieve user's Google profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Check if scopes include classroom
    const scopeString = tokens.scope || '';
    const hasClassroom = scopeString.includes('classroom.courses');

    let user;
    if (state && state !== 'guest') {
      // User is already logged in and linking Google Classroom
      user = await User.findById(state);
    }

    if (!user) {
      // Find or create by Google ID or email
      user = await User.findOne({
        $or: [{ googleId: profile.id }, { email: profile.email }]
      });
    }

    if (!user) {
      user = new User({
        name: profile.name || 'Student',
        email: profile.email,
        googleId: profile.id,
        avatar: profile.picture || '',
        role: 'student'
      });
    }

    // Persist credentials
    user.googleId = profile.id;
    if (profile.picture) user.avatar = profile.picture;
    if (!user.name) user.name = profile.name;

    user.googleTokens = {
      access_token: tokens.access_token || user.googleTokens?.access_token,
      refresh_token: tokens.refresh_token || user.googleTokens?.refresh_token,
      scope: tokens.scope || user.googleTokens?.scope,
      token_type: tokens.token_type || user.googleTokens?.token_type,
      expiry_date: tokens.expiry_date || user.googleTokens?.expiry_date
    };

    if (hasClassroom) {
      user.classroomAuthorized = true;
    }

    await user.save();

    const token = generateToken(user._id);
    res.redirect(`/?token=${token}&classroom_connected=${user.classroomAuthorized}`);
  } catch (err) {
    console.error('[Google Callback Error]:', err);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
};

/**
 * @desc Demo Student Login (Zero-config instant testing)
 * @route POST /api/auth/demo-login
 */
exports.demoLogin = async (req, res) => {
  try {
    let student = await User.findOne({ email: 'demo.student@campus.edu' });

    if (!student) {
      student = await User.create({
        name: 'Alex Rivera',
        email: 'demo.student@campus.edu',
        role: 'student',
        classroomAuthorized: true,
        preferences: {
          voiceEnabled: true,
          dailyStudyHours: 3,
          theme: 'lavender'
        }
      });
    }

    const token = generateToken(student._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        avatar: student.avatar,
        role: student.role,
        classroomAuthorized: student.classroomAuthorized,
        preferences: student.preferences,
        isDemo: true
      }
    });
  } catch (error) {
    console.error('[Demo Login Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get Logged-in Profile
 * @route GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        classroomAuthorized: user.hasClassroomAccess ? user.hasClassroomAccess() : user.classroomAuthorized,
        preferences: user.preferences,
        isGoogleConfigured: isGoogleConfigured()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update User Preferences (Voice, Daily study hours, theme)
 * @route PUT /api/auth/preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const user = req.user;
    const { voiceEnabled, preferredVoice, speechRate, dailyStudyHours, theme } = req.body;

    if (!user.preferences) user.preferences = {};
    if (voiceEnabled !== undefined) user.preferences.voiceEnabled = voiceEnabled;
    if (preferredVoice !== undefined) user.preferences.preferredVoice = preferredVoice;
    if (speechRate !== undefined) user.preferences.speechRate = speechRate;
    if (dailyStudyHours !== undefined) user.preferences.dailyStudyHours = dailyStudyHours;
    if (theme !== undefined) user.preferences.theme = theme;

    await user.save();

    res.status(200).json({
      success: true,
      preferences: user.preferences
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Logout
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};
