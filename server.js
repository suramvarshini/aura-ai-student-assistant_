/**
 * AI Student Assistant - Server Entry Point
 * High-performance Express server integrating Google Classroom, Gemini AI,
 * Model Context Protocol (MCP), and Voice Assistant APIs.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const classroomRoutes = require('./routes/classroomRoutes');
const aiRoutes = require('./routes/aiRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const mcpRoutes = require('./routes/mcpRoutes');
const automationRoutes = require('./routes/automationRoutes');
const { isGoogleConfigured } = require('./config/googleAuth');
const { isGeminiConfigured } = require('./services/geminiService');
const { initScheduler } = require('./services/automationService');

// Legacy routes preserved for backwards compatibility
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static frontend files and uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Core API Routes
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/automation', automationRoutes);

// Backwards-compatible routes
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);

// Health & System Status Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'AI Student Assistant API',
    mcpServer: 'online',
    backgroundScheduler: 'active',
    timezone: process.env.TIMEZONE || 'Asia/Kolkata',
    googleClassroom: isGoogleConfigured() ? 'live_configured' : 'demo_ready',
    geminiAI: isGeminiConfigured() ? 'live_configured' : 'demo_ready',
    timestamp: new Date().toISOString()
  });
});

// Fallback for HTML page routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API Route Not Found' });
  }
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log('[Server] Initializing AI Student Assistant System...');
  await connectDB();
  initScheduler();

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` 🎓 AI Student Assistant Server running!`);
    console.log(` 🌐 Web App:         http://localhost:${PORT}`);
    console.log(` ⚡ Health Status:   http://localhost:${PORT}/api/health`);
    console.log(` 🤖 MCP SSE Stream:  http://localhost:${PORT}/api/mcp/sse`);
    console.log(`====================================================`);
  });
};

startServer();
