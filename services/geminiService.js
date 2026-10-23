/**
 * AI Student Assistant - Gemini AI Service
 * Powered by Google Gemini SDK (@google/genai).
 * Provides conversational study help, notes summarization, flashcards/MCQ generation,
 * and smart schedule synthesis.
 */

const { GoogleGenAI } = require('@google/genai');

const isGeminiConfigured = () => {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && !key.includes('your_gemini_api_key') && key.trim().length > 10);
};

const getGenAIClient = () => {
  if (!isGeminiConfigured()) return null;
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

/**
 * Conversational Assistant for student inquiries & voice commands
 */
const chatWithAssistant = async ({ message, context = {}, history = [] }) => {
  const ai = getGenAIClient();

  const systemInstruction = `You are "Aura", a warm, empathetic, encouraging, and highly intelligent AI student companion and voice assistant.
Your goal is to help college and university students excel without stress.
Guidelines:
- Explain difficult concepts using intuitive real-world analogies, step-by-step clarity, and student-friendly language.
- Format structured answers with clean Markdown headings, bullet points, and code blocks where relevant.
- When assisting with assignments, provide conceptual outlines, explanations, pseudocode, and learning scaffolds rather than outright plagiarism.
- Keep spoken or voice-intended responses succinct, warm, and natural.
- Context provided (active assignments, courses, uploaded notes): ${JSON.stringify(context)}
`;

  if (!ai) {
    // Intelligent fallback when GEMINI_API_KEY is not yet populated
    return generateFallbackChatResponse(message, context);
  }

  try {
    const formattedPrompt = `${systemInstruction}\n\nStudent asks: "${message}"`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: formattedPrompt
    });

    return {
      success: true,
      isDemo: false,
      reply: response.text || 'I understood that! How else can I assist your study session today?'
    };
  } catch (error) {
    console.error('[Gemini API Error - chatWithAssistant]:', error.message);
    return {
      success: true,
      isDemo: true,
      reply: `[AI Service Notice: Encountered API error: ${error.message} - displaying local study response]\n\n` +
             generateFallbackChatResponse(message, context).reply
    };
  }
};

/**
 * Summarize uploaded study material (PDF, PPTX, TXT)
 */
const summarizeStudyNotes = async (extractedText, filename = 'document') => {
  const ai = getGenAIClient();

  if (!ai) {
    return generateFallbackSummary(extractedText, filename);
  }

  const prompt = `Analyze the following academic study material from file "${filename}".
Extract and organize the content into:
1. "summary": A concise, clear 2-3 paragraph overview of the core subject.
2. "keyConcepts": A list of 4 to 8 fundamental concepts or definitions explained.
3. "formulas": A list of mathematical, algorithmic, or theoretical formulas/equations (if any).
4. "pageOrSlideReferences": Key section markers or slide titles mentioned.

Format your output strictly as a valid JSON object matching this schema:
{
  "summary": "string",
  "keyConcepts": ["string"],
  "formulas": ["string"],
  "pageOrSlideReferences": ["string"]
}

Study material content:
${extractedText.substring(0, 15000)}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text);
    return {
      success: true,
      isDemo: false,
      data: parsed
    };
  } catch (error) {
    console.error('[Gemini API Error - summarizeStudyNotes]:', error.message);
    return generateFallbackSummary(extractedText, filename);
  }
};

/**
 * Generate Flashcards and MCQs with clear practice disclaimers
 */
const generatePracticeQuestions = async (text, topic = 'General') => {
  const ai = getGenAIClient();

  if (!ai) {
    return generateFallbackPracticeQuestions(topic);
  }

  const prompt = `Generate high-yield self-study revision material for a student on the topic "${topic}".
Include:
1. 4 Flashcards with question and answer.
2. 3 Multiple Choice Questions (MCQs), each with:
   - "question": string
   - "options": array of 4 distinct choices
   - "correctAnswer": exact matching string of the correct choice
   - "explanation": brief pedagogical rationale why this answer is correct.

Output strictly valid JSON with this schema:
{
  "flashcards": [
    { "question": "string", "answer": "string", "topic": "string" }
  ],
  "practiceQuestions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}

Source text to draw questions from:
${text.substring(0, 10000)}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text);
    return {
      success: true,
      isDemo: false,
      disclaimer: 'Note: These flashcards and practice questions are AI-generated for self-study and revision, and are not official examination questions.',
      data: parsed
    };
  } catch (error) {
    console.error('[Gemini API Error - generatePracticeQuestions]:', error.message);
    return generateFallbackPracticeQuestions(topic);
  }
};

/**
 * Smart Study Planner Algorithm
 */
const createSmartStudyPlan = async (assignments, userPreferences = {}) => {
  const dailyHours = userPreferences.dailyStudyHours || 3;
  const ai = getGenAIClient();

  const pendingAssignments = (assignments || []).filter(
    (a) => a.category === 'pending' || a.category === 'overdue'
  );

  if (!ai || pendingAssignments.length === 0) {
    return generateFallbackStudyPlan(pendingAssignments, dailyHours);
  }

  const prompt = `Act as an expert academic scheduler. Given the following list of pending assignments with their due dates:
${JSON.stringify(pendingAssignments, null, 2)}

And the student's daily study capacity: ${dailyHours} hours/day.

Create a balanced, stress-minimizing study schedule for the next 7 days.
Prioritize:
- Urgent deadlines (due tomorrow or overdue) must be scheduled today.
- Heavy conceptual projects should be broken down into manageable 45-60 minute chunks.
- Distribute workload evenly across days.

Return strictly valid JSON matching this schema:
{
  "title": "Smart AI Study Schedule",
  "notes": "Advice and pacing recommendation for the week",
  "tasks": [
    {
      "title": "Task title (e.g., Review Dijkstra notes & pseudocode)",
      "description": "Specific focus item",
      "courseName": "Course name",
      "courseId": "string",
      "assignmentId": "string",
      "scheduledDate": "YYYY-MM-DD",
      "estimatedMinutes": 45,
      "priority": "high | medium | low"
    }
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text);
    return {
      success: true,
      isDemo: false,
      data: parsed
    };
  } catch (error) {
    console.error('[Gemini API Error - createSmartStudyPlan]:', error.message);
    return generateFallbackStudyPlan(pendingAssignments, dailyHours);
  }
};

// Fallback generators for instant development preview when keys are not yet configured
const generateFallbackChatResponse = (message, context) => {
  const lower = (message || '').toLowerCase();

  if (lower.includes('pending') || lower.includes('due') || lower.includes('assignment')) {
    return {
      success: true,
      isDemo: true,
      reply: "Here is your assignment overview:\n\n• **Problem Set 4: Dijkstra & A* Pathfinding** is due **tomorrow at 11:59 PM** (High Priority).\n• **Mini-Project: Fine-Tuning Sentiment Classifier** is due in **3 days**.\n• **Lab 5: Express REST API** is currently marked overdue.\n\nWould you like me to generate a focused study breakdown for Dijkstra & A* Pathfinding?"
    };
  }

  if (lower.includes('plan') || lower.includes('schedule')) {
    return {
      success: true,
      isDemo: true,
      reply: "I've structured a recommended study plan for you in the **Smart Study Planner** tab! We prioritized Dijkstra's algorithm for tonight (45 mins) and LoRA fine-tuning for tomorrow evening. You can check off tasks as you finish them!"
    };
  }

  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does')) {
    return {
      success: true,
      isDemo: true,
      reply: `Here is a clear, intuitive explanation:\n\n### Core Concept\nThink of complex systems like building with modular blocks. When solving graph pathfinding (like Dijkstra's algorithm), imagine exploring roads starting from your home. You always inspect the closest, cheapest road first, expanding outward like ripples on water until you hit your destination.\n\n**Key Takeaway**: Dijkstra uses a greedy approach with a priority queue (min-heap) guaranteeing the shortest path in $O((V + E) \\log V)$ time for positive edge weights.\n\nWould you like a code snippet or visual analogy next?`
    };
  }

  return {
    success: true,
    isDemo: true,
    reply: `Hello! I am Aura, your AI study assistant. I can help organize your Google Classroom deadlines, explain tough lecture concepts, summarize lecture slides, generate flashcards, and guide your daily study plan.\n\n*(Tip: Add your \`GEMINI_API_KEY\` in your \`.env\` file for full real-time generative AI intelligence!)*`
  };
};

const generateFallbackSummary = (text, filename) => ({
  success: true,
  isDemo: true,
  data: {
    summary: `This document ("${filename}") covers foundational principles, structural architectures, and methodological workflows. Key emphasis is placed on optimization techniques, algorithmic efficiency, and practical design patterns.`,
    keyConcepts: [
      'Asymptotic Complexity and Graph Traversals',
      'Priority Queues & Binary Heap Invariants',
      'Optimal Substructure & Greedy Choice Property',
      'Error Handling & State Validation Patterns'
    ],
    formulas: [
      'Time Complexity: T(V, E) = O((V + E) log V)',
      'Heap Invariant: Parent(i) <= Child(i)',
      'Path Cost Function: f(n) = g(n) + h(n)'
    ],
    pageOrSlideReferences: [
      'Section 1: Foundations & Definitions (Slides 1-5)',
      'Section 2: Core Algorithm Mechanics (Slides 6-18)',
      'Section 3: Empirical Complexity & Benchmarks (Slides 19-24)'
    ]
  }
});

const generateFallbackPracticeQuestions = (topic) => ({
  success: true,
  isDemo: true,
  disclaimer: 'Note: These flashcards and practice questions are AI-generated for self-study and revision, and are not official examination questions.',
  data: {
    flashcards: [
      {
        question: 'What is the primary condition required for Dijkstra\'s algorithm to guarantee shortest paths?',
        answer: 'All edge weights must be non-negative (>= 0). For negative edge weights, Bellman-Ford or SPFA must be used.',
        topic
      },
      {
        question: 'What is the purpose of an admissible heuristic in the A* search algorithm?',
        answer: 'An admissible heuristic never overestimates the actual cost to reach the goal, guaranteeing optimal solutions.',
        topic
      },
      {
        question: 'What data structure yields an O((V + E) log V) time complexity for Dijkstra?',
        answer: 'A Min-Binary Heap or Priority Queue.',
        topic
      }
    ],
    practiceQuestions: [
      {
        question: 'Which of the following data structures is optimal for implementing the extract-min operation in Dijkstra\'s algorithm?',
        options: ['Binary Search Tree', 'Min-Heap (Priority Queue)', 'Stack', 'Circular Queue'],
        correctAnswer: 'Min-Heap (Priority Queue)',
        explanation: 'A min-heap permits retrieving the unvisited vertex with minimum distance in O(log V) time.'
      },
      {
        question: 'What happens if Dijkstra\'s algorithm is executed on a graph containing negative edge cycles?',
        options: [
          'It terminates normally with correct answers',
          'It gets stuck in an infinite loop or computes incorrect shortest paths',
          'It automatically converts negative cycles to positive',
          'It defaults to Depth-First Search'
        ],
        correctAnswer: 'It gets stuck in an infinite loop or computes incorrect shortest paths',
        explanation: 'Negative cycles allow paths to decrease indefinitely in cost, violating Dijkstra\'s greedy non-decreasing assumption.'
      }
    ]
  }
});

const generateFallbackStudyPlan = (assignments, dailyHours) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const dayAfter = new Date();
  dayAfter.setDate(today.getDate() + 2);

  return {
    success: true,
    isDemo: true,
    data: {
      title: 'Balanced Weekly Academic Study Plan',
      notes: `Structured for an estimated capacity of ${dailyHours} hours/day. Focus on upcoming deadlines first.`,
      tasks: [
        {
          title: 'Review Problem Set 4: Dijkstra & A* Specification',
          description: 'Read problem requirements, write graph node & edge data structures.',
          courseName: 'CS 301: Advanced Data Structures & Algorithms',
          courseId: 'demo-cs301',
          assignmentId: 'demo-asg-1',
          scheduledDate: today.toISOString().split('T')[0],
          estimatedMinutes: 50,
          priority: 'high',
          isCompleted: false
        },
        {
          title: 'Implement Dijkstra Priority Queue Traversal',
          description: 'Code the core loop using a binary min-heap and edge relaxation logic.',
          courseName: 'CS 301: Advanced Data Structures & Algorithms',
          courseId: 'demo-cs301',
          assignmentId: 'demo-asg-1',
          scheduledDate: today.toISOString().split('T')[0],
          estimatedMinutes: 60,
          priority: 'high',
          isCompleted: false
        },
        {
          title: 'Review LoRA Fine-Tuning Tutorial Notebook',
          description: 'Setup training parameters, rank r, alpha, and target modules.',
          courseName: 'AI 204: Machine Learning & Intelligent Agents',
          courseId: 'demo-ai204',
          assignmentId: 'demo-asg-2',
          scheduledDate: tomorrow.toISOString().split('T')[0],
          estimatedMinutes: 45,
          priority: 'medium',
          isCompleted: false
        },
        {
          title: 'Express JWT Authorization & Role Verification',
          description: 'Resolve overdue Lab 5 submission by testing bearer token extraction.',
          courseName: 'WT 201: Modern Web Technologies & Cloud Architectures',
          courseId: 'demo-wt201',
          assignmentId: 'demo-asg-3',
          scheduledDate: dayAfter.toISOString().split('T')[0],
          estimatedMinutes: 40,
          priority: 'high',
          isCompleted: false
        }
      ]
    }
  };
};

/**
 * Explain an assignment question in simple student-friendly language
 */
const explainAssignmentQuestion = async ({ title, description, courseName }) => {
  const ai = getGenAIClient();

  if (!ai) {
    return {
      success: true,
      isDemo: true,
      explanation: `### 💡 Assignment Overview: ${title}\n\n` +
        `**Course:** ${courseName || 'General'}\n\n` +
        `#### What this question is really asking:\n` +
        `In simple terms, your professor wants you to demonstrate mastery of the underlying theoretical concepts and show how you apply them systematically.\n\n` +
        `#### Key Objectives to Target:\n` +
        `1. **Core Mechanism:** Clearly define the foundational principles involved (e.g. state management, algorithm invariants, or architectural constraints).\n` +
        `2. **Methodology:** Break down your solution step by step. Explain *why* you chose this approach over alternatives.\n` +
        `3. **Verification:** Include benchmarks, test cases, or complexity analysis showing how your solution handles edge cases.\n\n` +
        `#### Recommended Next Steps:\n` +
        `Use the **"Generate Solution / Report Draft"** button below to generate a tailored outline, and then polish it with your personal observations!`
    };
  }

  const prompt = `Act as an expert academic tutor. A college student needs help understanding their homework assignment.
Assignment Title: "${title}"
Course: "${courseName || 'General'}"
Instructions & Description:
"${description || 'No detailed instructions provided.'}"

Please provide a clear, student-friendly explanation in clean Markdown:
1. ### 💡 Plain English Breakdown: What this assignment is actually asking for.
2. ### 🎯 What the Instructor is Looking For: Key concepts, grading criteria, and expectations.
3. ### 🗺️ Step-by-Step Roadmap: A numbered plan to complete the assignment efficiently.
4. ### ⚠️ Common Pitfalls: Typical mistakes or edge cases to avoid.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return {
      success: true,
      isDemo: false,
      explanation: response.text
    };
  } catch (err) {
    console.error('[Gemini Error - explainAssignmentQuestion]:', err.message);
    return {
      success: true,
      isDemo: true,
      explanation: `### 💡 Assignment Overview: ${title}\n\n` +
        `**Course:** ${courseName || 'General'}\n\n` +
        `#### What this question is asking:\n` +
        `${description || 'Review the assignment instructions and implement the required components.'}\n\n` +
        `#### Suggested Action Steps:\n` +
        `1. Formulate your solution structure.\n` +
        `2. Draft your explanation or code implementation.\n` +
        `3. Test edge cases and export to PDF before submitting.`
    };
  }
};

/**
 * Generate a complete homework draft (report, code solution, or derivation)
 */
const generateAssignmentSolution = async ({ title, description, courseName, solutionType = 'report', studentNotes = '' }) => {
  const ai = getGenAIClient();

  if (!ai) {
    return generateFallbackSolution(title, description, courseName, solutionType);
  }

  let promptGuidance = '';
  if (solutionType === 'code') {
    promptGuidance = 'Format the solution primarily as well-documented, clean, modular code with comments, complexity analysis, and unit test examples.';
  } else if (solutionType === 'derivation') {
    promptGuidance = 'Format the solution with step-by-step mathematical or logical derivations, formulas, definitions, and rigorous proof sketches.';
  } else {
    promptGuidance = 'Format the solution as a formal academic submission report, with an Introduction, Theoretical Foundation, Solution / Methodology, Results & Discussion, and Conclusion.';
  }

  const prompt = `You are helping a college student prepare an assignment submission.
Assignment Title: "${title}"
Course: "${courseName || 'College Course'}"
Assignment Instructions:
"${description || 'Solve and provide complete solution.'}"

Student's notes or specific requests:
"${studentNotes || 'Provide a thorough and clear solution.'}"

Task:
${promptGuidance}
The output should be a complete, high-quality, polished draft that the student can review, edit, and turn in. Use Markdown formatting.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return {
      success: true,
      isDemo: false,
      solutionType,
      draftContent: response.text
    };
  } catch (err) {
    console.error('[Gemini Error - generateAssignmentSolution]:', err.message);
    return generateFallbackSolution(title, description, courseName, solutionType);
  }
};

const generateFallbackSolution = (title, description, courseName, solutionType) => {
  let draft = '';

  if (solutionType === 'code') {
    draft = `# Solution Implementation: ${title}
Course: ${courseName}
Author: Student

## 1. Problem Overview
${description || 'Implementation of algorithmic requirements specified in assignment.'}

## 2. Core Implementation
\`\`\`javascript
/**
 * Optimized Algorithmic Solution
 * Time Complexity: O((V + E) log V)
 * Space Complexity: O(V)
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }
  push(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }
  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].cost <= this.heap[idx].cost) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }
  _sinkDown(idx) {
    const len = this.heap.length;
    while (true) {
      let left = 2 * idx + 1;
      let right = 2 * idx + 2;
      let smallest = idx;
      if (left < len && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
      if (right < len && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
  isEmpty() {
    return this.heap.length === 0;
  }
}

function solvePathfinding(graph, startNode, endNode) {
  const distances = {};
  const previous = {};
  const pq = new MinHeap();

  for (const node in graph) {
    distances[node] = Infinity;
  }
  distances[startNode] = 0;
  pq.push({ node: startNode, cost: 0 });

  while (!pq.isEmpty()) {
    const { node, cost } = pq.pop();
    if (cost > distances[node]) continue;
    if (node === endNode) break;

    for (const neighbor of graph[node] || []) {
      const newDist = cost + neighbor.weight;
      if (newDist < distances[neighbor.node]) {
        distances[neighbor.node] = newDist;
        previous[neighbor.node] = node;
        pq.push({ node: neighbor.node, cost: newDist });
      }
    }
  }

  // Reconstruct path
  const path = [];
  let curr = endNode;
  while (curr) {
    path.unshift(curr);
    curr = previous[curr];
  }
  return { distance: distances[endNode], path };
}
\`\`\`

## 3. Complexity & Empirical Benchmarking
- **Time Complexity:** With Fibonacci / Binary Min-Heap, priority updates execute in O(log V) time, resulting in overall O((V + E) log V).
- **Space Complexity:** O(V) to store distance tables and the heap.
`;
  } else {
    draft = `# Academic Submission: ${title}
Course: ${courseName}
Date: ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}

## Abstract
This report presents a comprehensive investigation and formal solution for "${title}". We analyze the underlying constraints, propose an optimized methodology, and discuss theoretical and empirical results.

## 1. Introduction & Problem Statement
${description || 'This assignment investigates key theoretical principles and practical design patterns within the discipline.'}
The objective is to establish an optimal approach meeting all functional constraints while preserving clarity, modularity, and correctness.

## 2. Theoretical Background
Key principles evaluated include:
- Structural invariants and boundary condition handling.
- Computational trade-offs between asymptotic efficiency and memory footprint.
- Robust verification against adversarial or degenerate test cases.

## 3. Proposed Methodology & Solution
Our implementation adheres to best academic practices:
1. **Decomposition:** The problem is broken down into modular sub-problems.
2. **Invariant Preservation:** At each step, correctness properties are mathematically verified.
3. **Error Handling:** Inputs are strictly validated to prevent undefined states.

## 4. Evaluation & Results
All automated test scenarios successfully concluded within the required thresholds. Asymptotic runtime matches theoretical bounds.

## 5. Conclusion
The proposed solution fully satisfies all assignment specifications with optimal complexity and clarity.
`;
  }

  return {
    success: true,
    isDemo: true,
    solutionType,
    draftContent: draft
  };
};

module.exports = {
  chatWithAssistant,
  summarizeStudyNotes,
  generatePracticeQuestions,
  createSmartStudyPlan,
  explainAssignmentQuestion,
  generateAssignmentSolution,
  isGeminiConfigured
};
