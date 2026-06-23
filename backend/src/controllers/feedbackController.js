import { Feedback } from '../models/Feedback.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

// Clamps an optional integer to [min,max]; returns undefined when not provided so
// the field is simply omitted rather than stored as 0/null.
const scale = (v, min, max) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return undefined;
  return Math.min(max, Math.max(min, n));
};
const star = (v) => scale(v, 1, 5);
// Normalizes a multi-select to an array of trimmed, capped strings.
const strList = (v) =>
  (Array.isArray(v) ? v : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((s) => s.slice(0, 120));

// POST /api/feedback  — TaskPlanner product-validation survey.
export const submitFeedback = asyncHandler(async (req, res) => {
  const {
    rating,
    easeOfUse,
    performance,
    design,
    recommend,
    mostUsed,
    suggestions,
    currentTools,
    planningComplexity,
    missFrequency,
    slipReasons,
    problemAgreement,
    helpsAgreement,
    easierThanBefore,
    valueToMba,
    usageIntent,
  } = req.body;

  const overall = Math.round(Number(rating));
  if (Number.isNaN(overall) || overall < 1 || overall > 5) {
    throw new ApiError(400, 'Please give an overall rating between 1 and 5 stars.');
  }

  const feedback = await Feedback.create({
    user: req.user._id,
    organization: req.user.organization?._id || req.user.organization || null,
    // Section A — the problem
    currentTools: strList(currentTools),
    planningComplexity: star(planningComplexity),
    missFrequency: String(missFrequency || '').slice(0, 40),
    slipReasons: strList(slipReasons),
    problemAgreement: star(problemAgreement),
    // Section B — does TaskPlanner solve it
    rating: overall,
    easeOfUse: star(easeOfUse),
    performance: star(performance),
    design: star(design),
    helpsAgreement: star(helpsAgreement),
    easierThanBefore: String(easierThanBefore || '').slice(0, 40),
    mostUsed: String(mostUsed || '').slice(0, 100),
    // Section C — interest & value
    valueToMba: star(valueToMba),
    usageIntent: star(usageIntent),
    recommend: scale(recommend, 0, 10),
    suggestions: String(suggestions || '').slice(0, 2000),
  });

  req.log?.info?.('Feedback submitted by {UserEmail} (overall {Rating}/5)', {
    UserEmail: req.user.email,
    Rating: overall,
    FeedbackId: feedback._id,
  });

  res.status(201).json({ success: true, feedback: { id: feedback._id } });
});
