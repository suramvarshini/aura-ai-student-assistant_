/**
 * AI Student Assistant - Google OAuth 2.0 Configuration
 * Handles OAuth2 client lifecycle, incremental Classroom authorization,
 * Google Drive scopes, and token refreshing.
 */

const { google } = require('googleapis');

const isGoogleConfigured = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientSecret &&
    !clientId.includes('your_google_client_id') &&
    clientId.trim().length > 10
  );
};

const getOAuth2Client = (redirectUri) => {
  const uri = redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    uri
  );
};

// Scopes required for Classroom access & Google Drive attachments
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/drive.file' // Needed to upload homework files and attach them to Classroom submissions
];

// Basic Sign-In Scopes
const LOGIN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Generate Google Consent URL
 * @param {boolean} includeClassroom Whether to request Classroom & Drive scopes
 * @param {string} state CSRF / Session state
 */
const getAuthUrl = (includeClassroom = false, state = '') => {
  const oauth2Client = getOAuth2Client();
  const scopes = includeClassroom
    ? [...LOGIN_SCOPES, ...CLASSROOM_SCOPES]
    : LOGIN_SCOPES;

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state
  });
};

/**
 * Build authenticated Google client for an existing user
 * Automatically refreshes tokens if near expiration
 */
const getAuthenticatedClient = async (user) => {
  const oauth2Client = getOAuth2Client();

  if (!user.googleTokens || !user.googleTokens.access_token) {
    throw new Error('User has not linked a Google account.');
  }

  oauth2Client.setCredentials({
    access_token: user.googleTokens.access_token,
    refresh_token: user.googleTokens.refresh_token,
    token_type: user.googleTokens.token_type,
    expiry_date: user.googleTokens.expiry_date
  });

  // Listen for refresh events to persist renewed tokens
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      user.googleTokens.access_token = tokens.access_token;
    }
    if (tokens.refresh_token) {
      user.googleTokens.refresh_token = tokens.refresh_token;
    }
    if (tokens.expiry_date) {
      user.googleTokens.expiry_date = tokens.expiry_date;
    }
    await user.save();
  });

  return oauth2Client;
};

module.exports = {
  isGoogleConfigured,
  getOAuth2Client,
  getAuthUrl,
  getAuthenticatedClient,
  LOGIN_SCOPES,
  CLASSROOM_SCOPES
};
