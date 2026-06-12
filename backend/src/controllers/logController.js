import { ingestClientEvents } from '../logger/logger.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

// POST /api/logs  { events: [CLEF…] }
// Receives batched browser log events and persists them to the same session
// file as the server logs. Intentionally unauthenticated (logs may be sent
// before login); covered by the global API rate limiter + 1mb body cap.
export const ingestLogs = asyncHandler(async (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : null;
  if (!events) throw new ApiError(400, 'An "events" array is required.');
  if (events.length > 500) throw new ApiError(400, 'Too many events in one batch (max 500).');

  const written = ingestClientEvents(events, {
    ServerRequestId: req.requestId,
    Ip: req.ip,
  });
  res.status(202).json({ success: true, written });
});
