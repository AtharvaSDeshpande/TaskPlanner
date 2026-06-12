import cron from 'node-cron';
import { Assignment } from '../models/Assignment.js';
import { User } from '../models/User.js';
import { sendReminderEmail } from '../utils/email.js';
import { env } from '../config/env.js';

// Finds assignments whose due date falls within the next `leadHours` window
// and that have not yet had a reminder sent, then emails eligible students.
export async function runReminderSweep() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + env.reminderLeadHours * 60 * 60 * 1000);

  const due = await Assignment.find({
    dueAt: { $gte: now, $lte: windowEnd },
    reminderSentAt: null,
  }).populate('course', 'title');

  if (!due.length) return { assignments: 0, emails: 0 };

  let emails = 0;
  for (const assignment of due) {
    // Notify active students in the same organization & program; if the
    // assignment targets specific sections, only those students are emailed.
    const scope = {
      role: 'student',
      isActive: true,
      organization: assignment.organization,
      program: assignment.program,
    };
    if (assignment.sections.length) scope.section = { $in: assignment.sections };

    // eslint-disable-next-line no-await-in-loop
    const students = await User.find(scope);

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      students.map((student) => {
        emails += 1;
        return sendReminderEmail({
          name: student.name,
          email: student.email,
          title: assignment.title,
          course: assignment.course?.title || 'Course',
          dueAt: assignment.dueAt,
          loginUrl: env.clientUrl,
        });
      }),
    );

    assignment.reminderSentAt = new Date();
    // eslint-disable-next-line no-await-in-loop
    await assignment.save();
  }

  // eslint-disable-next-line no-console
  console.log(`[reminders] swept ${due.length} assignment(s), queued ${emails} email(s)`);
  return { assignments: due.length, emails };
}

// Runs every 15 minutes. Idempotent thanks to the reminderSentAt flag.
export function startReminderScheduler() {
  cron.schedule('*/15 * * * *', () => {
    runReminderSweep().catch((err) =>
      // eslint-disable-next-line no-console
      console.error('[reminders] sweep failed:', err.message),
    );
  });
  // eslint-disable-next-line no-console
  console.log(
    `[reminders] scheduler started (lead time ${env.reminderLeadHours}h, every 15 min)`,
  );
}
