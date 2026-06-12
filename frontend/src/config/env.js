// Centralised frontend environment configuration.
//
// Values come from Vite env files chosen by the active mode:
//   npm run dev        → .env.development  (talks to the dev backend via proxy)
//   npm run dev:prod   → .env.production   (talks to the prod backend directly)
//   npm run build      → .env.production
//   npm run build:dev  → .env.development
const appEnv = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const config = {
  appEnv,
  isProd: appEnv === 'production',
  // Where the API lives. In dev this is "/api" (proxied by Vite); in prod it is
  // the absolute backend URL from .env.production.
  apiBaseUrl,

  // Structured logging (see logger/logger.jsx).
  logging: {
    // Minimum level to emit. Verbose < Debug < Information < Warning < Error < Fatal.
    level: import.meta.env.VITE_LOG_LEVEL || (appEnv === 'production' ? 'Information' : 'Debug'),
    // Ship browser logs to the backend session file (POST /api/logs). Disable
    // with VITE_LOG_REMOTE=false to keep logging console-only.
    remote: String(import.meta.env.VITE_LOG_REMOTE ?? 'true') !== 'false',
    endpoint: `${apiBaseUrl}/logs`,
    appVersion: import.meta.env.VITE_APP_VERSION || 'dev',
  },
};
