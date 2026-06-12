import { useMemo } from 'react';
import { config } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom Seq-style structured logger (browser).
//
// Each event is shaped as CLEF (the JSON Seq ingests): { "@t", "@l", "@mt",
// "@m", "@x", ...properties }. Events go to the dev console AND are batched to
// the backend (`POST /api/logs`), which appends them to the same session file
// as the server logs — so a single error is traceable across the stack. Swap
// the sink to a live Seq server later by enabling SEQ_URL on the backend.
//
//   import { logger } from './logger/logger.jsx';
//   logger.info('User {userId} created course {code}', { userId, code });
//   logger.error('Save failed for {url}', { url, status, err });   // err → @x
//   const log = logger.child({ Source: 'TodosPage' }); log.warn('…', {});
// ─────────────────────────────────────────────────────────────────────────────

const LEVELS = { Verbose: 0, Debug: 1, Information: 2, Warning: 3, Error: 4, Fatal: 5 };
const CONSOLE_FN = {
  Verbose: 'debug',
  Debug: 'debug',
  Information: 'info',
  Warning: 'warn',
  Error: 'error',
  Fatal: 'error',
};
const BADGE = {
  Verbose: 'background:#64748b',
  Debug: 'background:#0891b2',
  Information: 'background:#16a34a',
  Warning: 'background:#d97706',
  Error: 'background:#dc2626',
  Fatal: 'background:#7f1d1d',
};

const MIN_LEVEL = LEVELS[config.logging.level] ?? LEVELS.Debug;
const SESSION_ID =
  (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
  `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const BASE = {
  Environment: config.appEnv,
  Application: 'glim-web',
  AppVersion: config.logging.appVersion,
  SessionId: SESSION_ID,
};

let userContext = {}; // { UserId, UserEmail, Role, OrgDomain } — set on login

// ── Remote sink: batched, non-blocking, never throws ────────────────────────
let buffer = [];
let flushTimer = null;

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!config.logging.remote || buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  // Plain fetch (NOT axios) so shipping logs never re-enters the API logger.
  fetch(config.logging.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {
    /* dropping a log batch must never break the app */
  });
}

function scheduleFlush(immediate) {
  if (immediate) return flush();
  if (!flushTimer) flushTimer = setTimeout(flush, 3000);
}

function render(template, props) {
  return String(template).replace(/\{@?(\w+)\}/g, (m, key) =>
    props[key] !== undefined ? String(props[key]) : m,
  );
}

function emit(level, template, properties, context) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const props = { ...context, ...properties };
  let exception;
  for (const key of ['err', 'error', 'exception']) {
    if (props[key] instanceof Error) {
      exception = props[key];
      props.ExceptionType = exception.name;
      props.ExceptionMessage = exception.message;
      delete props[key];
      break;
    }
  }

  const rendered = render(template, props);
  const event = {
    '@t': new Date().toISOString(),
    '@l': level,
    '@mt': template,
    '@m': rendered,
    ...(exception ? { '@x': exception.stack || String(exception) } : {}),
    ...BASE,
    ...userContext,
    ...props,
  };

  // Console sink — coloured badge + the structured event for inspection.
  const fn = console[CONSOLE_FN[level]] || console.log;
  fn(
    `%c ${level.slice(0, 3).toUpperCase()} %c ${rendered}`,
    `${BADGE[level]};color:#fff;border-radius:3px;padding:1px 4px;font-size:10px`,
    'color:inherit',
    exception || props,
  );

  // Remote sink — flush errors immediately, batch everything else.
  buffer.push(event);
  scheduleFlush(LEVELS[level] >= LEVELS.Error);
}

function makeLogger(context = {}) {
  const at = (level) => (template, properties = {}) => emit(level, template, properties, context);
  return {
    verbose: at('Verbose'),
    debug: at('Debug'),
    info: at('Information'),
    warn: at('Warning'),
    error: at('Error'),
    fatal: at('Fatal'),
    child: (extra) => makeLogger({ ...context, ...extra }),
  };
}

export const logger = {
  ...makeLogger(),
  sessionId: SESSION_ID,
  // Identify the signed-in user so every subsequent event is attributable.
  setUser(user) {
    userContext = user
      ? {
          UserId: user.id,
          UserEmail: user.email,
          Role: user.role,
          OrgDomain: user.organization?.domain,
        }
      : {};
  },
  clearUser() {
    userContext = {};
  },
  flush,
};

// Attaches global error handlers + a best-effort flush on page hide. Call once
// at startup (main.jsx).
export function initLogger() {
  logger.info('Logger initialised · env={Environment} · level={Level} · session={SessionId}', {
    Environment: config.appEnv,
    Level: config.logging.level,
    SessionId: SESSION_ID,
  });

  window.addEventListener('error', (e) => {
    logger.error('Uncaught error: {Message}', {
      Message: e.message,
      Source: e.filename,
      Line: e.lineno,
      err: e.error instanceof Error ? e.error : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    logger.error('Unhandled promise rejection: {Message}', {
      Message: reason?.message || String(reason),
      err: reason instanceof Error ? reason : undefined,
    });
  });
  // Flush remaining logs when the tab is hidden/closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

// Convenience hook — returns a logger scoped to a component/source.
export function useLogger(source) {
  return useMemo(() => (source ? logger.child({ Source: source }) : logger), [source]);
}
