# 🌸 Aura — AI Student Assistant & Voice Companion

A modern, production-oriented, full-stack AI student companion built for college students. Aura integrates with **Google Classroom**, **Google Gemini AI**, the **Model Context Protocol (MCP)**, and native browser **Web Speech APIs** to help students manage assignments, understand study materials, create optimized study plans, and revise through interactive flashcards and voice interactions.

---

## 🌟 Key Features

### 1. 🔐 Authentication & Session Management
- **Google Sign-In**: OAuth 2.0 flow with incremental authorization for Google Classroom scopes.
- **Session Security**: JSON Web Tokens (JWT) stored securely and verified on protected endpoints.
- **1-Click Test Student**: Instant development login mode to test features without configuring Google Cloud keys.
- **Isolated User Credentials**: Access and refresh tokens are isolated per student and never exposed in logs or MCP tool responses.

### 2. 📚 Google Classroom Integration
- **Official API**: Powered by `googleapis` (Classroom v1).
- **Course & Work Management**: Fetches accessible courses and categorized coursework.
- **Categorization Engine**: Automatically organizes assignments into:
  - ⏳ **Pending**: Upcoming active coursework.
  - 🚨 **Overdue**: Past deadline without verified submission.
  - ✅ **Submitted**: Work turned in on Classroom.
  - 🔄 **Returned**: Graded submissions with feedback.
- **Live Search & Filtering**: Instant search and course-specific filtering.
- **Clear Labeled Fallbacks**: Clear indicators differentiating live Google Classroom data from offline test mock mode.

### 3. 🎙️ Voice Assistant & Hands-Free "Hey Aura" Wake Word
- **Hands-Free Wake-Word Detection**: Say *"Hey Aura"* to automatically activate Aura without clicking any button.
- **Synthesized Two-Tone Chime**: Instant activation chime generated locally via the Web Audio API (`C5` → `E5` chord).
- **One-Utterance Command Extraction**: Speak your command immediately (e.g. *"Hey Aura, what is due tomorrow?"*) or say *"Hey Aura"* and wait for Aura's follow-up prompt.
- **Anti-Echo Safety Guard**: Automatically mutes the wake-word listener while Aura is speaking aloud through speakers (+ 600ms grace period) so Aura never triggers herself.
- **Speech Recognition (STT)**: Integrated via standard browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Text-to-Speech (TTS)**: Spoken voice responses powered by `window.speechSynthesis`.
- **Privacy & Safety Guarantees**:
  - Explicit opt-in via Hands-Free toggle and Permission Explanation Modal.
  - Persistent red pulsing indicator whenever the microphone is active, with an instant 1-click **"⏹ Stop Mic"** button.
  - Zero audio recording or storage to disk.
  - Consequential actions (like submitting homework to Google Classroom) can never be triggered solely by voice and require explicit manual UI confirmation.
- **Supported Vocal Commands**:
  - *"Show my pending assignments."*
  - *"What is due tomorrow?"*
  - *"Explain this topic simply."*
  - *"Summarize my uploaded notes."*
  - *"Create a study plan."*
  - *"Repeat the last explanation."*
- **Typed Chat & Manual Fallback**: Full conversational chat and manual voice button are preserved as fallbacks.

### 4. 🧠 Conversational AI Study Assistant
- **Gemini Powered**: Built with `@google/genai` (Gemini 2.5 Flash).
- **Intuitive Concept Explanations**: Breaks down complex algorithms and theories using relatable analogies and LaTeX mathematical formulas.
- **Academic Integrity Safeguard**: Provides learning outlines, pseudocode, and concept explanations rather than direct plagiarism.

### 5. 📅 Smart Study Planner
- **Automated Deadline Scheduling**: Generates balanced 7-day schedules based on pending coursework urgency, estimated workloads, and daily capacity.
- **Urgency Prioritization**: Fast-tracks tasks due within 24 hours.
- **Interactive Checklists**: Real-time task completion toggle.

### 6. 📝 Study Material Hub & Flashcards
- **Multi-Format Document Parsing**: Upload PDF, PPTX, or TXT lecture notes (up to 25MB).
- **Structured Synthesis**: Extracts 2-3 paragraph summary, core concepts, definitions, and mathematical formulas.
- **Interactive 3D Flip Flashcards**: Practice key terms with flip animation.
- **Pedagogical Disclaimer**: Explicitly labels practice MCQs and flashcards as AI-generated self-study material.

### 7. 🔌 Model Context Protocol (MCP) Server
- **SDK**: Built using official `@modelcontextprotocol/sdk`.
- **Remote Streamable HTTP / SSE**:
  - `GET /api/mcp/sse`: Server-Sent Events stream for external & in-app MCP clients.
  - `POST /api/mcp/messages`: Bidirectional JSON-RPC messages.
  - `POST /api/mcp/execute`: Direct in-app tool execution.
- **Exposed MCP Tools**:
  1. `get_my_courses`
  2. `get_assignments`
  3. `get_submission_status`
  4. `get_assignment_details`
  5. `prepare_assignment` *(Safety-protected draft creator)*
  6. `create_study_plan`
  7. `summarize_study_material`
  8. `generate_practice_questions`
  9. `attach_assignment_file`
  10. `submit_assignment` *(Consequential action)*

### 8. 🛡️ Assignment Submission Safety
- **Draft Separation**: `prepare_assignment` stores local drafts and never automatically turns work in.
- **Two-Step Confirmation Modal**: Displays course, assignment title, and warnings; requires explicit confirmation before invoking the Classroom API.

### 9. 🎨 Aesthetic Pastel UI/UX
- **Calming Palette**: Pastel lavender (`#EDE9FE`), soft blue (`#E0F2FE`), white (`#FFFFFF`), and subtle purple accents (`#8B5CF6`).
- **Responsive Layout**: Sidebar navigation, rounded cards, pulsating voice orb, and accessible contrast.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on v26.7.0).
- Local MongoDB daemon OR simply run zero-config (automatically falls back to `mongodb-memory-server`).

### 2. Environment Configuration
Copy the template and fill in your keys (optional for local testing; demo data works out of the box):
```powershell
cp .env.example .env
```

| Key | Description |
| :--- | :--- |
| `PORT` | Web server port (Default: `5000`) |
| `JWT_SECRET` | Secret key used to sign session tokens |
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth Client ID |
| `GOOGLE_CLIENT_SECRET`| Google Cloud Console OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/api/auth/google/callback` |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key |

### 3. Launch Server
```powershell
node server.js
```
 **[http://localhost:5000](http://localhost:5000)**

### 4. Run Automated Test Suite
```powershell
node test/suite.js
```

---

## 🏛️ Project Directory Structure

```text
├── config/
│   ├── db.js                 # MongoDB connection with in-memory fallback
│   └── googleAuth.js         # OAuth2 lifecycle & Classroom scopes
├── controllers/
│   └── authController.js     # Google Sign-In, demo auth, profile & JWT
├── middleware/
│   ├── authMiddleware.js     # JWT protection & token extraction
│   └── uploadMiddleware.js   # Multer file upload for PDF, PPTX, TXT
├── models/
│   ├── User.js               # User credentials & Google tokens
│   ├── StudyPlan.js          # Scheduled study tasks & progress
│   ├── StudyMaterial.js      # Extracted notes, summaries & flashcards
│   └── AssignmentDraft.js    # Pre-submission drafts & safety flags
├── mcp/
│   └── server.js             # Model Context Protocol server (@modelcontextprotocol/sdk)
├── routes/
│   ├── authRoutes.js         # Auth endpoints & callbacks
│   ├── classroomRoutes.js    # Google Classroom courses & coursework
│   ├── aiRoutes.js           # Gemini chat, voice assistant & study planner
│   ├── uploadRoutes.js       # Document upload & text extraction
│   └── mcpRoutes.js          # MCP SSE transport & in-app tool execution
├── services/
│   ├── classroomService.js   # Google Classroom API v1 wrapper
│   └── geminiService.js      # Google Gemini 2.5 Flash SDK wrapper
├── utils/
│   └── documentParser.js     # Text extraction for PDF, TXT, PPTX
├── public/
│   ├── index.html            # Single-page web application
│   ├── css/student-theme.css # Pastel lavender & soft blue calming theme
│   └── js/app.js             # Client state, voice STT/TTS & API bindings
├── test/
│   └── suite.js              # Automated integration verification suite
├── package.json
└── README.md
```
