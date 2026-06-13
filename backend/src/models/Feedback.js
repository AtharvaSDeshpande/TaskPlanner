import mongoose from 'mongoose';

// Product feedback submitted by a user from the in-app feedback form. Captures a
// required overall rating plus optional per-aspect ratings, an NPS-style
// recommendation score, the area they find most useful, and free-text
// suggestions (the optional last block of the form).
const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Denormalized for easy per-tenant reporting; null for the platform owner.
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    // Overall satisfaction — the only required field (1–5 stars).
    rating: { type: Number, required: true, min: 1, max: 5 },
    // Per-aspect star ratings (1–5), all optional.
    easeOfUse: { type: Number, min: 1, max: 5 },
    performance: { type: Number, min: 1, max: 5 },
    design: { type: Number, min: 1, max: 5 },
    // Likelihood to recommend, NPS-style 0–10.
    recommend: { type: Number, min: 0, max: 10 },
    // Which part of the product they find most useful.
    mostUsed: { type: String, default: '', trim: true, maxlength: 100 },
    // Optional free-text suggestions (the optional last block of the form).
    suggestions: { type: String, default: '', trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Feedback = mongoose.model('Feedback', feedbackSchema);
