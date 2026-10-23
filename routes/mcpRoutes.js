/**
 * AI Student Assistant - MCP Routes & Endpoints
 * Exposes MCP Server-Sent Events (SSE) remote transport and in-app tool execution.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  TOOLS,
  handleToolCall,
  handleSseEndpoint,
  handleMessageEndpoint
} = require('../mcp/server');

/**
 * @desc Remote MCP SSE Transport Endpoint
 * @route GET /api/mcp/sse
 */
router.get('/sse', handleSseEndpoint);

/**
 * @desc Remote MCP SSE Messages Endpoint
 * @route POST /api/mcp/messages
 */
router.post('/messages', handleMessageEndpoint);

/**
 * @desc Get Available MCP Tools & Schema (In-App MCP Client)
 * @route GET /api/mcp/tools
 */
router.get('/tools', protect, (req, res) => {
  res.status(200).json({
    success: true,
    server: 'ai-student-assistant-mcp',
    version: '1.0.0',
    tools: TOOLS
  });
});

/**
 * @desc Execute an MCP Tool (In-App Auto-Connected Client)
 * @route POST /api/mcp/execute
 */
router.post('/execute', protect, async (req, res) => {
  const { toolName, args } = req.body;

  if (!toolName) {
    return res.status(400).json({ success: false, message: 'Tool name is required' });
  }

  try {
    const result = await handleToolCall(req.user, toolName, args || {});
    res.status(200).json({
      success: true,
      tool: toolName,
      result
    });
  } catch (error) {
    console.error(`[MCP Tool Error - ${toolName}]:`, error.message);
    res.status(500).json({
      success: false,
      tool: toolName,
      error: error.message
    });
  }
});

module.exports = router;
