/**
 * AI Student Assistant - Core Frontend Application
 * Handles Classroom Sync, Web Speech Voice Recognition & TTS, Gemini Chat,
 * Study Planner, Notes Summarizer, and Safe Submissions.
 */

// Application State
const state = {
  token: localStorage.getItem('aura_jwt_token') || '',
  user: null,
  courses: [],
  assignments: [],
  currentTab: 'pending',
  searchQuery: '',
  activeView: 'classroom-view',
  voiceMuted: false,
  isListening: false,
  recognition: null,
  lastExplanation: '',
  selectedAssignmentForSubmit: null,
  mcpStatus: 'offline'
};

// DOM Ready Init
document.addEventListener('DOMContentLoaded', async () => {
  parseUrlTokens();
  initVoiceRecognition();
  setupNavigation();
  setupVoiceCommands();
  setupAssignmentFilters();
  setupStudyMaterialUpload();

  await checkAuthAndLoad();
});

/**
 * 1. Authentication & Session Initialization
 */
function parseUrlTokens() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('aura_jwt_token', token);
    state.token = token;
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function checkAuthAndLoad() {
  if (!state.token) {
    // Auto-login to demo account for seamless instant preview if not logged in
    await performDemoLogin();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success) {
      state.user = data.user;
      renderUserProfile();
      await loadDashboardData();
      await checkMcpStatus();
    } else {
      await performDemoLogin();
    }
  } catch (err) {
    console.error('Session verify error:', err);
    await performDemoLogin();
  }
}

async function performDemoLogin() {
  try {
    const res = await fetch('/api/auth/demo-login', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('aura_jwt_token', data.token);
      renderUserProfile();
      await loadDashboardData();
      await checkMcpStatus();
    }
  } catch (err) {
    console.error('Demo login failed:', err);
  }
}

function renderUserProfile() {
  const userSection = document.getElementById('user-profile-section');
  const classroomBadge = document.getElementById('classroom-badge');

  if (state.user) {
    const initials = state.user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    userSection.innerHTML = `
      <div class="user-profile">
        <div class="user-avatar">${initials}</div>
        <span style="font-size: 13px; font-weight: 600;">${state.user.name}</span>
      </div>
      <button class="btn btn-soft" onclick="logout()" style="padding: 4px 10px; font-size: 11px;">Logout</button>
    `;

    if (state.user.classroomAuthorized) {
      classroomBadge.className = 'badge-tag badge-classroom';
      classroomBadge.innerHTML = '● Classroom Connected';
    } else {
      classroomBadge.className = 'badge-tag badge-demo';
      classroomBadge.innerHTML = '● Demo Mode (Connect Google in Settings)';
    }
  }
}

function logout() {
  localStorage.removeItem('aura_jwt_token');
  state.token = '';
  state.user = null;
  location.reload();
}

/**
 * 2. Google Classroom Data Loading & Filtering
 */
async function loadDashboardData() {
  await Promise.all([loadCourses(), loadAssignments()]);
}

async function loadCourses() {
  try {
    const res = await fetch('/api/classroom/courses', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success) {
      state.courses = data.courses || [];
      renderCourseFilterDropdown();
    }
  } catch (err) {
    console.error('Courses load error:', err);
  }
}

async function loadAssignments(courseId = '') {
  try {
    let url = `/api/classroom/assignments?category=${state.currentTab}`;
    if (courseId) url += `&courseId=${courseId}`;
    if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success) {
      state.assignments = data.assignments || [];
      renderAssignmentsList();

      if (data.isDemo && data.label) {
        document.getElementById('demo-notice').style.display = 'block';
        document.getElementById('demo-notice-text').textContent = data.label;
      } else {
        document.getElementById('demo-notice').style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Assignments load error:', err);
  }
}

function renderCourseFilterDropdown() {
  const select = document.getElementById('course-filter-select');
  select.innerHTML = '<option value="">All Courses</option>';
  state.courses.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

  select.onchange = () => {
    loadAssignments(select.value);
  };
}

function renderAssignmentsList() {
  const container = document.getElementById('assignments-container');
  container.innerHTML = '';

  if (state.assignments.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: #fff; border-radius: var(--radius-lg); border: 1px dashed var(--lavender-200);">
        <p style="font-size: 16px; color: var(--text-muted); font-weight: 500;">No assignments found in this category.</p>
        <p style="font-size: 12px; color: var(--lavender-600); margin-top: 4px;">You're completely caught up!</p>
      </div>
    `;
    return;
  }

  state.assignments.forEach((asg) => {
    const card = document.createElement('div');
    card.className = 'card';

    let dueText = 'No due date';
    if (asg.dueDate) {
      const d = new Date(asg.dueDate);
      dueText = `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }

    const badgeClass = asg.isOverdue ? 'overdue' : asg.category === 'submitted' ? 'submitted' : 'pending';
    const badgeLabel = asg.isOverdue ? 'Overdue' : asg.category.toUpperCase();

    card.innerHTML = `
      <div class="card-course">${asg.courseName}</div>
      <div class="card-title">${asg.title}</div>
      <div class="card-desc">${asg.description || 'No detailed instructions provided.'}</div>
      <div class="card-footer">
        <span class="due-badge ${badgeClass}">${badgeLabel} • ${dueText}</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" style="padding: 5px 12px; font-size: 11px;" onclick="openHomeworkStudio('${asg.id}')">
            ✨ Homework Studio & Submit
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * 3. Voice Assistant, Web Speech API & Hands-Free "Hey Aura" Engine
 */

// Hands-free state tracking
state.handsFreeEnabled = false;
state.handsFreeState = 'DISABLED'; // DISABLED, REQUESTING_PERMISSION, LISTENING_WAKEWORD, ACTIVATED, PROCESSING, SPEAKING, ERROR
state.isAuraSpeaking = false;
state.lastWakeWordTriggerTime = 0;
state.wakeWordRecognition = null;
state.awaitingFollowUpCommand = false;

// Audio Chime Synthesizer via Web Audio API (Zero external assets needed)
function playAuraActivationChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Chime Note 1: 523.25 Hz (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Chime Note 2: 659.25 Hz (E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.28, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  } catch (e) {
    console.warn('Activation chime error:', e);
  }
}

// Hands-Free State Manager & Visual UI Synchronizer
function setHandsFreeState(newState, detailMessage) {
  state.handsFreeState = newState;

  const badge = document.getElementById('handsfree-state-badge');
  const detail = document.getElementById('handsfree-status-detail');
  const floatingIndicator = document.getElementById('floating-mic-indicator');
  const floatingLabel = document.getElementById('floating-mic-label');

  if (!badge) return;

  // Clear existing classes
  badge.className = 'handsfree-badge';

  switch (newState) {
    case 'DISABLED':
      badge.classList.add('disabled');
      badge.textContent = 'Disabled';
      if (detail) detail.textContent = detailMessage || 'Wake word is off. Toggle switch to enable hands-free activation.';
      if (floatingIndicator) floatingIndicator.classList.remove('visible');
      break;

    case 'REQUESTING_PERMISSION':
      badge.classList.add('requesting');
      badge.textContent = 'Requesting Mic';
      if (detail) detail.textContent = detailMessage || 'Awaiting microphone authorization from browser...';
      if (floatingIndicator) floatingIndicator.classList.remove('visible');
      break;

    case 'LISTENING_WAKEWORD':
      badge.classList.add('listening');
      badge.textContent = 'Listening for "Hey Aura"';
      if (detail) detail.textContent = detailMessage || 'Say "Hey Aura" followed by your study question or command anytime.';
      if (floatingIndicator) {
        floatingIndicator.classList.add('visible');
        if (floatingLabel) floatingLabel.textContent = '👂 Listening for "Hey Aura"...';
      }
      break;

    case 'ACTIVATED':
      badge.classList.add('activated');
      badge.textContent = 'Hey Aura Detected!';
      if (detail) detail.textContent = detailMessage || 'Aura activated! Processing your voice request...';
      if (floatingIndicator) {
        floatingIndicator.classList.add('visible');
        if (floatingLabel) floatingLabel.textContent = '✨ Hey Aura Activated!';
      }
      break;

    case 'PROCESSING':
      badge.classList.add('processing');
      badge.textContent = 'Thinking...';
      if (detail) detail.textContent = detailMessage || 'Synthesizing response with Gemini AI...';
      if (floatingIndicator) {
        floatingIndicator.classList.add('visible');
        if (floatingLabel) floatingLabel.textContent = '🧠 Aura is thinking...';
      }
      break;

    case 'SPEAKING':
      badge.classList.add('speaking');
      badge.textContent = 'Aura Speaking';
      if (detail) detail.textContent = detailMessage || 'Speaking response aloud (mic temporarily muted to prevent echo)...';
      if (floatingIndicator) {
        floatingIndicator.classList.add('visible');
        if (floatingLabel) floatingLabel.textContent = '🗣️ Aura is speaking...';
      }
      break;

    case 'ERROR':
      badge.classList.add('error');
      badge.textContent = 'Mic Error';
      if (detail) detail.textContent = detailMessage || 'Microphone error or permission denied. Please check browser settings.';
      if (floatingIndicator) floatingIndicator.classList.remove('visible');
      break;
  }
}

// User Permission & Toggle Control Flow
function handleHandsFreeToggle(checked) {
  if (checked) {
    const hasPermittedBefore = localStorage.getItem('aura_handsfree_permitted') === 'true';
    if (!hasPermittedBefore) {
      document.getElementById('handsfree-permission-modal').classList.add('open');
      setHandsFreeState('REQUESTING_PERMISSION');
    } else {
      startHandsFreeListening();
    }
  } else {
    stopHandsFreeListening();
  }
}

function confirmHandsFreePermission() {
  document.getElementById('handsfree-permission-modal').classList.remove('open');
  localStorage.setItem('aura_handsfree_permitted', 'true');
  const toggle = document.getElementById('handsfree-mode-toggle');
  if (toggle) toggle.checked = true;
  startHandsFreeListening();
}

function cancelHandsFreePermission() {
  document.getElementById('handsfree-permission-modal').classList.remove('open');
  const toggle = document.getElementById('handsfree-mode-toggle');
  if (toggle) toggle.checked = false;
  setHandsFreeState('DISABLED', 'Hands-free activation cancelled.');
}

function stopHandsFreeListening() {
  state.handsFreeEnabled = false;
  state.awaitingFollowUpCommand = false;

  if (state.wakeWordRecognition) {
    try {
      state.wakeWordRecognition.onend = null; // Detach auto-restart
      state.wakeWordRecognition.stop();
      state.wakeWordRecognition.abort();
    } catch (e) {
      console.warn('Wake word stop error:', e);
    }
    state.wakeWordRecognition = null;
  }

  const toggle = document.getElementById('handsfree-mode-toggle');
  if (toggle) toggle.checked = false;

  setHandsFreeState('DISABLED', 'Hands-free wake-word detection stopped.');
}

// Resilient Continuous Wake-Word Detection Engine
function startHandsFreeListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setHandsFreeState('ERROR', 'Web Speech API is not supported in this browser. Please use Chrome or Edge.');
    alert('Hands-free voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    const toggle = document.getElementById('handsfree-mode-toggle');
    if (toggle) toggle.checked = false;
    return;
  }

  if (state.isAuraSpeaking) {
    // Wait until Aura finishes speaking before opening the microphone
    return;
  }

  state.handsFreeEnabled = true;

  // Terminate previous instance if any
  if (state.wakeWordRecognition) {
    try {
      state.wakeWordRecognition.onend = null;
      state.wakeWordRecognition.stop();
    } catch (e) {}
    state.wakeWordRecognition = null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (state.handsFreeEnabled && !state.isAuraSpeaking) {
        setHandsFreeState('LISTENING_WAKEWORD');
      }
    };

    recognition.onerror = (event) => {
      console.warn('Wake-word recognition event error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopHandsFreeListening();
        setHandsFreeState('ERROR', 'Microphone access denied. Click the lock/camera icon in your address bar to allow mic access.');
      } else if (event.error === 'no-speech' || event.error === 'network') {
        // Soft error, loop will gracefully restart on onend
      }
    };

    recognition.onend = () => {
      // Auto-restart loop with backoff if still enabled and Aura is not speaking
      if (state.handsFreeEnabled && !state.isAuraSpeaking) {
        setTimeout(() => {
          if (state.handsFreeEnabled && !state.isAuraSpeaking) {
            try {
              recognition.start();
            } catch (reErr) {
              // Re-initialize if direct start failed
              startHandsFreeListening();
            }
          }
        }, 350);
      }
    };

    recognition.onresult = (event) => {
      if (!state.handsFreeEnabled || state.isAuraSpeaking) return;

      const WAKE_WORD_REGEX = /\b(hey|hi|ok|ay|yo)\s+(aura|laura|ora|aurora)\b/i;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();

        // 1. Follow-up state: user previously said "Hey Aura" and now gave the command
        if (state.awaitingFollowUpCommand) {
          if (transcript.length > 2) {
            state.awaitingFollowUpCommand = false;
            setHandsFreeState('PROCESSING', `Executing: "${transcript}"`);
            document.getElementById('chat-input').value = transcript;
            handleVoiceCommand(transcript);
            return;
          }
        }

        // 2. Scan for Wake Word
        if (WAKE_WORD_REGEX.test(transcript)) {
          const now = Date.now();
          // Anti-duplication debounce guard: ignore repeated detections within 2.5s
          if (now - state.lastWakeWordTriggerTime < 2500) {
            return;
          }
          state.lastWakeWordTriggerTime = now;

          // Play gentle two-tone activation chime
          playAuraActivationChime();
          setHandsFreeState('ACTIVATED', 'Hey Aura detected!');

          // Extract following command after the wake phrase
          const commandAfterWake = transcript.replace(WAKE_WORD_REGEX, '').replace(/^[,.\s]+/, '').trim();

          if (commandAfterWake.length >= 3) {
            // One-utterance command: "Hey Aura, what is due tomorrow?"
            setHandsFreeState('PROCESSING', `Processing: "${commandAfterWake}"`);
            document.getElementById('chat-input').value = commandAfterWake;
            setTimeout(() => {
              handleVoiceCommand(commandAfterWake);
            }, 300);
          } else {
            // Wake word only: "Hey Aura" -> prompt student for command
            state.awaitingFollowUpCommand = true;
            setHandsFreeState('ACTIVATED', 'Listening for your command...');
            speakText("I'm listening!", () => {
              // Awaits command
            });
          }
          return;
        }
      }
    };

    recognition.start();
    state.wakeWordRecognition = recognition;
  } catch (err) {
    console.error('Failed to initialize wake-word recognition:', err);
    setHandsFreeState('ERROR', err.message);
  }
}

// Background Tab Visibility Handler (saves CPU & mic resources when tab is hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.wakeWordRecognition && state.handsFreeEnabled) {
      try {
        state.wakeWordRecognition.stop();
      } catch (e) {}
    }
  } else {
    if (state.handsFreeEnabled && !state.isAuraSpeaking) {
      setTimeout(() => {
        startHandsFreeListening();
      }, 300);
    }
  }
});

// Single-Shot Manual Voice Recognition (Preserved as Fallback)
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('Speech Recognition not supported in this browser.');
    updateVoiceUIStatus('unsupported');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    state.isListening = true;
    updateVoiceUIStatus('listening');
  };

  recognition.onend = () => {
    state.isListening = false;
    updateVoiceUIStatus('idle');
  };

  recognition.onerror = (event) => {
    state.isListening = false;
    updateVoiceUIStatus('error');
    console.warn('Speech recognition error:', event.error);
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('chat-input').value = transcript;
    handleVoiceCommand(transcript);
  };

  state.recognition = recognition;
}

function toggleVoiceListen() {
  if (!state.recognition) {
    alert('Voice recognition is not supported in this browser. Please use the typed chat input.');
    return;
  }

  if (state.isListening) {
    state.recognition.stop();
  } else {
    try {
      state.recognition.start();
    } catch (e) {
      console.warn('Recognition start error:', e);
    }
  }
}

function updateVoiceUIStatus(status) {
  const btn = document.getElementById('voice-orb-btn');
  const micLabel = document.getElementById('mic-status-label');

  if (status === 'listening') {
    btn.classList.add('listening');
    micLabel.textContent = 'Aura is listening...';
  } else if (status === 'unsupported') {
    btn.style.opacity = '0.5';
    micLabel.textContent = 'Voice unavailable (use text chat)';
  } else {
    btn.classList.remove('listening');
    micLabel.textContent = 'Tap to speak to Aura';
  }
}

// Spoken Voice Output with Acoustic Anti-Feedback Guard
function speakText(text, onCompleteCallback) {
  if (state.voiceMuted || !('speechSynthesis' in window)) {
    if (onCompleteCallback) onCompleteCallback();
    return;
  }

  window.speechSynthesis.cancel(); // cancel any ongoing speech

  // Anti-Feedback Guard: Pause continuous wake-word detection while Aura speaks through speakers!
  state.isAuraSpeaking = true;
  if (state.handsFreeEnabled) {
    setHandsFreeState('SPEAKING');
    if (state.wakeWordRecognition) {
      try {
        state.wakeWordRecognition.onend = null;
        state.wakeWordRecognition.stop();
      } catch (e) {}
    }
  }

  const cleanText = text.replace(/[*#`$\-_]/g, '').substring(0, 320);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = state.user?.preferences?.speechRate || 1.0;

  utterance.onend = () => {
    // 600ms acoustic grace period to allow room reverberation from speakers to dissipate
    setTimeout(() => {
      state.isAuraSpeaking = false;
      if (onCompleteCallback) onCompleteCallback();

      // Resume wake-word listening loop if hands-free is enabled
      if (state.handsFreeEnabled) {
        setHandsFreeState('LISTENING_WAKEWORD');
        startHandsFreeListening();
      }
    }, 600);
  };

  utterance.onerror = () => {
    state.isAuraSpeaking = false;
    if (state.handsFreeEnabled) {
      setHandsFreeState('LISTENING_WAKEWORD');
      startHandsFreeListening();
    }
  };

  window.speechSynthesis.speak(utterance);
}

function setupVoiceCommands() {
  document.querySelectorAll('.voice-command-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const command = pill.getAttribute('data-command');
      handleVoiceCommand(command);
    });
  });
}

async function handleVoiceCommand(cmd) {
  const lower = cmd.toLowerCase().trim();

  // 1. "Show my pending assignments"
  if (lower.includes('show') && (lower.includes('pending') || lower.includes('assignments'))) {
    switchView('classroom-view');
    switchAssignmentTab('pending');
    appendChatMessage('user', cmd);
    const reply = "Switching to your pending assignments view! Here is what you have coming up.";
    appendChatMessage('assistant', reply);
    speakText(reply);
    return;
  }

  // 2. "What is due tomorrow?"
  if (lower.includes('due tomorrow') || lower.includes('what is due')) {
    appendChatMessage('user', cmd);
    const reply = "Problem Set 4: Dijkstra & A* Pathfinding is due tomorrow at 11:59 PM for CS 301. I recommend dedicating 45 minutes tonight!";
    appendChatMessage('assistant', reply);
    speakText(reply);
    return;
  }

  // 3. "Create a study plan"
  if (lower.includes('create') && lower.includes('plan')) {
    switchView('planner-view');
    appendChatMessage('user', cmd);
    appendChatMessage('assistant', "Generating your personalized smart study plan now...");
    await generateStudyPlan();
    speakText("I have synthesized an optimized study schedule based on your deadlines.");
    return;
  }

  // 4. "Repeat the last explanation"
  if (lower.includes('repeat') && state.lastExplanation) {
    appendChatMessage('user', cmd);
    appendChatMessage('assistant', `Repeating: ${state.lastExplanation}`);
    speakText(state.lastExplanation);
    return;
  }

  // General conversational query
  sendUserMessage(cmd);
}

/**
 * 4. Conversational Chat System
 */
async function sendUserMessage(textOverride) {
  const input = document.getElementById('chat-input');
  const message = textOverride || input.value.trim();
  if (!message) return;

  if (!textOverride) input.value = '';
  appendChatMessage('user', message);

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        message,
        context: {
          currentTab: state.currentTab,
          pendingAssignmentsCount: state.assignments.length
        }
      })
    });

    const data = await res.json();
    if (data.success) {
      state.lastExplanation = data.reply;
      appendChatMessage('assistant', data.reply);
      speakText(data.reply);
    }
  } catch (err) {
    console.error('Chat error:', err);
    appendChatMessage('assistant', 'Sorry, I had trouble processing that request. Please try again.');
  }
}

function appendChatMessage(sender, text) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = `message ${sender}`;

  // Simple markdown conversion
  let formatted = text
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  msg.innerHTML = `<div class="msg-bubble">${formatted}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function askAuraAboutAssignment(id) {
  const asg = state.assignments.find((a) => a.id === id);
  if (!asg) return;

  switchView('chat-view');
  const prompt = `Can you explain the assignment "${asg.title}" for ${asg.courseName} in simple student-friendly terms and break it into actionable steps?`;
  document.getElementById('chat-input').value = prompt;
  sendUserMessage(prompt);
}

/**
 * 5. Smart Study Planner
 */
async function loadStudyPlan() {
  try {
    const res = await fetch('/api/ai/study-plan', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success && data.plan) {
      renderStudyPlan(data.plan);
    }
  } catch (err) {
    console.error('Study plan load error:', err);
  }
}

async function generateStudyPlan() {
  try {
    const res = await fetch('/api/ai/study-plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ dailyStudyHours: 3 })
    });
    const data = await res.json();
    if (data.success && data.plan) {
      renderStudyPlan(data.plan);
    }
  } catch (err) {
    console.error('Generate study plan error:', err);
  }
}

function renderStudyPlan(plan) {
  const container = document.getElementById('tasks-container');
  const countSpan = document.getElementById('plan-tasks-count');
  const totalTasks = plan.tasks.length;
  const completedTasks = plan.tasks.filter((t) => t.isCompleted).length;

  countSpan.textContent = `${completedTasks} of ${totalTasks} completed`;
  container.innerHTML = '';

  plan.tasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.isCompleted ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="task-left">
        <div class="checkbox-custom" onclick="toggleTaskCompletion('${task._id}')">
          ${task.isCompleted ? '✓' : ''}
        </div>
        <div>
          <div class="task-text" style="font-weight: 600; font-size: 14px;">${task.title}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${task.courseName} • ~${task.estimatedMinutes} mins • Priority: ${task.priority.toUpperCase()}</div>
        </div>
      </div>
      <span class="due-badge pending" style="font-size: 11px;">${new Date(task.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
    `;
    container.appendChild(item);
  });
}

async function toggleTaskCompletion(taskId) {
  try {
    const res = await fetch(`/api/ai/study-plan/task/${taskId}/toggle`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadStudyPlan();
    }
  } catch (err) {
    console.error('Toggle task error:', err);
  }
}

/**
 * 6. Study Materials Upload & Flashcard Viewer
 */
function setupStudyMaterialUpload() {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('material-file-input');

  dropzone.onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      await uploadStudyMaterial(file);
    }
  };
}

async function uploadStudyMaterial(file) {
  const formData = new FormData();
  formData.append('file', file);

  const statusMsg = document.getElementById('upload-status-msg');
  statusMsg.style.display = 'block';
  statusMsg.textContent = `Analyzing "${file.name}" with Gemini AI...`;

  try {
    const res = await fetch('/api/upload/study-material', {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData
    });

    const data = await res.json();
    statusMsg.style.display = 'none';

    if (data.success) {
      renderStudyMaterialSummary(data.material);
    }
  } catch (err) {
    console.error('Material upload error:', err);
    statusMsg.textContent = 'Upload failed. Please ensure file is under 25MB (PDF, TXT, PPTX).';
  }
}

function renderStudyMaterialSummary(material) {
  const container = document.getElementById('material-summary-section');
  container.style.display = 'block';

  document.getElementById('mat-title').textContent = material.filename;
  document.getElementById('mat-summary-text').textContent = material.summary;

  const conceptsList = document.getElementById('mat-concepts-list');
  conceptsList.innerHTML = '';
  material.keyConcepts.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c;
    conceptsList.appendChild(li);
  });

  const formulasList = document.getElementById('mat-formulas-list');
  formulasList.innerHTML = '';
  if (material.formulas && material.formulas.length > 0) {
    material.formulas.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      formulasList.appendChild(li);
    });
  } else {
    formulasList.innerHTML = '<li style="color: var(--text-muted);">No explicit mathematical formulas identified.</li>';
  }

  // Load practice questions for this material
  loadPracticeQuestionsForTopic(material.filename);
}

async function loadPracticeQuestionsForTopic(topic) {
  try {
    const res = await fetch('/api/ai/practice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ topic })
    });

    const data = await res.json();
    if (data.success && data.data) {
      renderFlashcards(data.data.flashcards || []);
    }
  } catch (err) {
    console.error('Practice load error:', err);
  }
}

function renderFlashcards(cards) {
  const container = document.getElementById('flashcards-container');
  container.innerHTML = '';

  cards.forEach((c) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'flashcard';
    cardEl.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <p style="font-size: 11px; text-transform: uppercase; color: var(--lavender-600); margin-bottom: 8px;">Question (Click to flip)</p>
          <p>${c.question}</p>
        </div>
        <div class="flashcard-back">
          <p style="font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Key Answer</p>
          <p>${c.answer}</p>
        </div>
      </div>
    `;
    cardEl.onclick = () => cardEl.classList.toggle('flipped');
    container.appendChild(cardEl);
  });
}

/**
 * 7. Assignment Submission Safety Flow
 */
function openSubmissionSafetyModal(assignmentId) {
  const asg = state.assignments.find((a) => a.id === assignmentId);
  if (!asg) return;

  state.selectedAssignmentForSubmit = asg;

  document.getElementById('safety-modal-course').textContent = asg.courseName;
  document.getElementById('safety-modal-title').textContent = asg.title;
  document.getElementById('safety-confirm-check').checked = false;
  document.getElementById('safety-submit-btn').disabled = true;

  document.getElementById('safety-confirm-check').onchange = (e) => {
    document.getElementById('safety-submit-btn').disabled = !e.target.checked;
  };

  document.getElementById('submission-safety-modal').classList.add('open');
}

function closeSubmissionModal() {
  document.getElementById('submission-safety-modal').classList.remove('open');
  state.selectedAssignmentForSubmit = null;
}

async function confirmAndSubmitAssignment() {
  if (!state.selectedAssignmentForSubmit) return;
  const asg = state.selectedAssignmentForSubmit;

  const btn = document.getElementById('safety-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/classroom/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        courseId: asg.courseId,
        assignmentId: asg.id,
        submissionId: asg.submissionId || 'demo-sub-1',
        confirmedByUser: true
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`Success: "${asg.title}" was submitted to Google Classroom.`);
      closeSubmissionModal();
      await loadAssignments();
    } else {
      alert(`Error submitting assignment: ${data.message}`);
    }
  } catch (err) {
    console.error('Submission error:', err);
    alert('Failed to submit assignment. Please try again.');
  } finally {
    btn.textContent = 'Confirm & Submit to Google Classroom';
    btn.disabled = false;
  }
}

/**
 * 8. MCP Server Client Status Monitor
 */
async function checkMcpStatus() {
  try {
    const res = await fetch('/api/mcp/tools', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    const dot = document.getElementById('mcp-status-dot');
    const label = document.getElementById('mcp-status-text');

    if (data.success) {
      dot.style.background = '#22c55e';
      label.textContent = `MCP Connected (${data.tools.length} Tools)`;
      state.mcpStatus = 'online';
    } else {
      dot.style.background = '#f59e0b';
      label.textContent = 'MCP Standby';
    }
  } catch (e) {
    console.warn('MCP status check:', e);
  }
}

/**
 * 9. UI Navigation & Tab Handlers
 */
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

function switchView(viewId) {
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewId);
  });

  document.querySelectorAll('.content-body').forEach((v) => {
    v.classList.remove('active');
  });

  const activeElement = document.getElementById(viewId);
  if (activeElement) {
    activeElement.classList.add('active');
  }

  state.activeView = viewId;

  if (viewId === 'planner-view') {
    loadStudyPlan();
  }
}

function setupAssignmentFilters() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      switchAssignmentTab(cat);
    });
  });

  const searchInput = document.getElementById('assignment-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      loadAssignments();
    });
  }
}

function switchAssignmentTab(cat) {
  state.currentTab = cat;
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-category') === cat);
  });
  loadAssignments();
}

/**
 * 10. AI Homework Studio & Complete Direct Classroom Submission
 */
state.activeStudioAssignment = null;
state.attachedHomeworkFile = null;

async function openHomeworkStudio(assignmentId) {
  const asg = state.assignments.find((a) => a.id === assignmentId);
  if (!asg) return;

  state.activeStudioAssignment = asg;
  state.attachedHomeworkFile = null;

  // Set modal headers
  document.getElementById('studio-course-name').textContent = asg.courseName;
  document.getElementById('studio-assignment-title').textContent = asg.title;

  const statusBadge = document.getElementById('studio-status-badge');
  statusBadge.className = `due-badge ${asg.isOverdue ? 'overdue' : asg.category === 'submitted' ? 'submitted' : 'pending'}`;
  statusBadge.textContent = asg.submissionState || asg.category.toUpperCase();

  // Due date & max points
  let dueText = 'No explicit deadline';
  if (asg.dueDate) {
    const d = new Date(asg.dueDate);
    dueText = `Due ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }
  document.getElementById('studio-due-date').textContent = dueText;
  document.getElementById('studio-max-points').textContent = `${asg.maxPoints || 100} Points Maximum`;

  // Instructions
  document.getElementById('studio-instructions-text').textContent = asg.description || 'No detailed instructions written by the instructor.';

  // Reset explanation box
  document.getElementById('studio-explanation-box').style.display = 'none';
  document.getElementById('studio-explanation-content').innerHTML = '';

  // Reset Editor and load draft if any
  document.getElementById('studio-editor-textarea').value = '';
  document.getElementById('editor-char-count').textContent = '0 characters';
  document.getElementById('uploaded-homework-status').style.display = 'none';
  document.getElementById('studio-submit-confirm-checkbox').checked = false;
  document.getElementById('studio-final-submit-btn').disabled = true;
  document.getElementById('submission-result-banner').style.display = 'none';

  // Toggle Reclaim button if already submitted
  const reclaimBtn = document.getElementById('btn-reclaim-assignment');
  if (asg.category === 'submitted' || asg.submissionState === 'TURNED_IN') {
    reclaimBtn.style.display = 'inline-flex';
  } else {
    reclaimBtn.style.display = 'none';
  }

  // Update review panel
  updateReviewMetadata();

  // Switch to instructions tab
  switchStudioTab('tab-instructions');

  // Open modal
  document.getElementById('homework-studio-modal').classList.add('open');

  // Fetch full details & drafts from server in background
  try {
    const res = await fetch(`/api/classroom/assignment/${asg.courseId}/${asg.id}`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success && data.draft && data.draft.draftContent) {
      document.getElementById('studio-editor-textarea').value = data.draft.draftContent;
      document.getElementById('editor-char-count').textContent = `${data.draft.draftContent.length} characters (Saved Draft)`;
    }
  } catch (err) {
    console.warn('Could not fetch existing draft:', err);
  }
}

function closeHomeworkStudio() {
  document.getElementById('homework-studio-modal').classList.remove('open');
  state.activeStudioAssignment = null;
  state.attachedHomeworkFile = null;
}

function switchStudioTab(tabId) {
  document.querySelectorAll('.studio-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.studio-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

async function requestPlainEnglishExplanation() {
  const asg = state.activeStudioAssignment;
  if (!asg) return;

  const btn = document.getElementById('btn-explain-question');
  btn.disabled = true;
  btn.textContent = 'Generating explanation...';

  try {
    const res = await fetch('/api/classroom/ai-helper/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        title: asg.title,
        description: asg.description,
        courseName: asg.courseName
      })
    });

    const data = await res.json();
    if (data.success && data.explanation) {
      let formatted = data.explanation
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      document.getElementById('studio-explanation-content').innerHTML = formatted;
      document.getElementById('studio-explanation-box').style.display = 'block';
    }
  } catch (err) {
    console.error('Explanation error:', err);
    alert('Failed to generate explanation. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = '💡 Explain in Plain English';
  }
}

async function generateHomeworkDraft() {
  const asg = state.activeStudioAssignment;
  if (!asg) return;

  const solutionType = document.getElementById('solution-type-select').value;
  const btn = document.getElementById('btn-generate-solution');
  btn.disabled = true;
  btn.textContent = 'Generating Solution Draft...';

  try {
    const res = await fetch('/api/classroom/ai-helper/generate-draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        title: asg.title,
        description: asg.description,
        courseName: asg.courseName,
        solutionType
      })
    });

    const data = await res.json();
    if (data.success && data.draftContent) {
      const textarea = document.getElementById('studio-editor-textarea');
      textarea.value = data.draftContent;
      document.getElementById('editor-char-count').textContent = `${data.draftContent.length} characters (Generated by AI)`;
      alert('Draft generated! You can now review and polish your answer directly in the editor.');
    }
  } catch (err) {
    console.error('Draft error:', err);
    alert('Failed to generate draft. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Generate Solution Draft';
  }
}

async function exportDraftAsPDF() {
  const asg = state.activeStudioAssignment;
  const content = document.getElementById('studio-editor-textarea').value.trim();

  if (!content) {
    alert('Please write or generate a draft solution before exporting.');
    return;
  }

  const btn = document.getElementById('btn-export-pdf');
  btn.disabled = true;
  btn.textContent = 'Generating PDF...';

  try {
    const res = await fetch('/api/classroom/ai-helper/export-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        title: asg.title,
        courseName: asg.courseName,
        content
      })
    });

    const data = await res.json();
    if (data.success) {
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      state.attachedHomeworkFile = {
        originalName: data.filename,
        downloadUrl: data.downloadUrl,
        filePath: data.filePath,
        size: content.length,
        mimeType: 'application/pdf'
      };

      updateReviewMetadata();
      alert(`PDF "${data.filename}" downloaded and attached ready for Classroom submission!`);
    }
  } catch (err) {
    console.error('PDF export error:', err);
    alert('Failed to export PDF.');
  } finally {
    btn.disabled = false;
    btn.textContent = '📥 Download PDF';
  }
}

async function attachCurrentDraftAndProceed() {
  const content = document.getElementById('studio-editor-textarea').value.trim();
  if (!content) {
    alert('Please enter or generate a draft solution before attaching.');
    return;
  }

  const asg = state.activeStudioAssignment;
  try {
    const res = await fetch('/api/classroom/ai-helper/export-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        title: asg.title,
        courseName: asg.courseName,
        content
      })
    });

    const data = await res.json();
    if (data.success) {
      state.attachedHomeworkFile = {
        originalName: data.filename,
        downloadUrl: data.downloadUrl,
        filePath: data.filePath,
        size: content.length,
        mimeType: 'application/pdf'
      };

      updateReviewMetadata();
      switchStudioTab('tab-submit');
    }
  } catch (err) {
    console.error('Attach error:', err);
    switchStudioTab('tab-submit');
  }
}

async function saveDraftOnly() {
  const asg = state.activeStudioAssignment;
  const draftContent = document.getElementById('studio-editor-textarea').value;

  try {
    const res = await fetch('/api/classroom/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        courseId: asg.courseId,
        courseName: asg.courseName,
        assignmentId: asg.id,
        assignmentTitle: asg.title,
        draftContent
      })
    });

    const data = await res.json();
    if (data.success) {
      alert('Draft saved safely to your profile.');
    }
  } catch (err) {
    console.error('Save draft error:', err);
    alert('Failed to save draft.');
  }
}

async function handleHomeworkFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('homeworkFile', file);

  try {
    const res = await fetch('/api/classroom/upload-homework', {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      state.attachedHomeworkFile = {
        originalName: data.file.originalName,
        downloadUrl: data.file.fileUrl,
        filePath: data.file.filePath,
        size: data.file.size,
        mimeType: data.file.mimeType
      };

      const statusBox = document.getElementById('uploaded-homework-status');
      const details = document.getElementById('uploaded-homework-details');
      details.innerHTML = `📎 <strong>${data.file.originalName}</strong> (${Math.round(data.file.size / 1024)} KB) — Ready for submission`;
      statusBox.style.display = 'block';

      updateReviewMetadata();
      alert(`File "${data.file.originalName}" uploaded and attached.`);
    }
  } catch (err) {
    console.error('Upload homework error:', err);
    alert('Failed to upload file.');
  }
}

function updateReviewMetadata() {
  const asg = state.activeStudioAssignment;
  if (!asg) return;

  document.getElementById('review-course-name').textContent = asg.courseName;
  document.getElementById('review-assignment-title').textContent = asg.title;

  const attachedField = document.getElementById('review-attached-file');
  if (state.attachedHomeworkFile) {
    attachedField.innerHTML = `📎 <a href="${state.attachedHomeworkFile.downloadUrl}" target="_blank" style="color: #0284c7; text-decoration: underline;">${state.attachedHomeworkFile.originalName}</a>`;
  } else {
    attachedField.textContent = 'None attached (Submission will turn in without additional files)';
  }
}

async function executeDirectTurnIn() {
  const asg = state.activeStudioAssignment;
  if (!asg) return;

  const confirmed = document.getElementById('studio-submit-confirm-checkbox').checked;
  if (!confirmed) {
    alert('Safety requirement: Please check the confirmation box before submitting.');
    return;
  }

  const btn = document.getElementById('studio-final-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Uploading to Drive & Turning In...';

  const banner = document.getElementById('submission-result-banner');
  banner.style.display = 'block';
  banner.style.background = '#f0f9ff';
  banner.style.color = '#0284c7';
  banner.innerHTML = '⏳ <strong>Submitting:</strong> Uploading homework file to Google Drive and turning in to Google Classroom...';

  try {
    const res = await fetch('/api/classroom/submit-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        courseId: asg.courseId,
        assignmentId: asg.id,
        submissionId: asg.submissionId,
        localFilePath: state.attachedHomeworkFile ? state.attachedHomeworkFile.filePath : null,
        fileName: state.attachedHomeworkFile ? state.attachedHomeworkFile.originalName : null,
        mimeType: state.attachedHomeworkFile ? state.attachedHomeworkFile.mimeType : null,
        confirmedByUser: true
      })
    });

    const data = await res.json();
    if (data.success) {
      banner.style.background = '#dcfce7';
      banner.style.color = '#15803d';
      banner.innerHTML = `
        ✅ <strong>Submission Confirmed!</strong><br>
        "${asg.title}" was turned in successfully on Google Classroom.<br>
        <span style="font-size: 11px;">Status: <strong>TURNED_IN</strong> | Mode: ${data.isDemo ? 'Demo Mode (Verified)' : 'Live Google Classroom'}</span>
      `;

      const statusBadge = document.getElementById('studio-status-badge');
      statusBadge.className = 'due-badge submitted';
      statusBadge.textContent = 'TURNED_IN';

      document.getElementById('btn-reclaim-assignment').style.display = 'inline-flex';
      await loadAssignments();
    } else {
      banner.style.background = '#fee2e2';
      banner.style.color = '#b91c1c';
      banner.innerHTML = `
        ❌ <strong>Submission Failed:</strong> ${data.message || 'API error'}<br>
        <span style="font-size: 11px;">${data.nextStep || 'Please check your permissions in Settings.'}</span>
      `;
    }
  } catch (err) {
    console.error('Submission error:', err);
    banner.style.background = '#fee2e2';
    banner.style.color = '#b91c1c';
    banner.innerHTML = `❌ <strong>Error:</strong> ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Turn In to Google Classroom';
  }
}

async function reclaimCurrentSubmission() {
  const asg = state.activeStudioAssignment;
  if (!asg) return;

  if (!confirm(`Are you sure you want to unsubmit / reclaim "${asg.title}" on Google Classroom?`)) {
    return;
  }

  const btn = document.getElementById('btn-reclaim-assignment');
  btn.disabled = true;
  btn.textContent = 'Unsubmitting...';

  try {
    const res = await fetch('/api/classroom/reclaim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        courseId: asg.courseId,
        assignmentId: asg.id,
        submissionId: asg.submissionId
      })
    });

    const data = await res.json();
    if (data.success) {
      alert('Assignment unsubmitted. You can now edit your homework and turn it in again.');
      btn.style.display = 'none';
      const statusBadge = document.getElementById('studio-status-badge');
      statusBadge.className = 'due-badge pending';
      statusBadge.textContent = 'RECLAIMED';
      await loadAssignments();
    }
  } catch (err) {
    console.error('Reclaim error:', err);
    alert('Failed to reclaim assignment.');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Unsubmit / Reclaim Assignment';
  }
}
