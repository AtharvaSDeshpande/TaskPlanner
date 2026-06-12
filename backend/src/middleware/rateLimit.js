import rateLimit from 'express-rate-limit';

const json = (message) => ({ success: false, message });

// Broad ceiling for all API traffic — guards against scraping / floods.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many requests. Please slow down and try again shortly.'),
});

// Tight limit on credential checks to slow brute-force attacks.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many sign-in attempts. Please try again in a few minutes.'),
});

// Moderate limit on sensitive write actions (account/org/group creation, resets).
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many changes in a short time. Please wait a moment and retry.'),
});
