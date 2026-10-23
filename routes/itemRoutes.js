/**
 * Campus Lost and Found System - Item Routes
 * Express routes for lost and found item management.
 */

const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const upload = require('../middleware/uploadMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

// Real-time classification endpoint
router.post('/classify', itemController.classifyText);

// Public Routes
router.route('/')
  .get(itemController.getItems)
  .post(upload.single('image'), itemController.createItem);

router.route('/:id')
  .get(itemController.getItemById)
  .delete(protectAdmin, itemController.deleteItem);

// Admin status update
router.patch('/:id/status', protectAdmin, itemController.updateItemStatus);

module.exports = router;
