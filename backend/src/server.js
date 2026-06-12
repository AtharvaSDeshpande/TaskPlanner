import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { startReminderScheduler } from './services/reminderService.js';
import { logger, sessionFile, LOG_LEVEL } from './logger/logger.js';

async function bootstrap() {
  logger.info('Starting GLIM API in {Environment} mode (log level {LogLevel}) → {LogFile}', {
    Environment: env.nodeEnv,
    LogLevel: LOG_LEVEL,
    LogFile: sessionFile,
  });

  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info('GLIM API listening on http://localhost:{Port} ({Environment})', {
      Port: env.port,
      Environment: env.nodeEnv,
    });
  });

  startReminderScheduler();

  // Graceful shutdown: stop accepting connections, then close the DB.
  const shutdown = async (signal) => {
    logger.warn('{Signal} received — shutting down gracefully…', { Signal: signal });
    server.close(async () => {
      await mongoose.connection.close();
      logger.info('Closed HTTP server and DB connection. Bye.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  ['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

bootstrap().catch((err) => {
  logger.fatal('Failed to start the server: {ErrorMessage}', { ErrorMessage: err.message, err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { err: reason instanceof Error ? reason : new Error(String(reason)) });
});
process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught exception', { err });
});
