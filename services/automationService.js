/**
 * AI Student Assistant - Background Automation & Persistent Scheduler Service
 * Powered by node-cron with timezone support (Asia/Kolkata).
 * Operates 24/7 on the server independent of user browser or IDE state.
 */

const cron = require('node-cron');
const User = require('../models/User');
const { AutomationTask, Reminder } = require('../models/AutomationTask');
const classroomService = require('./classroomService');
const geminiService = require('./geminiService');
const StudyPlan = require('../models/StudyPlan');

const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

// Registered Cron Jobs Registry for Monitoring
const activeJobs = [];

/**
 * Initialize all persistent background scheduled tasks
 */
const initScheduler = () => {
  console.log(`[Scheduler] Initializing persistent automation engine (Timezone: ${DEFAULT_TIMEZONE})...`);

  // 1. Google Classroom Synchronization Worker (Runs every 30 minutes)
  const syncJob = cron.schedule(
    '*/30 * * * *',
    async () => {
      console.log('[Scheduler] Executing periodic Google Classroom synchronization job...');
      await runClassroomSyncJob();
    },
    {
      timezone: DEFAULT_TIMEZONE
    }
  );

  activeJobs.push({
    name: 'classroom_sync',
    cronExpression: '*/30 * * * *',
    description: 'Periodic Google Classroom coursework state sync',
    timezone: DEFAULT_TIMEZONE,
    jobInstance: syncJob
  });

  // 2. Deadline Scanner & Smart Reminder Worker (Runs every hour at minute 0)
  const deadlineJob = cron.schedule(
    '0 * * * *',
    async () => {
      console.log('[Scheduler] Executing deadline scanner and reminder generation job...');
      await runDeadlineScanJob();
    },
    {
      timezone: DEFAULT_TIMEZONE
    }
  );

  activeJobs.push({
    name: 'deadline_scan',
    cronExpression: '0 * * * *',
    description: 'Detects assignments due within 24h/12h and creates deduped reminders',
    timezone: DEFAULT_TIMEZONE,
    jobInstance: deadlineJob
  });

  // 3. Daily Study Plan Maintenance (Runs every night at 02:00 AM IST)
  const planMaintenanceJob = cron.schedule(
    '0 2 * * *',
    async () => {
      console.log('[Scheduler] Executing nightly study plan review and maintenance job...');
      await runStudyPlanMaintenanceJob();
    },
    {
      timezone: DEFAULT_TIMEZONE
    }
  );

  activeJobs.push({
    name: 'study_plan_refresh',
    cronExpression: '0 2 * * *',
    description: 'Updates task priorities based on remaining days to deadline',
    timezone: DEFAULT_TIMEZONE,
    jobInstance: planMaintenanceJob
  });

  console.log(`[Scheduler] Active jobs initialized: ${activeJobs.length} scheduled workers running.`);
};

/**
 * Background Job 1: Classroom Sync
 */
const runClassroomSyncJob = async () => {
  const startTime = Date.now();
  let syncedUsersCount = 0;
  let errors = [];

  try {
    // Find users with Classroom access authorized
    const users = await User.find({
      classroomAuthorized: true,
      'googleTokens.access_token': { $ne: null }
    });

    for (const user of users) {
      try {
        const assignmentsData = await classroomService.getAssignments(user);
        syncedUsersCount++;
      } catch (userErr) {
        // Token might be revoked or expired; record error without breaking other users
        errors.push({ userId: user._id, error: userErr.message });
      }
    }

    await AutomationTask.create({
      jobName: 'classroom_sync',
      status: errors.length > 0 && syncedUsersCount === 0 ? 'failed' : 'success',
      timezone: DEFAULT_TIMEZONE,
      durationMs: Date.now() - startTime,
      details: {
        syncedUsersCount,
        errorCount: errors.length
      },
      error: errors.length > 0 ? JSON.stringify(errors) : null
    });
  } catch (err) {
    console.error('[Scheduler Error - classroom_sync]:', err);
    await AutomationTask.create({
      jobName: 'classroom_sync',
      status: 'failed',
      timezone: DEFAULT_TIMEZONE,
      durationMs: Date.now() - startTime,
      error: err.message
    });
  }
};

/**
 * Background Job 2: Deadline Scanner & Smart Reminders
 */
const runDeadlineScanJob = async () => {
  const startTime = Date.now();
  let remindersCreated = 0;

  try {
    const users = await User.find({});
    const now = new Date();

    for (const user of users) {
      try {
        const { assignments } = await classroomService.getAssignments(user);
        const pending = (assignments || []).filter(
          (a) => a.category === 'pending' || a.category === 'overdue'
        );

        for (const asg of pending) {
          if (!asg.dueDate) continue;
          const due = new Date(asg.dueDate);
          const diffMs = due - now;
          const diffHours = diffMs / (1000 * 60 * 60);

          let reminderType = null;
          let message = '';

          if (diffHours < 0) {
            reminderType = 'overdue';
            message = `⚠️ Overdue Notice: "${asg.title}" for ${asg.courseName} was due on ${due.toLocaleDateString()}.`;
          } else if (diffHours <= 12) {
            reminderType = '12_hours_before';
            message = `🚨 Urgent Deadline: "${asg.title}" is due in less than 12 hours (${due.toLocaleTimeString()}).`;
          } else if (diffHours <= 24) {
            reminderType = '24_hours_before';
            message = `⏰ Reminder: "${asg.title}" for ${asg.courseName} is due tomorrow at ${due.toLocaleTimeString()}.`;
          }

          if (reminderType) {
            const dedupKey = `${user._id}_${asg.id}_${reminderType}`;
            try {
              await Reminder.create({
                userId: user._id,
                courseId: asg.courseId,
                courseName: asg.courseName,
                assignmentId: asg.id,
                assignmentTitle: asg.title,
                dueDate: due,
                reminderType,
                dedupKey,
                message
              });
              remindersCreated++;
            } catch (dupErr) {
              // E11000 duplicate key error means reminder was already recorded; safely ignore
            }
          }
        }
      } catch (asgErr) {
        console.warn(`[Scheduler] Could not scan deadlines for user ${user._id}:`, asgErr.message);
      }
    }

    await AutomationTask.create({
      jobName: 'deadline_scan',
      status: 'success',
      timezone: DEFAULT_TIMEZONE,
      durationMs: Date.now() - startTime,
      details: { remindersCreated }
    });
  } catch (err) {
    console.error('[Scheduler Error - deadline_scan]:', err);
    await AutomationTask.create({
      jobName: 'deadline_scan',
      status: 'failed',
      timezone: DEFAULT_TIMEZONE,
      durationMs: Date.now() - startTime,
      error: err.message
    });
  }
};

/**
 * Background Job 3: Nightly Study Plan Refresh
 */
const runStudyPlanMaintenanceJob = async () => {
  const startTime = Date.now();
  try {
    const plans = await StudyPlan.find({});
    for (const plan of plans) {
      // Recalculate priorities based on urgency
      const now = new Date();
      for (const task of plan.tasks) {
        if (!task.isCompleted && task.dueDate) {
          const diffDays = (new Date(task.dueDate) - now) / (1000 * 60 * 60 * 24);
          if (diffDays <= 1) {
            task.priority = 'high';
          }
        }
      }
      await plan.save();
    }

    await AutomationTask.create({
      jobName: 'study_plan_refresh',
      status: 'success',
      timezone: DEFAULT_TIMEZONE,
      durationMs: Date.now() - startTime,
      details: { plansReviewed: plans.length }
    });
  } catch (err) {
    console.error('[Scheduler Error - study_plan_refresh]:', err);
  }
};

/**
 * Get Scheduler Status, Active Workers, and Recent Execution Logs
 */
const getAutomationStatus = async () => {
  const recentLogs = await AutomationTask.find({})
    .sort({ executedAt: -1 })
    .limit(10);

  return {
    schedulerActive: true,
    timezone: DEFAULT_TIMEZONE,
    totalJobsConfigured: activeJobs.length,
    jobs: activeJobs.map((j) => ({
      name: j.name,
      cronExpression: j.cronExpression,
      description: j.description,
      timezone: j.timezone
    })),
    recentExecutions: recentLogs
  };
};

module.exports = {
  initScheduler,
  runClassroomSyncJob,
  runDeadlineScanJob,
  getAutomationStatus,
  DEFAULT_TIMEZONE
};
