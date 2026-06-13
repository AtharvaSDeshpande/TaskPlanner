import { Feedback } from '../models/Feedback.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

// Clamps an optional 1–5 star value; returns undefined when not provided so the
// field is simply omitted rather than stored as 0/null.
const star = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return undefined;
  return Math.min(5, Math.max(1, n));
};

// POST /api/feedback  { rating, easeOfUse?, performance?, design?, recommend?, mostUsed?, suggestions? }
export const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, easeOfUse, performance, design, recommend, mostUsed, suggestions } = req.body;

  const overall = Math.round(Number(rating));
  if (Number.isNaN(overall) || overall < 1 || overall > 5) {
    throw new ApiError(400, 'Please give an overall rating between 1 and 5 stars.');
  }

  let nps;
  if (recommend !== undefined && recommend !== null && recommend !== '') {
    const n = Math.round(Number(recommend));
    if (!Number.isNaN(n)) nps = Math.min(10, Math.max(0, n));
  }

  const feedback = await Feedback.create({
    user: req.user._id,
    organization: req.user.organization?._id || req.user.organization || null,
    rating: overall,
    easeOfUse: star(easeOfUse),
    performance: star(performance),
    design: star(design),
    recommend: nps,
    mostUsed: String(mostUsed || '').slice(0, 100),
    suggestions: String(suggestions || '').slice(0, 2000),
  });

  req.log?.info?.('Feedback submitted by {UserEmail} (overall {Rating}/5)', {
    UserEmail: req.user.email,
    Rating: overall,
    FeedbackId: feedback._id,
  });

  res.status(201).json({ success: true, feedback: { id: feedback._id } });
});
