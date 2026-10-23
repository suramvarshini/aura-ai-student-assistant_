/**
 * Campus Lost and Found System - Item Model
 * Mongoose schema for lost and found items.
 */

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Item title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    type: {
      type: String,
      required: [true, 'Item type (lost or found) is required'],
      enum: ['lost', 'found']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['electronics', 'documents', 'accessories', 'bags', 'others'],
      default: 'others'
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    date: {
      type: Date,
      required: [true, 'Date lost/found is required'],
      default: Date.now
    },
    contactName: {
      type: String,
      required: [true, 'Reporter contact name is required'],
      trim: true
    },
    contactEmail: {
      type: String,
      required: [true, 'Reporter contact email is required'],
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    contactPhone: {
      type: String,
      trim: true,
      default: ''
    },
    imageUrl: {
      type: String,
      default: '/uploads/default-item.png'
    },
    status: {
      type: String,
      enum: ['active', 'claimed', 'resolved'],
      default: 'active'
    },
    autoTags: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Text index for fast keyword search across title, description, and location
itemSchema.index({ title: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('Item', itemSchema);
