import { env, isEmailConfigured } from '../config/env.js';

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

// Low-level dispatch to EmailJS. Never throws to the caller: when credentials
// are missing/dummy it logs the email instead, so local dev works end-to-end.
async function dispatch(templateId, params) {
  if (!isEmailConfigured || !templateId) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[email:dev] (EmailJS not configured — logging only)\n  to:      ${params.to_email}\n  subject: ${params.subject}\n  body:    ${params.message}\n`,
    );
    return { delivered: false, logged: true };
  }

  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: env.emailjs.serviceId,
        template_id: templateId,
        user_id: env.emailjs.publicKey,
        accessToken: env.emailjs.privateKey,
        template_params: { app_name: env.emailjs.fromName, ...params },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      // eslint-disable-next-line no-console
      console.error(`[email] EmailJS rejected "${params.subject}" → ${res.status}: ${detail}`);
      return { delivered: false, error: detail };
    }
    return { delivered: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] Failed to send "${params.subject}" to ${params.to_email}:`, err.message);
    return { delivered: false, error: err.message };
  }
}

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// ── Notification builders ────────────────────────────────────────────────────
// Each returns the dispatch result. template_params are documented in the README
// so EmailJS templates can render them (e.g. {{to_name}}, {{message}}, {{cta_url}}).

export function sendWelcomeEmail({ name, email, password, loginUrl }) {
  return dispatch(env.emailjs.templates.welcome, {
    to_email: email,
    to_name: name,
    subject: 'Your GLIM portal account is ready',
    message: `An account has been created for you. Email: ${email}. Temporary password: ${password}. Please sign in and change it.`,
    email,
    password,
    login_url: loginUrl,
    cta_url: loginUrl,
    cta_label: 'Open the portal',
  });
}

export function sendPasswordResetEmail({ name, email, password, loginUrl }) {
  return dispatch(env.emailjs.templates.reset, {
    to_email: email,
    to_name: name,
    subject: 'Your GLIM portal password has been reset',
    message: `Your password was reset by an administrator. New temporary password: ${password}. Please sign in and change it right away.`,
    email,
    password,
    login_url: loginUrl,
    cta_url: loginUrl,
    cta_label: 'Sign in',
  });
}

export function sendReminderEmail({ name, email, title, course, dueAt, loginUrl }) {
  return dispatch(env.emailjs.templates.reminder, {
    to_email: email,
    to_name: name,
    subject: `Reminder: "${title}" is due soon`,
    message: `Your assignment "${title}" (${course}) is due on ${fmtDate(dueAt)}.`,
    assignment_title: title,
    course,
    due_at: fmtDate(dueAt),
    cta_url: loginUrl,
    cta_label: 'View in portal',
  });
}

export function sendAssignmentEmail({ name, email, title, course, dueAt, program, loginUrl }) {
  return dispatch(env.emailjs.templates.assignment, {
    to_email: email,
    to_name: name,
    subject: `New assignment: ${title}`,
    message: `A new assignment "${title}" (${course}, ${program}) has been posted. It is due on ${fmtDate(dueAt)}.`,
    assignment_title: title,
    course,
    program,
    due_at: fmtDate(dueAt),
    cta_url: loginUrl,
    cta_label: 'View assignment',
  });
}

export function sendGroupAddedEmail({ name, email, groupName, addedBy, loginUrl }) {
  return dispatch(env.emailjs.templates.group, {
    to_email: email,
    to_name: name,
    subject: `You've been added to the group "${groupName}"`,
    message: `${addedBy} added you to the group "${groupName}". Open the portal to view the shared board.`,
    group_name: groupName,
    added_by: addedBy,
    cta_url: loginUrl,
    cta_label: 'Open group',
  });
}
