import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 15000,
      dbName: env.mongoDbName,
      // Cap the pool well under the Atlas shared-tier connection ceiling. The
      // driver default is 100 — far too many for an M0 cluster — so a single
      // small, stable pool is shared across all requests. If the backend is ever
      // scaled to N instances, total connections = N × maxPoolSize, so keep this
      // low.
      maxPoolSize: 10,
      minPoolSize: 2, // keep a couple warm to cut latency after idle periods
    });
    // eslint-disable-next-line no-console
    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] MongoDB connection error:', err.message);
    throw err;
  }
}
