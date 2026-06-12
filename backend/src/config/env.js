import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  // eslint-disable-next-line no-console
  console.error(`\n[config] Missing required env vars: ${missing.join(', ')}\n`);
  process.exit(1);
}

// Allowed browser origins for CORS. CLIENT_URL may be a comma-separated list so
// the same backend can serve the dev server (5173) and a prod preview (4173).
// Browsers send `Origin` with no trailing slash and no path, so we normalize by
// stripping any trailing slash to keep the exact-match comparison robust.
const stripSlash = (s) => s.trim().replace(/\/+$/, '');

// Deployed frontends that should always be allowed, regardless of CLIENT_URL.
const alwaysAllowedOrigins = [
  'https://taskplanner.adcodes.co.in',
  'https://task-planner-six-lac.vercel.app',
];

const envClientUrls = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(stripSlash)
  .filter(Boolean);

// Keep CLIENT_URL entries first so clientUrls[0] (used for email links) stays the
// configured production origin; append the always-allowed frontends for CORS.
const clientUrls = [...new Set([...envClientUrls, ...alwaysAllowedOrigins])];

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  // First entry is used for links inside emails; the full list is used for CORS.
  clientUrl: clientUrls[0],
  clientUrls,

  mongoUri: process.env.MONGODB_URI,
  // Forces a stable database name even if the connection string omits one
  // (Atlas's default copy-paste URI does). Override with MONGODB_DB.
  mongoDbName: process.env.MONGODB_DB || 'glim',

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Platform owner — the single super-admin who manages organizations.
  owner: {
    email: (process.env.OWNER_EMAIL || 'atharvadeshpande@owner.com').toLowerCase(),
    password: process.env.OWNER_PASSWORD || 'Admin@12345',
    name: process.env.OWNER_NAME || 'Atharva Deshpande',
  },

  // Default password assigned to an organization's admin when it is created.
  defaultOrgAdminPassword: process.env.DEFAULT_ORG_ADMIN_PASSWORD || 'Admin@12345',

  // Email delivery via EmailJS (https://www.emailjs.com) REST API.
  // Server-side sending requires the private key (accessToken) and that
  // "Allow EmailJS API for non-browser applications" is enabled in the account.
  emailjs: {
    serviceId: process.env.EMAILJS_SERVICE_ID || '',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
    privateKey: process.env.EMAILJS_PRIVATE_KEY || '',
    fromName: process.env.MAIL_FROM_NAME || 'GLIM Portal',
    templates: {
      welcome: process.env.EMAILJS_TEMPLATE_WELCOME || '',
      reset: process.env.EMAILJS_TEMPLATE_RESET || '',
      reminder: process.env.EMAILJS_TEMPLATE_REMINDER || '',
      assignment: process.env.EMAILJS_TEMPLATE_ASSIGNMENT || '',
      group: process.env.EMAILJS_TEMPLATE_GROUP || '',
    },
  },

  reminderLeadHours: Number(process.env.REMINDER_LEAD_HOURS) || 24,
};

// Treat obvious placeholder/dummy values as "not configured" so the app logs
// emails to the console instead of failing while real credentials are pending.
const looksReal = (v) => Boolean(v) && !/x{3,}|your[_-]|placeholder|changeme/i.test(v);

export const isEmailConfigured =
  looksReal(env.emailjs.serviceId) &&
  looksReal(env.emailjs.publicKey) &&
  looksReal(env.emailjs.privateKey);
