/**
 * AI Student Assistant - Auth Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Google OAuth URL & Callback
router.get('/google/url', authController.getGoogleAuthUrl);
router.get('/google/callback', authController.googleCallback);

// Demo 1-Click Login for immediate preview
router.post('/demo-login', authController.demoLogin);

// Current User Profile & Preferences
router.get('/me', protect, authController.getMe);
router.put('/preferences', protect, authController.updatePreferences);
router.post('/logout', authController.logout);

module.exports = router;
