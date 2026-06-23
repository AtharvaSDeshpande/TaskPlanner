import mongoose from 'mongoose';

// Product-validation survey submitted from the in-app TaskPlanner feedback page.
// It is structured to (a) establish the problem — that planning academic tasks is
// complex and things get missed, (b) validate that TaskPlanner solves it, and
// (c) gauge interest and the value it adds to the respondent's MBA journey.
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

    // ── Section A — the problem (independent of TaskPlanner) ────────────────
    currentTools: { type: [String], default: [] }, // how they track tasks today
    planningComplexity: { type: Number, min: 1, max: 5 }, // 1 very simple → 5 very complex
    missFrequency: { type: String, default: '' }, // never|rarely|sometimes|often|veryOften
    slipReasons: { type: [String], default: [] }, // why tasks slip through the cracks
    problemAgreement: { type: Number, min: 1, max: 5 }, // agree planning is complex & things get missed

    // ── Section B — does TaskPlanner solve it ──────────────────────────────
    // Overall satisfaction — the only required field (1–5 stars).
    rating: { type: Number, required: true, min: 1, max: 5 },
    easeOfUse: { type: Number, min: 1, max: 5 },
    performance: { type: Number, min: 1, max: 5 },
    design: { type: Number, min: 1, max: 5 },
    helpsAgreement: { type: Number, min: 1, max: 5 }, // TaskPlanner reduces missed tasks
    easierThanBefore: { type: String, default: '' }, // muchHarder…muchEasier vs before
    mostUsed: { type: String, default: '', trim: true, maxlength: 100 },

    // ── Section C — interest & value to the MBA journey ────────────────────
    valueToMba: { type: Number, min: 1, max: 5 }, // value it adds to their MBA journey
    usageIntent: { type: Number, min: 1, max: 5 }, // likelihood to use it regularly
    recommend: { type: Number, min: 0, max: 10 }, // NPS-style 0–10

    // Optional free-text suggestions (the optional last block of the form).
    suggestions: { type: String, default: '', trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Feedback = mongoose.model('Feedback', feedbackSchema);
