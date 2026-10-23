/**
 * Campus Lost and Found System - Claim Routes
 * Express routes for item claim requests and verification.
 */

const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');
const upload = require('../middleware/uploadMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

// Public Route: Submit Claim Request
router.post('/', upload.single('proofImage'), claimController.createClaim);

// Admin Protected Routes
router.get('/', protectAdmin, claimController.getClaims);
router.patch('/:id/verify', protectAdmin, claimController.verifyClaim);
router.delete('/:id', protectAdmin, claimController.deleteClaim);

module.exports = router;
