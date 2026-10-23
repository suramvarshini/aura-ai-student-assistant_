/**
 * AI Student Assistant - Model Context Protocol (MCP) Server
 * Built with @modelcontextprotocol/sdk.
 * Exposes Classroom, Study Assistant, and Planner tools with user isolation and safety checks.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const AssignmentDraft = require('../models/AssignmentDraft');
const StudyPlan = require('../models/StudyPlan');
const classroomService = require('../services/classroomService');
const geminiService = require('../services/geminiService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_ai_assistant_jwt_secure_key_98234710928374';

/**
 * Tool Definitions Schema
 */
const TOOLS = [
  {
    name: 'get_my_courses',
    description: 'Fetch the active Google Classroom courses accessible to the authenticated student.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_assignments',
    description: 'Fetch student coursework and assignments organized into pending, submitted, overdue, and returned categories.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'string',
          description: 'Optional Google Classroom course ID to filter coursework for a single class.'
        },
        category: {
          type: 'string',
          enum: ['all', 'pending', 'submitted', 'overdue', 'returned'],
          description: 'Filter assignments by status.'
        }
      }
    }
  },
  {
    name: 'get_assignment_details',
    description: 'Fetch full instructions, description, materials, and due date for a specific assignment.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'Course ID' },
        assignmentId: { type: 'string', description: 'Assignment / CourseWork ID' }
      },
      required: ['courseId', 'assignmentId']
    }
  },
  {
    name: 'get_submission_status',
    description: 'Check the current submission status, grade, and turn-in timestamp for an assignment.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'Course ID' },
        assignmentId: { type: 'string', description: 'Assignment ID' }
      },
      required: ['courseId', 'assignmentId']
    }
  },
  {
    name: 'prepare_assignment',
    description: 'SAFETY PROTECTED: Creates or updates an assignment draft. Does NOT submit to Google Classroom. Prepares solution outline, draft text, and attachments for student review.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'Course ID' },
        courseName: { type: 'string', description: 'Course Name' },
        assignmentId: { type: 'string', description: 'Assignment ID' },
        assignmentTitle: { type: 'string', description: 'Assignment Title' },
        draftContent: { type: 'string', description: 'Draft text or outline prepared by student/assistant' },
        attachedFiles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fileName: { type: 'string' },
              fileUrl: { type: 'string' }
            }
          },
          description: 'Files to attach to the draft'
        }
      },
      required: ['courseId', 'assignmentId', 'assignmentTitle']
    }
  },
  {
    name: 'submit_assignment',
    description: 'CONSEQUENTIAL ACTION: Submits an assignment to Google Classroom. Requires explicit user confirmation flag (confirmedByUser = true). Cannot be triggered automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'Google Classroom Course ID' },
        assignmentId: { type: 'string', description: 'CourseWork ID' },
        submissionId: { type: 'string', description: 'Student Submission ID' },
        confirmedByUser: {
          type: 'boolean',
          description: 'Explicit safety flag confirming user has verified the action'
        }
      },
      required: ['courseId', 'assignmentId', 'submissionId', 'confirmedByUser']
    }
  },
  {
    name: 'create_study_plan',
    description: 'Synthesizes an optimized study schedule based on upcoming assignment deadlines and student daily hours.',
    inputSchema: {
      type: 'object',
      properties: {
        dailyStudyHours: { type: 'number', description: 'Student study capacity in hours per day' }
      }
    }
  },
  {
    name: 'summarize_study_material',
    description: 'Analyzes lecture notes or textbook material and extracts summaries, key concepts, formulas, and references.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The text content to analyze' },
        filename: { type: 'string', description: 'Document name' }
      },
      required: ['content']
    }
  },
  {
    name: 'generate_practice_questions',
    description: 'Creates revision flashcards and practice MCQs with explanations on a given topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Subject or topic for practice' },
        sourceText: { type: 'string', description: 'Optional text context for questions' }
      },
      required: ['topic']
    }
  },
  {
    name: 'attach_assignment_file',
    description: 'Links an uploaded study file or document to a pending assignment draft.',
    inputSchema: {
      type: 'object',
      properties: {
        assignmentId: { type: 'string', description: 'Assignment ID' },
        fileName: { type: 'string', description: 'Name of file' },
        fileUrl: { type: 'string', description: 'URL of file' }
      },
      required: ['assignmentId', 'fileName', 'fileUrl']
    }
  }
];

/**
 * Authenticate user from JWT token
 */
const authenticateToken = async (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return await User.findById(decoded.id);
  } catch (err) {
    return null;
  }
};

/**
 * Handle Tool Invocations
 */
const handleToolCall = async (user, name, args) => {
  if (!user) {
    throw new Error('Authentication required to invoke protected MCP tools.');
  }

  switch (name) {
    case 'get_my_courses': {
      const data = await classroomService.getCourses(user);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }

    case 'get_assignments': {
      const data = await classroomService.getAssignments(user, args.courseId);
      let results = data.assignments;
      if (args.category && args.category !== 'all') {
        results = results.filter((a) => a.category === args.category);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { isDemo: data.isDemo, total: results.length, assignments: results },
              null,
              2
            )
          }
        ]
      };
    }

    case 'get_assignment_details': {
      const data = await classroomService.getAssignments(user, args.courseId);
      const match = data.assignments.find((a) => a.id === args.assignmentId);
      if (!match) {
        throw new Error(`Assignment with ID ${args.assignmentId} was not found.`);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(match, null, 2) }]
      };
    }

    case 'get_submission_status': {
      const data = await classroomService.getAssignments(user, args.courseId);
      const match = data.assignments.find((a) => a.id === args.assignmentId);
      if (!match) {
        throw new Error(`Assignment with ID ${args.assignmentId} not found.`);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                assignmentId: match.id,
                title: match.title,
                category: match.category,
                submissionState: match.submissionState,
                isOverdue: match.isOverdue,
                assignedGrade: match.assignedGrade
              },
              null,
              2
            )
          }
        ]
      };
    }

    case 'prepare_assignment': {
      // Store draft safely - NEVER automatically turn in
      const draft = await AssignmentDraft.findOneAndUpdate(
        {
          userId: user._id,
          courseId: args.courseId,
          courseWorkId: args.assignmentId
        },
        {
          courseName: args.courseName || '',
          assignmentTitle: args.assignmentTitle,
          draftContent: args.draftContent || '',
          attachedFiles: args.attachedFiles || [],
          status: 'ready_for_review',
          confirmedByStudent: false
        },
        { upsert: true, new: true }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Assignment draft prepared and saved safely for review. Explicit student confirmation is required before final submission.',
                draftId: draft._id,
                status: draft.status,
                assignmentTitle: draft.assignmentTitle
              },
              null,
              2
            )
          }
        ]
      };
    }

    case 'submit_assignment': {
      // Safety verification requirement
      if (!args.confirmedByUser) {
        throw new Error(
          'SAFETY REJECTION: Assignment submission was requested without explicit student confirmation. Please confirm in the UI before submitting.'
        );
      }

      const result = await classroomService.turnInAssignment(
        user,
        args.courseId,
        args.assignmentId,
        args.submissionId
      );

      // Record confirmation
      await AssignmentDraft.findOneAndUpdate(
        { userId: user._id, courseWorkId: args.assignmentId },
        { status: 'submitted', confirmedByStudent: true, confirmedAt: new Date(), submissionResponse: result }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Assignment submitted successfully to Google Classroom.',
              result
            })
          }
        ]
      };
    }

    case 'create_study_plan': {
      const data = await classroomService.getAssignments(user);
      const planResult = await geminiService.createSmartStudyPlan(data.assignments, {
        dailyStudyHours: args.dailyStudyHours || user.preferences?.dailyStudyHours || 3
      });

      // Save plan to user record
      if (planResult.data && planResult.data.tasks) {
        const formattedTasks = planResult.data.tasks.map((t) => ({
          ...t,
          scheduledDate: new Date(t.scheduledDate || Date.now())
        }));

        await StudyPlan.create({
          userId: user._id,
          title: planResult.data.title || 'Smart Study Plan',
          notes: planResult.data.notes || '',
          tasks: formattedTasks
        });
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(planResult, null, 2) }]
      };
    }

    case 'summarize_study_material': {
      const result = await geminiService.summarizeStudyNotes(args.content, args.filename || 'Notes');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    case 'generate_practice_questions': {
      const result = await geminiService.generatePracticeQuestions(
        args.sourceText || args.topic,
        args.topic
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    case 'attach_assignment_file': {
      const draft = await AssignmentDraft.findOneAndUpdate(
        { userId: user._id, courseWorkId: args.assignmentId },
        {
          $push: {
            attachedFiles: {
              fileName: args.fileName,
              fileUrl: args.fileUrl
            }
          }
        },
        { new: true, upsert: true }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Attached ${args.fileName} to assignment draft.`,
              draftId: draft._id
            })
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown MCP Tool: ${name}`);
  }
};

/**
 * Factory to create an isolated MCP Server instance per connection/user
 */
const createMcpServer = (user) => {
  const server = new Server(
    {
      name: 'ai-student-assistant-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List Tools Handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call Tool Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await handleToolCall(user, name, args || {});
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool execution failed: ${err.message}` }]
      };
    }
  });

  return server;
};

// Active SSE Transports Map
const sseTransports = new Map();

/**
 * Express SSE Route Handler for Remote MCP Clients
 */
const handleSseEndpoint = async (req, res) => {
  // Extract token from query or header
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  const user = await authenticateToken(token);

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized: Valid JWT token required to connect to MCP Server'
    });
  }

  const transport = new SSEServerTransport('/api/mcp/messages', res);
  const server = createMcpServer(user);

  const sessionId = transport.sessionId;
  sseTransports.set(sessionId, { transport, server, user });

  req.on('close', () => {
    sseTransports.delete(sessionId);
  });

  await server.connect(transport);
};

/**
 * Handle incoming messages for SSE transport
 */
const handleMessageEndpoint = async (req, res) => {
  const sessionId = req.query.sessionId;
  const session = sseTransports.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'MCP Session not found' });
  }

  await session.transport.handlePostMessage(req, res);
};

module.exports = {
  TOOLS,
  createMcpServer,
  handleToolCall,
  handleSseEndpoint,
  handleMessageEndpoint,
  authenticateToken
};
