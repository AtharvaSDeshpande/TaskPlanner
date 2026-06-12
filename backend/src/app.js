import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { apiLimiter, authLimiter, writeLimiter } from './middleware/rateLimit.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { requestLogger } from './middleware/requestLogger.js';

export function createApp() {
  const app = express();

  // Behind a proxy/load balancer, trust X-Forwarded-* so rate limiting keys
  // off the real client IP rather than the proxy.
  app.set('trust proxy', 1);

  app.use(helmet());
  // Allow the configured browser origins (dev 5173, prod preview 4173, …).
  // No-origin requests (curl, server-to-server) are permitted.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeBody);
  // Correlated structured request logging (replaces morgan). Runs early so the
  // error handler and downstream handlers share the same RequestId + req.log.
  if (env.nodeEnv !== 'test') app.use(requestLogger);

  // Tiered rate limiting: a broad ceiling on everything, stricter on auth,
  // and a moderate cap on sensitive write actions.
  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/change-password', authLimiter);
  app.use(
    ['/api/organizations', '/api/users', '/api/groups', '/api/roles', '/api/semesters', '/api/courses'],
    (req, res, next) => (req.method === 'GET' ? next() : writeLimiter(req, res, next)),
  );

  app.get('/', (_req, res) =>
    res.json({ success: true, name: 'GLIM API', docs: '/api/health' }),
  );
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
