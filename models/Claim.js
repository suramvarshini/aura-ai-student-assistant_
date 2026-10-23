/**
 * Campus Lost and Found System - Claim Model
 * Mongoose schema for item verification claim requests.
 */

const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Associated Item ID is required']
    },
    claimantName: {
      type: String,
      required: [true, 'Claimant name is required'],
      trim: true
    },
    claimantEmail: {
      type: String,
      required: [true, 'Claimant email is required'],
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    claimantPhone: {
      type: String,
      required: [true, 'Claimant phone number is required'],
      trim: true
    },
    proofDescription: {
      type: String,
      required: [true, 'Detailed proof of ownership is required'],
      maxlength: [1500, 'Proof description cannot exceed 1500 characters']
    },
    proofImage: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    adminNotes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Claim', claimSchema);
