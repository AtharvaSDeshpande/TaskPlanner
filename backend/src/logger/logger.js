import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Structured, Seq-style logger.
//
// Every event is emitted as a CLEF line (Compact Log Event Format — the JSON
// shape Seq ingests): { "@t", "@l", "@mt", "@m", "@x", ...properties }. For now
// the sink is a per-process session file under `backend/logger/`; pointing this
// at a live Seq server later is a one-line change (see forwardToSeq below).
//
// Usage:
//   import { logger } from './logger/logger.js';
//   logger.info('User {userId} created course {code}', { userId, code });
//   logger.error('Login failed for {email}', { email, err });   // err → @x stack
//   const log = logger.child({ RequestId: id }); log.warn('Slow {ms}ms', { ms });
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
// ANSI colours for dev console readability (disabled in production).
const COLOR = {
  Verbose: '\x1b[90m',
  Debug: '\x1b[36m',
  Information: '\x1b[32m',
  Warning: '\x1b[33m',
  Error: '\x1b[31m',
  Fatal: '\x1b[41m\x1b[37m',
};
const RESET = '\x1b[0m';

const minLevelName = process.env.LOG_LEVEL || (env.isProd ? 'Information' : 'Debug');
const MIN_LEVEL = LEVELS[minLevelName] ?? LEVELS.Debug;

// ── Session file sink ────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logger'); // backend/logger
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
export const sessionFile = path.join(LOG_DIR, `session-${stamp}.log`);

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  /* directory creation is best-effort */
}

function appendToFile(line) {
  fs.appendFile(sessionFile, `${line}\n`, () => {});
}

// Future Seq sink — flip on by setting SEQ_URL. CLEF posts directly to Seq's
// raw events endpoint, so `event` needs no transformation.
const SEQ_URL = process.env.SEQ_URL || '';
function forwardToSeq(line) {
  if (!SEQ_URL) return;
  fetch(`${SEQ_URL.replace(/\/$/, '')}/api/events/raw?clef`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.serilog.clef',
      ...(process.env.SEQ_API_KEY ? { 'X-Seq-ApiKey': process.env.SEQ_API_KEY } : {}),
    },
    body: line,
  }).catch(() => {});
}

const BASE = {
  Environment: env.nodeEnv,
  Application: 'glim-api',
  Pid: process.pid,
};

// Applies a Seq-style format specifier ("{Elapsed:0.0}") to a value. We keep it
// minimal: numeric ".N" patterns → fixed decimals; everything else stringifies.
function formatValue(value, fmt) {
  if (fmt && typeof value === 'number') {
    const decimals = (fmt.split('.')[1] || '').length;
    return Number.isFinite(value) ? value.toFixed(decimals) : String(value);
  }
  return String(value);
}

// Renders a message template ("Hello {name}", "Done in {ms:0.0}ms") against its
// properties. The `@mt` keeps the raw template (incl. format specifier) for Seq;
// only the human-readable `@m`/console line is substituted here.
function render(template, props) {
  return String(template).replace(/\{@?(\w+)(?::([^}]+))?\}/g, (m, key, fmt) =>
    props[key] !== undefined ? formatValue(props[key], fmt) : m,
  );
}

function emit(level, template, properties = {}, context = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const props = { ...context, ...properties };
  // Pull any Error out of the properties into the @x (exception) field.
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

  const event = {
    '@t': new Date().toISOString(),
    '@l': level,
    '@mt': template,
    '@m': render(template, props),
    ...(exception ? { '@x': exception.stack || String(exception) } : {}),
    ...BASE,
    ...props,
  };

  let line;
  try {
    line = JSON.stringify(event);
  } catch {
    line = JSON.stringify({ '@t': event['@t'], '@l': level, '@mt': template, '@m': event['@m'] });
  }
  appendToFile(line);
  forwardToSeq(line);

  // Console: coloured + concise in dev, plain in prod.
  const fn = console[CONSOLE_FN[level]] || console.log;
  const time = event['@t'].slice(11, 23);
  if (env.isProd) {
    fn(`${time} [${level.slice(0, 3).toUpperCase()}] ${event['@m']}`);
  } else {
    fn(`${COLOR[level]}${time} [${level.slice(0, 3).toUpperCase()}]${RESET} ${event['@m']}`);
    if (exception) fn(`${COLOR.Error}${exception.stack}${RESET}`);
  }
}

// Persists already-formed CLEF events shipped from the browser into the same
// session file, so the developer sees one unified frontend+backend timeline.
export function ingestClientEvents(events = [], context = {}) {
  let written = 0;
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const enriched = { Source: 'frontend', ...context, ...ev };
    if (!enriched['@t']) enriched['@t'] = new Date().toISOString();
    if (!enriched['@l']) enriched['@l'] = 'Information';
    let line;
    try {
      line = JSON.stringify(enriched);
    } catch {
      continue;
    }
    appendToFile(line);
    forwardToSeq(line);
    written += 1;
    // Surface frontend warnings/errors on the dev console too.
    const lvl = enriched['@l'];
    if (!env.isProd && (lvl === 'Warning' || lvl === 'Error' || lvl === 'Fatal')) {
      const fn = console[CONSOLE_FN[lvl] || 'log'] || console.log;
      fn(`${COLOR[lvl] || ''}[FE ${lvl.slice(0, 3).toUpperCase()}]${RESET} ${enriched['@m'] || enriched['@mt'] || ''}`);
    }
  }
  return written;
}

function makeLogger(context = {}) {
  const at = (level) => (template, properties) => emit(level, template, properties, context);
  return {
    verbose: at('Verbose'),
    debug: at('Debug'),
    info: at('Information'),
    warn: at('Warning'),
    error: at('Error'),
    fatal: at('Fatal'),
    // Returns a logger that stamps `extra` onto every event (e.g. a RequestId).
    child: (extra) => makeLogger({ ...context, ...extra }),
  };
}

export const logger = makeLogger();
export const LOG_LEVEL = minLevelName;
