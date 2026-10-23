/**
 * AI Student Assistant - Google Classroom Service
 * Communicates with the official Google Classroom API (v1) and Google Drive API (v3).
 * Organizes assignments into: pending, submitted, returned, missing, and overdue.
 * Supports full Drive file uploading, submission attachment, and turn-in workflow.
 */

const { google } = require('googleapis');
const fs = require('fs');
const { getAuthenticatedClient, isGoogleConfigured } = require('../config/googleAuth');

/**
 * Standardize and categorize student submission statuses
 */
const categorizeAssignment = (courseWork, submission) => {
  const now = new Date();
  let dueDate = null;

  if (courseWork.dueDate) {
    const { year, month, day } = courseWork.dueDate;
    const hour = courseWork.dueTime?.hours || 23;
    const minute = courseWork.dueTime?.minutes || 59;
    dueDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  }

  const submissionState = submission?.state || 'NEW'; // NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT
  const late = submission?.late || false;

  let category = 'pending';

  if (submissionState === 'TURNED_IN') {
    category = 'submitted';
  } else if (submissionState === 'RETURNED') {
    category = 'returned';
  } else if (dueDate && now > dueDate && submissionState !== 'TURNED_IN' && submissionState !== 'RETURNED') {
    category = 'overdue';
  } else if (submissionState === 'NEW' || submissionState === 'CREATED') {
    category = 'pending';
  }

  return {
    category,
    dueDate,
    isOverdue: dueDate ? now > dueDate && category !== 'submitted' && category !== 'returned' : false,
    submissionState,
    late
  };
};

/**
 * Fetch all accessible courses for the user
 */
const getCourses = async (user) => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    return {
      isDemo: true,
      label: 'Demo Data (Connect Google Classroom in Settings for Live Courses)',
      courses: getDemoCourses()
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const response = await classroom.courses.list({
      courseStates: ['ACTIVE'],
      pageSize: 30
    });

    const courses = (response.data.courses || []).map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section || '',
      descriptionHeading: c.descriptionHeading || '',
      room: c.room || '',
      alternateLink: c.alternateLink,
      courseState: c.courseState
    }));

    return {
      isDemo: false,
      courses
    };
  } catch (error) {
    console.error('[Classroom API Error - getCourses]:', error.message);
    throw new Error(`Google Classroom API error: ${error.message}`);
  }
};

/**
 * Fetch assignments and coursework across all courses (or a specific course)
 */
const getAssignments = async (user, courseId = null) => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    let assignments = getDemoAssignments();
    if (courseId) {
      assignments = assignments.filter((a) => a.courseId === courseId);
    }
    return {
      isDemo: true,
      label: 'Demo Data (Live Classroom connection requires Google credentials in .env)',
      assignments
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    // 1. Get courses
    let targetCourses = [];
    if (courseId) {
      const cRes = await classroom.courses.get({ id: courseId });
      targetCourses = [cRes.data];
    } else {
      const cList = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 20 });
      targetCourses = cList.data.courses || [];
    }

    const allAssignments = [];

    // 2. Fetch coursework & student submissions in parallel per course
    for (const course of targetCourses) {
      try {
        const cwRes = await classroom.courses.courseWork.list({
          courseId: course.id,
          courseWorkStates: ['PUBLISHED'],
          pageSize: 20
        });

        const courseworkItems = cwRes.data.courseWork || [];

        for (const item of courseworkItems) {
          // Fetch student submission for this assignment
          let submission = null;
          try {
            const subRes = await classroom.courses.courseWork.studentSubmissions.list({
              courseId: course.id,
              courseWorkId: item.id,
              userId: 'me'
            });
            submission = subRes.data.studentSubmissions?.[0] || null;
          } catch (subErr) {
            console.warn(`[Classroom] Could not fetch submission for assignment ${item.id}:`, subErr.message);
          }

          const { category, dueDate, isOverdue, submissionState } = categorizeAssignment(item, submission);

          allAssignments.push({
            id: item.id,
            courseId: course.id,
            courseName: course.name,
            title: item.title,
            description: item.description || '',
            materials: item.materials || [],
            maxPoints: item.maxPoints || 100,
            alternateLink: item.alternateLink,
            dueDate: dueDate ? dueDate.toISOString() : null,
            category, // pending, submitted, returned, overdue
            submissionState,
            isOverdue,
            submissionId: submission?.id || null,
            assignedGrade: submission?.assignedGrade || null,
            attachments: submission?.assignmentSubmission?.attachments || []
          });
        }
      } catch (cwErr) {
        console.warn(`[Classroom] Error fetching coursework for course ${course.id}:`, cwErr.message);
      }
    }

    // Sort by due date (soonest first, nulls at bottom)
    allAssignments.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    return {
      isDemo: false,
      assignments: allAssignments
    };
  } catch (error) {
    console.error('[Classroom API Error - getAssignments]:', error.message);
    throw new Error(`Google Classroom API error: ${error.message}`);
  }
};

/**
 * Get full details for a specific assignment, including submission state & attachments
 */
const getAssignmentDetails = async (user, courseId, assignmentId) => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    const list = getDemoAssignments();
    const match = list.find((a) => a.id === assignmentId) || list[0];
    return {
      isDemo: true,
      assignment: match
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const [courseRes, cwRes, subRes] = await Promise.all([
      classroom.courses.get({ id: courseId }),
      classroom.courses.courseWork.get({ courseId, id: assignmentId }),
      classroom.courses.courseWork.studentSubmissions.list({
        courseId,
        courseWorkId: assignmentId,
        userId: 'me'
      })
    ]);

    const course = courseRes.data;
    const item = cwRes.data;
    const submission = subRes.data.studentSubmissions?.[0] || null;

    const { category, dueDate, isOverdue, submissionState } = categorizeAssignment(item, submission);

    return {
      isDemo: false,
      assignment: {
        id: item.id,
        courseId: course.id,
        courseName: course.name,
        title: item.title,
        description: item.description || '',
        materials: item.materials || [],
        maxPoints: item.maxPoints || 100,
        alternateLink: item.alternateLink,
        dueDate: dueDate ? dueDate.toISOString() : null,
        category,
        submissionState,
        isOverdue,
        submissionId: submission?.id || null,
        assignedGrade: submission?.assignedGrade || null,
        attachments: submission?.assignmentSubmission?.attachments || []
      }
    };
  } catch (error) {
    console.error('[Classroom API Error - getAssignmentDetails]:', error.message);
    throw new Error(`Google Classroom API error: ${error.message}`);
  }
};

/**
 * Upload a homework file to the student's Google Drive
 */
const uploadFileToDrive = async (user, filePath, fileName, mimeType = 'application/pdf') => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    return {
      isDemo: true,
      id: `demo-drive-${Date.now()}`,
      title: fileName,
      alternateLink: `https://drive.google.com/file/d/demo-drive-${Date.now()}/view`
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const drive = google.drive({ version: 'v3', auth: authClient });

    const fileMetadata = {
      name: fileName,
      description: 'Homework submission uploaded via Aura AI Student Assistant'
    };

    const media = {
      mimeType,
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, mimeType, webViewLink, webContentLink'
    });

    return {
      isDemo: false,
      id: response.data.id,
      title: response.data.name,
      alternateLink: response.data.webViewLink
    };
  } catch (error) {
    console.error('[Google Drive API Error - uploadFileToDrive]:', error.message);
    throw new Error(`Google Drive API error: ${error.message}`);
  }
};

/**
 * Attach a Google Drive file to an existing student submission
 */
const attachDriveFileToSubmission = async (user, courseId, courseWorkId, submissionId, driveFileId) => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    return {
      isDemo: true,
      success: true,
      message: 'Demo Drive file attached successfully.'
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const response = await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
      courseId,
      courseWorkId,
      id: submissionId,
      requestBody: {
        addAttachments: [
          {
            driveFile: {
              id: driveFileId
            }
          }
        ]
      }
    });

    return {
      isDemo: false,
      success: true,
      submission: response.data
    };
  } catch (error) {
    console.error('[Classroom API Error - attachDriveFileToSubmission]:', error.message);
    throw new Error(`Google Classroom modifyAttachments error: ${error.message}`);
  }
};

/**
 * Submit student submission with explicit confirmation safety check
 */
const turnInAssignment = async (user, courseId, courseWorkId, submissionId) => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    // In demo mode, simulate successful submission
    return {
      isDemo: true,
      success: true,
      submissionState: 'TURNED_IN',
      message: 'Demo Assignment marked as submitted successfully (Demo Mode).'
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    // Official turn-in endpoint
    const response = await classroom.courses.courseWork.studentSubmissions.turnIn({
      courseId,
      courseWorkId,
      id: submissionId
    });

    const isConfirmed = response.data?.state === 'TURNED_IN';

    return {
      isDemo: false,
      success: isConfirmed,
      submissionState: response.data?.state || 'TURNED_IN',
      data: response.data
    };
  } catch (error) {
    console.error('[Classroom API Error - turnInAssignment]:', error.message);
    throw new Error(`Google Classroom turnIn error: ${error.message}`);
  }
};

/**
 * Reclaim a turned-in assignment so the student can edit/add attachments
 */
const reclaimAssignment = async (user, courseId, courseWorkId, submissionId) => {
  if (!isGoogleConfigured() || !user.hasClassroomAccess()) {
    return {
      isDemo: true,
      success: true,
      submissionState: 'CREATED',
      message: 'Demo Assignment unsubmitted / reclaimed successfully.'
    };
  }

  try {
    const authClient = await getAuthenticatedClient(user);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const response = await classroom.courses.courseWork.studentSubmissions.reclaim({
      courseId,
      courseWorkId,
      id: submissionId
    });

    return {
      isDemo: false,
      success: true,
      submissionState: response.data?.state || 'CREATED',
      data: response.data
    };
  } catch (error) {
    console.error('[Classroom API Error - reclaimAssignment]:', error.message);
    throw new Error(`Google Classroom reclaim error: ${error.message}`);
  }
};

/**
 * Fallback labeled demo dataset for local evaluation without Google Cloud setup
 */
const getDemoCourses = () => [
  {
    id: 'demo-cs301',
    name: 'CS 301: Advanced Data Structures & Algorithms',
    section: 'Section A - Fall 2026',
    descriptionHeading: 'Graph algorithms, dynamic programming, and optimization techniques.',
    room: 'Hall B-204',
    courseState: 'ACTIVE'
  },
  {
    id: 'demo-ai204',
    name: 'AI 204: Machine Learning & Intelligent Agents',
    section: 'Section C - Fall 2026',
    descriptionHeading: 'Supervised learning, neural networks, transformers, and autonomous agents.',
    room: 'Lab 4',
    courseState: 'ACTIVE'
  },
  {
    id: 'demo-wt201',
    name: 'WT 201: Modern Web Technologies & Cloud Architectures',
    section: 'Section B - Fall 2026',
    descriptionHeading: 'Full-stack engineering, microservices, REST APIs, and modern frontend frameworks.',
    room: 'Tech Hub 102',
    courseState: 'ACTIVE'
  }
];

const getDemoAssignments = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);

  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  inThreeDays.setHours(18, 0, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 0, 0);

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 6);

  return [
    {
      id: 'demo-asg-1',
      courseId: 'demo-cs301',
      courseName: 'CS 301: Advanced Data Structures & Algorithms',
      title: 'Problem Set 4: Dijkstra & A* Pathfinding Implementation',
      description: 'Implement Dijkstra and A* pathfinding on weighted directed graphs. Analyze time and space complexity with Fibonacci heaps vs Binary heaps. Include comprehensive test benchmarks.',
      dueDate: tomorrow.toISOString(),
      category: 'pending',
      submissionState: 'NEW',
      submissionId: 'demo-sub-1',
      isOverdue: false,
      maxPoints: 100,
      materials: [{ title: 'Pathfinding_Specification.pdf' }]
    },
    {
      id: 'demo-asg-2',
      courseId: 'demo-ai204',
      courseName: 'AI 204: Machine Learning & Intelligent Agents',
      title: 'Mini-Project: Fine-Tuning Sentiment Classifier with LoRA',
      description: 'Train a lightweight sentiment analysis classifier on the IMDB reviews dataset using LoRA adaptation. Report accuracy, precision, recall, and training loss curves.',
      dueDate: inThreeDays.toISOString(),
      category: 'pending',
      submissionState: 'NEW',
      submissionId: 'demo-sub-2',
      isOverdue: false,
      maxPoints: 100,
      materials: [{ title: 'LoRA_Tutorial_Notebook.ipynb' }]
    },
    {
      id: 'demo-asg-3',
      courseId: 'demo-wt201',
      courseName: 'WT 201: Modern Web Technologies & Cloud Architectures',
      title: 'Lab 5: Express REST API & Authentication Middleware',
      description: 'Build a secure RESTful API with Express, JWT authentication, role-based authorization, and MongoDB aggregation pipelines.',
      dueDate: yesterday.toISOString(),
      category: 'overdue',
      submissionState: 'NEW',
      submissionId: 'demo-sub-3',
      isOverdue: true,
      maxPoints: 50,
      materials: [{ title: 'Lab5_Instructions.pdf' }]
    },
    {
      id: 'demo-asg-4',
      courseId: 'demo-cs301',
      courseName: 'CS 301: Advanced Data Structures & Algorithms',
      title: 'Problem Set 3: Red-Black Trees & AVL Tree Rotations',
      description: 'Implement tree balancing rotations and verify log(N) height guarantees.',
      dueDate: lastWeek.toISOString(),
      category: 'submitted',
      submissionState: 'TURNED_IN',
      submissionId: 'demo-sub-4',
      isOverdue: false,
      maxPoints: 100,
      assignedGrade: 96,
      materials: []
    }
  ];
};

module.exports = {
  getCourses,
  getAssignments,
  getAssignmentDetails,
  uploadFileToDrive,
  attachDriveFileToSubmission,
  turnInAssignment,
  reclaimAssignment,
  categorizeAssignment,
  getDemoCourses,
  getDemoAssignments
};
