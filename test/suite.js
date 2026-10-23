/**
 * AI Student Assistant - Comprehensive Automated Integration Test Suite
 * Tests Auth, Classroom API, Gemini AI, MCP Tools, and Submission Safety.
 */

const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

let authToken = '';

const request = (path, method = 'GET', data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (authToken && !options.headers['Authorization']) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('========================================================');
  console.log('🧪 Starting AI Student Assistant Automated Test Suite');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  try {
    // Test 1: Server Health Check
    console.log('[1/8] Verifying Server Health & Endpoints...');
    const health = await request('/api/health');
    assert(health.status === 200, 'Health endpoint returns 200 OK');
    assert(health.data?.system === 'AI Student Assistant API', 'System identity verified');
    assert(health.data?.mcpServer === 'online', 'MCP server is online');

    // Test 2: Authentication & Demo Student Login
    console.log('\n[2/8] Testing Authentication & Session Management...');
    const login = await request('/api/auth/demo-login', 'POST');
    assert(login.status === 200, 'Demo login returns 200 OK');
    assert(login.data?.token, 'JWT token returned successfully');
    authToken = login.data?.token;

    const me = await request('/api/auth/me');
    assert(me.status === 200, 'Protected profile /api/auth/me returns 200 OK');
    assert(me.data?.user?.email === 'demo.student@campus.edu', 'Authenticated user identity matches');

    // Test 3: Google Classroom Service & Categorization
    console.log('\n[3/8] Testing Google Classroom Service...');
    const courses = await request('/api/classroom/courses');
    assert(courses.status === 200, 'Courses endpoint returns 200 OK');
    assert(courses.data?.courses?.length > 0, 'Accessible courses retrieved');

    const assignments = await request('/api/classroom/assignments');
    assert(assignments.status === 200, 'Assignments endpoint returns 200 OK');
    assert(assignments.data?.assignments?.length > 0, 'Assignments list populated');
    const hasCategories = assignments.data?.assignments?.some((a) => a.category === 'pending' || a.category === 'overdue');
    assert(hasCategories, 'Assignments correctly categorized into pending/overdue');

    // Test 4: Gemini AI Conversational Assistant
    console.log('\n[4/8] Testing AI Study Assistant (Gemini Engine)...');
    const chat = await request('/api/ai/chat', 'POST', {
      message: 'Explain Dijkstra algorithm simply'
    });
    assert(chat.status === 200, 'AI chat endpoint returns 200 OK');
    assert(chat.data?.reply?.length > 20, 'Student-friendly explanation returned');

    // Test 5: Note Summarization & Flashcards
    console.log('\n[5/8] Testing Study Notes Summarizer & Practice Questions...');
    const summary = await request('/api/ai/summarize', 'POST', {
      content: 'Binary Search Trees (BST) maintain the invariant that left children are smaller and right children are larger. Search runs in O(h) time.',
      filename: 'BST_Lecture.txt'
    });
    assert(summary.status === 200, 'Note summarizer returns 200 OK');
    assert(summary.data?.data?.summary, 'Structured document summary generated');

    const practice = await request('/api/ai/practice', 'POST', {
      topic: 'Binary Search Trees'
    });
    assert(practice.status === 200, 'Practice questions endpoint returns 200 OK');
    assert(practice.data?.disclaimer?.includes('not official examination questions'), 'Practice examination disclaimer present');

    // Test 6: Smart Study Planner
    console.log('\n[6/8] Testing Smart Study Planner...');
    const plan = await request('/api/ai/study-plan/generate', 'POST', { dailyStudyHours: 3 });
    assert(plan.status === 200, 'Smart study plan generated successfully');
    assert(plan.data?.plan?.tasks?.length > 0, 'Prioritized study tasks scheduled');

    const taskId = plan.data?.plan?.tasks[0]?._id;
    if (taskId) {
      const toggle = await request(`/api/ai/study-plan/task/${taskId}/toggle`, 'PUT');
      assert(toggle.status === 200 && toggle.data?.task?.isCompleted === true, 'Task completion toggled successfully');
    }

    // Test 7: Model Context Protocol (MCP) Server & Tools
    console.log('\n[7/8] Testing MCP Server & Isolated Tool Execution...');
    const mcpTools = await request('/api/mcp/tools');
    assert(mcpTools.status === 200, 'MCP tools endpoint returns 200 OK');
    assert(mcpTools.data?.tools?.length >= 8, 'All core MCP tools registered');

    const mcpExec = await request('/api/mcp/execute', 'POST', {
      toolName: 'get_my_courses',
      args: {}
    });
    assert(mcpExec.status === 200 && mcpExec.data?.success, 'MCP tool "get_my_courses" executed cleanly');

    // Test 8: Assignment Submission Safety Enforcement
    console.log('\n[8/10] Testing Assignment Submission Safety Verification...');
    const unsafeSubmit = await request('/api/classroom/submit', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      submissionId: 'sub-1',
      confirmedByUser: false // deliberately missing confirmation
    });
    assert(unsafeSubmit.status === 400, 'Unconfirmed submission safely REJECTED with 400');

    const safeSubmit = await request('/api/classroom/submit', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      submissionId: 'sub-1',
      confirmedByUser: true // explicit confirmation
    });
    assert(safeSubmit.status === 200, 'Confirmed submission successfully processed');

    // Test 9: AI Homework Assistant (Explainer, Generator, and PDF Export)
    console.log('\n[9/10] Testing AI Homework Assistant & Document Synthesis...');
    const singleAsg = await request('/api/classroom/assignment/demo-cs301/demo-asg-1');
    assert(singleAsg.status === 200, 'Single assignment details retrieved successfully');
    assert(singleAsg.data?.assignment?.id === 'demo-asg-1', 'Assignment metadata matches');

    const explainer = await request('/api/classroom/ai-helper/explain', 'POST', {
      title: singleAsg.data.assignment.title,
      description: singleAsg.data.assignment.description,
      courseName: singleAsg.data.assignment.courseName
    });
    assert(explainer.status === 200, 'Homework explainer returned 200 OK');
    assert(explainer.data?.explanation?.length > 30, 'Student-friendly question breakdown generated');

    const solutionDraft = await request('/api/classroom/ai-helper/generate-draft', 'POST', {
      title: singleAsg.data.assignment.title,
      description: singleAsg.data.assignment.description,
      courseName: singleAsg.data.assignment.courseName,
      solutionType: 'report'
    });
    assert(solutionDraft.status === 200, 'Homework draft solution returned 200 OK');
    assert(solutionDraft.data?.draftContent?.length > 50, 'Academic report solution generated');

    const pdfExport = await request('/api/classroom/ai-helper/export-pdf', 'POST', {
      title: singleAsg.data.assignment.title,
      courseName: singleAsg.data.assignment.courseName,
      content: solutionDraft.data.draftContent
    });
    assert(pdfExport.status === 200, 'PDF document export returned 200 OK');
    assert(pdfExport.data?.downloadUrl && pdfExport.data?.filePath, 'Downloadable PDF file generated');

    // Test 10: Complete Direct Classroom Submission Workflow & Reclaim
    console.log('\n[10/10] Testing Direct Classroom Submission & Reclaim Workflow...');
    const directUnsafe = await request('/api/classroom/submit-direct', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      localFilePath: pdfExport.data.filePath,
      confirmedByUser: false // missing confirmation
    });
    assert(directUnsafe.status === 400, 'Direct turn-in rejected without explicit confirmation');

    const directSubmit = await request('/api/classroom/submit-direct', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      localFilePath: pdfExport.data.filePath,
      fileName: pdfExport.data.filename,
      mimeType: 'application/pdf',
      confirmedByUser: true
    });
    assert(directSubmit.status === 200, 'Direct turn-in with Drive file attachment succeeded');
    assert(directSubmit.data?.submissionState === 'TURNED_IN', 'Submission state verified as TURNED_IN');

    const reclaim = await request('/api/classroom/reclaim', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      submissionId: 'demo-sub-1'
    });
    assert(reclaim.status === 200, 'Unsubmit / reclaim endpoint returned 200 OK');
    assert(reclaim.data?.submissionState === 'CREATED', 'Assignment state reset to CREATED');

    // Test 11: Hands-Free Wake-Word "Hey Aura" Engine & Phonetic Extraction
    console.log('\n[11/11] Testing Hands-Free Wake-Word "Hey Aura" Extraction & Safety Rules...');
    const WAKE_WORD_REGEX = /\b(hey|hi|ok|ay|yo)\s+(aura|laura|ora|aurora)\b/i;

    // Subtest A: Wake phrase detection with command
    const samplePhrase1 = "Hey Aura, what assignments are due tomorrow?";
    const matched1 = WAKE_WORD_REGEX.test(samplePhrase1);
    const extractedCmd1 = samplePhrase1.replace(WAKE_WORD_REGEX, '').replace(/^[,.\s]+/, '').trim();
    assert(matched1 === true, 'Detected "Hey Aura" in full spoken sentence');
    assert(extractedCmd1 === 'what assignments are due tomorrow?', 'Extracted clean following command');

    // Subtest B: Phonetic variants matching
    assert(WAKE_WORD_REGEX.test("Hi aura explain dynamic programming"), 'Matches phonetic variant "Hi aura"');
    assert(WAKE_WORD_REGEX.test("Ok Aura create a study plan"), 'Matches phonetic variant "Ok Aura"');
    assert(WAKE_WORD_REGEX.test("Hey Laura repeat the last explanation"), 'Matches common speech-to-text mishearing "Hey Laura"');

    // Subtest C: False positive avoidance
    assert(WAKE_WORD_REGEX.test("This is an ordinary sentence about auroras and stars") === false, 'Ignores words like "auroras" without wake prefix');
    assert(WAKE_WORD_REGEX.test("Hey everyone let us study together") === false, 'Ignores "Hey everyone" without Aura');

    // Subtest D: Wake word only requires follow-up
    const sampleWakeOnly = "Hey Aura";
    const extractedOnly = sampleWakeOnly.replace(WAKE_WORD_REGEX, '').replace(/^[,.\s]+/, '').trim();
    assert(extractedOnly.length === 0, 'Wake-word only correctly detected as needing follow-up command');

    // Subtest E: Verify backend AI responds to extracted wake-word command
    const wakeAiRes = await request('/api/ai/chat', 'POST', {
      message: extractedCmd1
    });
    assert(wakeAiRes.status === 200, 'Backend AI responds to extracted wake-word command');
    assert(wakeAiRes.data?.reply?.length > 10, 'Assistant generated response ready for spoken TTS');

    console.log('\n========================================================');
    console.log(`🏁 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err.message);
    process.exit(1);
  }
};

// Check if server is reachable; if not, exit gracefully
request('/api/health')
  .then(() => runTests())
  .catch((err) => {
    console.error(`Cannot connect to server at ${BASE_URL}. Ensure the server is running ('npm start').`);
    process.exit(1);
  });
