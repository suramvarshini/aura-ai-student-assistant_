/**
 * AI Student Assistant - Comprehensive Senior QA Inspection & Endpoint Audit
 * Executes end-to-end verification of static assets, HTTP routes, security boundaries,
 * multipart file uploads, and edge-case handling.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

let authToken = '';

const request = (endpoint, method = 'GET', data = null, customHeaders = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...customHeaders }
    };

    if (data && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }

    if (authToken && !options.headers['Authorization']) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      if (typeof data === 'string' || Buffer.isBuffer(data)) {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
};

// Multipart Form-Data Request Helper
const uploadMultipart = (endpoint, fieldName, filename, fileBuffer, mimeType) => {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(endpoint, BASE_URL);

    let header = `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`;
    header += `Content-Type: ${mimeType}\r\n\r\n`;

    const footer = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      fileBuffer,
      Buffer.from(footer, 'utf-8')
    ]);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        Authorization: `Bearer ${authToken}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
};

const runQAAudit = async () => {
  console.log('================================================================');
  console.log('🔍 SENIOR QA AUDIT: Local System Health, Security & Feature Verification');
  console.log(`📍 Testing Target: ${BASE_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const auditLog = [];

  const check = (condition, title, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
      auditLog.push({ title, status: 'PASS', details });
    } else {
      console.error(`  ❌ [FAIL] ${title} - ${details}`);
      failed++;
      auditLog.push({ title, status: 'FAIL', details });
    }
  };

  try {
    // -------------------------------------------------------------
    // SECTION 1: Frontend & Static Asset Integrity Check
    // -------------------------------------------------------------
    console.log('[SECTION 1] Checking Frontend & Static Assets Delivery...');
    
    const indexRes = await request('/');
    check(indexRes.status === 200, 'Frontend root URL (/) loads with 200 OK');
    check(indexRes.headers['content-type']?.includes('text/html'), 'Content-Type is text/html');
    check(indexRes.raw?.includes('Aura'), 'HTML contains application brand "Aura"');
    check(indexRes.raw?.includes('id="homework-studio-modal"'), 'AI Homework Studio modal is present in DOM');
    check(indexRes.raw?.includes('id="handsfree-mode-toggle"'), '"Hey Aura" hands-free toggle is present in DOM');

    const cssRes = await request('/css/student-theme.css');
    check(cssRes.status === 200, 'Stylesheet /css/student-theme.css delivers 200 OK');
    check(cssRes.raw?.includes('--lavender-500'), 'CSS variables (pastel lavender theme) properly defined');

    const jsRes = await request('/js/app.js');
    check(jsRes.status === 200, 'Client script /js/app.js delivers 200 OK');
    check(jsRes.raw?.includes('WAKE_WORD_REGEX'), 'Client script contains "Hey Aura" wake-word detection engine');

    // -------------------------------------------------------------
    // SECTION 2: Server Health & Environment Check
    // -------------------------------------------------------------
    console.log('\n[SECTION 2] Verifying Server Health, Database & Environment...');
    const health = await request('/api/health');
    check(health.status === 200, 'Health endpoint /api/health returns 200 OK');
    check(health.data?.status === 'online', 'Server reports system status: online');
    check(health.data?.mcpServer === 'online', 'MCP server reports online');
    check(health.data?.googleClassroom === 'demo_ready', 'Google Classroom reports demo_ready (safe mock fallback)');
    check(health.data?.geminiAI === 'demo_ready', 'Gemini AI reports demo_ready (safe local assistant fallback)');

    // -------------------------------------------------------------
    // SECTION 3: Security & Unauthenticated Access Enforcement
    // -------------------------------------------------------------
    console.log('\n[SECTION 3] Testing Security Boundaries (401 Unauthorized)...');
    
    // Test requests without token
    const unauthProfile = await request('/api/auth/me');
    check(unauthProfile.status === 401, 'Unauthenticated /api/auth/me rejected with 401');

    const unauthCourses = await request('/api/classroom/courses');
    check(unauthCourses.status === 401, 'Unauthenticated /api/classroom/courses rejected with 401');

    const unauthAssignments = await request('/api/classroom/assignments');
    check(unauthAssignments.status === 401, 'Unauthenticated /api/classroom/assignments rejected with 401');

    const unauthSubmit = await request('/api/classroom/submit-direct', 'POST', { confirmedByUser: true });
    check(unauthSubmit.status === 401, 'Unauthenticated submission rejected with 401');

    // -------------------------------------------------------------
    // SECTION 4: Authentication & Session Verification
    // -------------------------------------------------------------
    console.log('\n[SECTION 4] Testing Authentication & Session Management...');
    
    // Check Google Auth URL generator when credentials not set
    const googleAuthUrlRes = await request('/api/auth/google/url');
    check(googleAuthUrlRes.status === 200, 'Google auth URL endpoint returns 200 OK');
    check(googleAuthUrlRes.data?.isConfigured === false, 'Correctly reports Google OAuth isConfigured: false (graceful handling)');

    // Login with Demo Student
    const loginRes = await request('/api/auth/demo-login', 'POST');
    check(loginRes.status === 200, 'Demo student login succeeds with 200 OK');
    check(Boolean(loginRes.data?.token), 'JWT authentication token received');
    authToken = loginRes.data?.token;

    // Verify authenticated profile
    const profileRes = await request('/api/auth/me');
    check(profileRes.status === 200, 'Authenticated profile /api/auth/me returns 200 OK');
    check(profileRes.data?.user?.email === 'demo.student@campus.edu', 'User profile matches demo student Alex Rivera');

    // Test Preferences Update
    const prefRes = await request('/api/auth/preferences', 'PUT', { dailyStudyHours: 4, speechRate: 1.1 });
    check(prefRes.status === 200 && prefRes.data?.preferences?.dailyStudyHours === 4, 'Preferences updated successfully');

    // -------------------------------------------------------------
    // SECTION 5: Google Classroom Service & Categorization
    // -------------------------------------------------------------
    console.log('\n[SECTION 5] Testing Google Classroom Data & Coursework Categorization...');
    const coursesRes = await request('/api/classroom/courses');
    check(coursesRes.status === 200, 'Courses endpoint /api/classroom/courses returns 200 OK');
    check(Array.isArray(coursesRes.data?.courses) && coursesRes.data.courses.length >= 3, 'Courses list retrieved');

    const asgRes = await request('/api/classroom/assignments');
    check(asgRes.status === 200, 'Assignments endpoint /api/classroom/assignments returns 200 OK');
    check(asgRes.data?.assignments?.length >= 3, 'Coursework items retrieved');
    
    // Check categorization filter
    const pendingRes = await request('/api/classroom/assignments?category=pending');
    check(pendingRes.status === 200 && pendingRes.data.assignments.every(a => a.category === 'pending'), 'Filter category=pending strictly returns pending items');

    const overdueRes = await request('/api/classroom/assignments?category=overdue');
    check(overdueRes.status === 200 && overdueRes.data.assignments.every(a => a.category === 'overdue'), 'Filter category=overdue strictly returns overdue items');

    // Test Single Assignment Detail View
    const singleAsg = await request('/api/classroom/assignment/demo-cs301/demo-asg-1');
    check(singleAsg.status === 200, 'Single assignment details /api/classroom/assignment/:cId/:aId returns 200 OK');
    check(singleAsg.data?.assignment?.title?.includes('Dijkstra'), 'Assignment title correctly matched');

    // -------------------------------------------------------------
    // SECTION 6: AI Homework Assistant & Document Synthesis
    // -------------------------------------------------------------
    console.log('\n[SECTION 6] Testing AI Homework Assistant & Synthesis...');
    
    // Question Explainer
    const explainRes = await request('/api/classroom/ai-helper/explain', 'POST', {
      title: 'Problem Set 4: Dijkstra & A*',
      description: 'Implement shortest path algorithm with min-heap priority queue',
      courseName: 'CS 301'
    });
    check(explainRes.status === 200, 'AI homework explainer endpoint returns 200 OK');
    check(explainRes.data?.explanation?.length > 40, 'Student-friendly question breakdown generated');

    // Solution Draft Generator (Report)
    const draftRes = await request('/api/classroom/ai-helper/generate-draft', 'POST', {
      title: 'Problem Set 4: Dijkstra & A*',
      description: 'Implement shortest path algorithm',
      courseName: 'CS 301',
      solutionType: 'report'
    });
    check(draftRes.status === 200, 'AI solution draft generator returns 200 OK');
    check(draftRes.data?.draftContent?.includes('# Academic Submission'), 'Formal academic report structure created');

    // Solution Draft Generator (Code)
    const codeDraftRes = await request('/api/classroom/ai-helper/generate-draft', 'POST', {
      title: 'Problem Set 4: Dijkstra & A*',
      description: 'Implement shortest path algorithm',
      courseName: 'CS 301',
      solutionType: 'code'
    });
    check(codeDraftRes.status === 200, 'AI code solution generator returns 200 OK');
    check(codeDraftRes.data?.draftContent?.includes('solvePathfinding'), 'Code draft includes implementation logic');

    // PDF Export
    const pdfRes = await request('/api/classroom/ai-helper/export-pdf', 'POST', {
      title: 'Problem Set 4: Dijkstra Implementation',
      courseName: 'CS 301',
      content: draftRes.data.draftContent
    });
    check(pdfRes.status === 200, 'PDF document exporter returns 200 OK');
    check(Boolean(pdfRes.data?.downloadUrl && pdfRes.data?.filePath), 'Downloadable PDF URL & local file path generated');

    // Verify PDF file exists on disk and has %PDF magic bytes
    if (pdfRes.data?.filePath && fs.existsSync(pdfRes.data.filePath)) {
      const pdfHeader = fs.readFileSync(pdfRes.data.filePath, { encoding: 'ascii', flag: 'r' }).substring(0, 5);
      check(pdfHeader.startsWith('%PDF'), 'Generated PDF file has verified %PDF magic byte header');
    }

    // -------------------------------------------------------------
    // SECTION 7: File Uploads & Study Material Parsing
    // -------------------------------------------------------------
    console.log('\n[SECTION 7] Testing Multipart File Uploads & Study Material Parsing...');
    
    // Test uploading homework file
    const sampleHomeworkContent = Buffer.from('// Student Solution\nfunction dijkstra() { return true; }\n');
    const uploadHwRes = await uploadMultipart(
      '/api/classroom/upload-homework',
      'homeworkFile',
      'solution.js',
      sampleHomeworkContent,
      'application/javascript'
    );
    check(uploadHwRes.status === 200, 'Homework file upload /api/classroom/upload-homework returns 200 OK');
    check(uploadHwRes.data?.file?.storedName?.length > 5, 'Homework file stored securely in uploads');

    // Test uploading study notes material
    const sampleNotesContent = Buffer.from('Binary Search Tree Invariants: left < node < right. Depth h is O(log N) for balanced trees.');
    const uploadNotesRes = await uploadMultipart(
      '/api/upload/study-material',
      'file',
      'BST_Lecture.txt',
      sampleNotesContent,
      'text/plain'
    );
    check(uploadNotesRes.status === 201, 'Study material upload /api/upload/study-material returns 201 Created');
    check(Boolean(uploadNotesRes.data?.material?.summary), 'Uploaded material automatically summarized by AI engine');

    // -------------------------------------------------------------
    // SECTION 8: Model Context Protocol (MCP) Server Tools
    // -------------------------------------------------------------
    console.log('\n[SECTION 8] Testing Model Context Protocol (MCP) Tools...');
    const mcpToolsRes = await request('/api/mcp/tools');
    check(mcpToolsRes.status === 200, 'MCP tools endpoint /api/mcp/tools returns 200 OK');
    check(mcpToolsRes.data?.tools?.length >= 10, 'All 10 required MCP tools are registered in protocol');

    const mcpCoursesExec = await request('/api/mcp/execute', 'POST', {
      toolName: 'get_my_courses',
      args: {}
    });
    check(mcpCoursesExec.status === 200 && mcpCoursesExec.data?.success, 'MCP tool "get_my_courses" executes successfully');

    const mcpStudyPlanExec = await request('/api/mcp/execute', 'POST', {
      toolName: 'create_study_plan',
      args: { dailyStudyHours: 3 }
    });
    check(mcpStudyPlanExec.status === 200 && mcpStudyPlanExec.data?.success, 'MCP tool "create_study_plan" executes successfully');

    // -------------------------------------------------------------
    // SECTION 9: Direct Classroom Submission Safety Verification
    // -------------------------------------------------------------
    console.log('\n[SECTION 9] Testing Assignment Submission Safety Enforcement...');
    
    // Safety check 1: Unconfirmed submission MUST fail with 400
    const unconfirmedSubmit = await request('/api/classroom/submit-direct', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      confirmedByUser: false
    });
    check(unconfirmedSubmit.status === 400, 'Unconfirmed submission safely REJECTED with 400');
    check(unconfirmedSubmit.data?.message?.includes('SAFETY CHECK'), 'Safety error message clearly explains confirmation requirement');

    // Safety check 2: Confirmed submission succeeds
    const confirmedSubmit = await request('/api/classroom/submit-direct', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      submissionId: 'demo-sub-1',
      localFilePath: pdfRes.data?.filePath || null,
      confirmedByUser: true
    });
    check(confirmedSubmit.status === 200, 'Confirmed submission succeeds with 200 OK');
    check(confirmedSubmit.data?.submissionState === 'TURNED_IN', 'Submission state confirmed as TURNED_IN');

    // Reclaim / Unsubmit
    const reclaimRes = await request('/api/classroom/reclaim', 'POST', {
      courseId: 'demo-cs301',
      assignmentId: 'demo-asg-1',
      submissionId: 'demo-sub-1'
    });
    check(reclaimRes.status === 200, 'Reclaim / unsubmit endpoint returns 200 OK');
    check(reclaimRes.data?.submissionState === 'CREATED', 'Assignment state reset to CREATED');

    // -------------------------------------------------------------
    // SECTION 10: 404 & Error Boundary Verification
    // -------------------------------------------------------------
    console.log('\n[SECTION 10] Testing API Error Boundaries & Fallback Routing...');
    const notFoundApi = await request('/api/nonexistent-endpoint-test');
    check(notFoundApi.status === 404, 'Non-existent API endpoint returns 404');
    check(notFoundApi.data?.success === false, '404 returns structured JSON error');

    const emptyChat = await request('/api/ai/chat', 'POST', { message: '   ' });
    check(emptyChat.status === 400, 'Empty AI chat message rejected with 400 Bad Request');

    console.log('\n================================================================');
    console.log(`🏁 QA AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal QA Audit Error:', err);
    process.exit(1);
  }
};

runQAAudit();
