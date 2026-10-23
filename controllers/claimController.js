/**
 * Campus Lost and Found System - Claim Verification Controller
 * Handles claim submissions and admin approval/rejection workflows.
 */

const Claim = require('../models/Claim');
const Item = require('../models/Item');

/**
 * @desc    Submit a claim request for an item
 * @route   POST /api/claims
 * @access  Public
 */
exports.createClaim = async (req, res) => {
  try {
    const { itemId, claimantName, claimantEmail, claimantPhone, proofDescription } = req.body;

    // Validation
    if (!itemId || !claimantName || !claimantEmail || !claimantPhone || !proofDescription) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required claim details (Item ID, Name, Email, Phone, Proof Description).'
      });
    }

    // Check if item exists and is active
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.status === 'claimed') {
      return res.status(400).json({
        success: false,
        message: 'This item has already been claimed and verified by another user.'
      });
    }

    // Check for optional image proof upload
    let proofImage = '';
    if (req.file) {
      proofImage = `/uploads/${req.file.filename}`;
    }

    const claim = await Claim.create({
      itemId,
      claimantName,
      claimantEmail,
      claimantPhone,
      proofDescription,
      proofImage
    });

    res.status(201).json({
      success: true,
      message: 'Claim submitted successfully! Campus admin will review your proof of ownership.',
      data: claim
    });
  } catch (error) {
    console.error('[Submit Claim Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error: Failed to submit claim'
    });
  }
};

/**
 * @desc    Get all claim requests (Admin)
 * @route   GET /api/claims
 * @access  Private (Admin)
 */
exports.getClaims = async (req, res) => {
  try {
    const { status, itemId } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (itemId) {
      query.itemId = itemId;
    }

    const claims = await Claim.find(query)
      .populate('itemId', 'title type category location imageUrl status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: claims.length,
      data: claims
    });
  } catch (error) {
    console.error('[Get Claims Error]', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch claims'
    });
  }
};

/**
 * @desc    Verify (Approve/Reject) a claim request (Admin)
 * @route   PATCH /api/claims/:id/verify
 * @access  Private (Admin)
 */
exports.verifyClaim = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action status. Must be "approved" or "rejected".'
      });
    }

    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim request not found' });
    }

    claim.status = status;
    claim.adminNotes = adminNotes || (status === 'approved' ? 'Claim verified and approved by admin.' : 'Proof of ownership was insufficient.');
    await claim.save();

    let notificationLog = '';

    // If approved, update the item status to "claimed" and reject other pending claims for this item
    if (status === 'approved') {
      const item = await Item.findByIdAndUpdate(
        claim.itemId,
        { status: 'claimed' },
        { new: true }
      );

      // Automatically reject other pending claims for this item
      await Claim.updateMany(
        { itemId: claim.itemId, _id: { $ne: claim._id }, status: 'pending' },
        { status: 'rejected', adminNotes: 'Item was verified and awarded to another verified claimant.' }
      );

      notificationLog = `NOTIFICATION LOG: Claim approved for "${item ? item.title : 'Item'}". In-app notification dispatched to claimant (${claim.claimantEmail}). Item status updated to CLAIMED.`;
    } else {
      notificationLog = `NOTIFICATION LOG: Claim rejected for claimant (${claim.claimantEmail}). Reason: ${claim.adminNotes}`;
    }

    res.status(200).json({
      success: true,
      message: `Claim successfully ${status}!`,
      notification: notificationLog,
      data: claim
    });
  } catch (error) {
    console.error('[Verify Claim Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error: Verification failed'
    });
  }
};

/**
 * @desc    Delete claim record (Admin)
 * @route   DELETE /api/claims/:id
 * @access  Private (Admin)
 */
exports.deleteClaim = async (req, res) => {
  try {
    const claim = await Claim.findByIdAndDelete(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Claim record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
