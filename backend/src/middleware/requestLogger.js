import crypto from 'crypto';
import { logger } from '../logger/logger.js';

// Attaches a correlation id + a child logger to every request and logs the
// outcome. The id is read from the incoming `X-Request-Id` header when present
// (the frontend sends one) so a browser log and the matching server log share
// the same RequestId — making an error traceable end-to-end.
export function requestLogger(req, res, next) {
  const requestId = req.get('X-Request-Id') || crypto.randomUUID();
  req.requestId = requestId;
  req.log = logger.child({ RequestId: requestId });
  res.setHeader('X-Request-Id', requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    // Health checks and the log-ingestion endpoint are noisy — keep them at
    // verbose (unless they actually errored).
    const quiet = (req.path === '/health' || req.path === '/logs') && status < 400;
    const log = quiet ? req.log.verbose : req.log[level];
    log('HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.0}ms', {
      Method: req.method,
      Path: req.originalUrl,
      StatusCode: status,
      Elapsed: elapsedMs.toFixed(1),
      UserId: req.user?._id ? String(req.user._id) : undefined,
      UserEmail: req.user?.email,
      Ip: req.ip,
    });
  });

  next();
}
