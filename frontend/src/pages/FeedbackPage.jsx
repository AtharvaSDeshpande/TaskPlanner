import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { FLOATING_SELECT } from '../constants/ui.js';
import { useSubmitFeedback } from '../queries/hooks.js';
import { homePathFor } from '../components/RouteGuards.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

// ── Survey options ───────────────────────────────────────────────────────────
const TOOL_OPTIONS = [
  'Spreadsheets (Excel / Sheets)',
  'Email',
  'WhatsApp / chat groups',
  'Calendar app',
  'Notes / sticky notes',
  'Just my memory',
  'Other',
];
const SLIP_REASONS = [
  'Too many scattered tools',
  'No single view of everything',
  'Forgot / weak reminders',
  'Group coordination gaps',
  'Last-minute pile-ups',
  'Other',
];
const FREQUENCY = [
  ['never', 'Never'],
  ['rarely', 'Rarely'],
  ['sometimes', 'Sometimes'],
  ['often', 'Often'],
  ['veryOften', 'Very often'],
];
const COMPLEXITY = [
  [1, '1 — Very simple'],
  [2, '2 — Simple'],
  [3, '3 — Moderate'],
  [4, '4 — Complex'],
  [5, '5 — Very complex'],
];
const AGREEMENT = [
  [1, 'Strongly disagree'],
  [2, 'Disagree'],
  [3, 'Neutral'],
  [4, 'Agree'],
  [5, 'Strongly agree'],
];
const EASIER = [
  ['muchHarder', 'Much harder'],
  ['harder', 'Somewhat harder'],
  ['same', 'About the same'],
  ['easier', 'Somewhat easier'],
  ['muchEasier', 'Much easier'],
];
const VALUE = [
  [1, 'No value'],
  [2, 'A little value'],
  [3, 'Some value'],
  [4, 'Good value'],
  [5, 'High value'],
];
const LIKELIHOOD = [
  [1, 'Very unlikely'],
  [2, 'Unlikely'],
  [3, 'Maybe'],
  [4, 'Likely'],
  [5, 'Very likely'],
];
const RECOMMEND = Array.from({ length: 11 }, (_, i) => [i, String(i)]);
const FEATURES = [
  'Deadlines & assignments',
  'My To-Do board',
  'Groups & collaboration',
  'Announcements',
  'Semesters & courses',
  'Other',
];

const initialForm = () => ({
  // A — the problem
  currentTools: [],
  planningComplexity: '',
  missFrequency: '',
  slipReasons: [],
  problemAgreement: '',
  // B — does TaskPlanner solve it
  rating: 0,
  easeOfUse: 0,
  performance: 0,
  design: 0,
  helpsAgreement: '',
  easierThanBefore: '',
  mostUsed: '',
  // C — interest & value
  valueToMba: '',
  usageIntent: '',
  recommend: '',
  // optional
  suggestions: '',
});

function SectionHeading({ children, hint }) {
  return (
    <Box>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
        {children}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

// A single labelled question with a dropdown of choices.
function ChoiceField({ label, value, onChange, options, helperText, required, testId }) {
  return (
    <TextField
      select
      fullWidth
      required={required}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...FLOATING_SELECT}
      helperText={helperText}
      inputProps={{ 'data-testid': testId }}
    >
      {options.map(([v, l]) => (
        <MenuItem key={v} value={v}>
          {l}
        </MenuItem>
      ))}
    </TextField>
  );
}

// A "select all that apply" multi-choice question.
function MultiField({ label, value, onChange, options, helperText, testId }) {
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...FLOATING_SELECT}
      SelectProps={{
        multiple: true,
        displayEmpty: true,
        renderValue: (sel) => (sel.length ? sel.join(', ') : 'Select all that apply'),
      }}
      helperText={helperText}
      inputProps={{ 'data-testid': testId }}
    >
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          <Checkbox checked={value.includes(o)} />
          {o}
        </MenuItem>
      ))}
    </TextField>
  );
}

// A labelled 1–5 star row, used for each rated aspect of TaskPlanner.
function RatingRow({ label, hint, value, onChange, testId }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={1}
    >
      <Box>
        <Typography fontWeight={600}>{label}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Box>
      <Box data-testid={testId} sx={{ flexShrink: 0 }}>
        <Rating
          value={value}
          onChange={(_, v) => onChange(v || 0)}
          icon={<StarRoundedIcon fontSize="inherit" />}
          emptyIcon={<StarRoundedIcon fontSize="inherit" />}
          size="large"
        />
      </Box>
    </Stack>
  );
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const submit = useSubmitFeedback();

  const [form, setForm] = useState(initialForm());
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rating) {
      setError('Please give TaskPlanner an overall rating before submitting.');
      return;
    }
    setError('');
    const num = (v) => (v === '' ? undefined : Number(v));
    try {
      await submit.mutateAsync({
        // A — the problem
        currentTools: form.currentTools,
        planningComplexity: num(form.planningComplexity),
        missFrequency: form.missFrequency || undefined,
        slipReasons: form.slipReasons,
        problemAgreement: num(form.problemAgreement),
        // B — solution
        rating: form.rating,
        easeOfUse: form.easeOfUse || undefined,
        performance: form.performance || undefined,
        design: form.design || undefined,
        helpsAgreement: num(form.helpsAgreement),
        easierThanBefore: form.easierThanBefore || undefined,
        mostUsed: form.mostUsed || undefined,
        // C — value
        valueToMba: num(form.valueToMba),
        usageIntent: num(form.usageIntent),
        recommend: num(form.recommend),
        suggestions: form.suggestions.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (done) {
    return (
      <Box sx={{ maxWidth: 680 }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <CheckCircleRoundedIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h5" gutterBottom>
              Thank you{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your responses have been recorded. They directly shape how TaskPlanner evolves.
            </Typography>
            <Button variant="contained" onClick={() => navigate(homePathFor(user.role))} data-testid="feedback-done">
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 680 }}>
      <PageHeader
        title="Help shape TaskPlanner"
        subtitle="A 2-minute survey about how you plan your academic work — and whether TaskPlanner makes it easier. Your honest answers guide what we build next."
      />

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="feedback-error">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate data-testid="feedback-form">
            <Stack spacing={3}>
              {/* ── Section A — the problem ──────────────────────────────── */}
              <SectionHeading hint="First, how you manage your academic workload today.">
                Planning your academic life
              </SectionHeading>

              <MultiField
                label="How do you currently keep track of your academic tasks?"
                value={form.currentTools}
                onChange={set('currentTools')}
                options={TOOL_OPTIONS}
                testId="feedback-tools"
              />
              <ChoiceField
                label="How complex do you find planning and tracking your academic workload?"
                value={form.planningComplexity}
                onChange={set('planningComplexity')}
                options={COMPLEXITY}
                testId="feedback-complexity"
              />
              <ChoiceField
                label="How often do you miss — or nearly miss — a deadline, submission or group commitment?"
                value={form.missFrequency}
                onChange={set('missFrequency')}
                options={FREQUENCY}
                testId="feedback-miss"
              />
              <MultiField
                label="When tasks slip through the cracks, what's usually the cause?"
                value={form.slipReasons}
                onChange={set('slipReasons')}
                options={SLIP_REASONS}
                testId="feedback-slip"
              />
              <ChoiceField
                label="“Planning my academic tasks is complex, and important things often get missed.”"
                value={form.problemAgreement}
                onChange={set('problemAgreement')}
                options={AGREEMENT}
                helperText="How much do you agree?"
                testId="feedback-problem-agree"
              />

              <Divider />

              {/* ── Section B — does TaskPlanner solve it ────────────────── */}
              <SectionHeading hint="Now, your experience using TaskPlanner.">
                Your experience with TaskPlanner
              </SectionHeading>

              <Box>
                <Typography fontWeight={600}>
                  Overall, how satisfied are you with TaskPlanner?{' '}
                  <Typography component="span" color="error.main">
                    *
                  </Typography>
                </Typography>
                <Box data-testid="feedback-rating" sx={{ mt: 0.5 }}>
                  <Rating
                    value={form.rating}
                    onChange={(_, v) => set('rating')(v || 0)}
                    icon={<StarRoundedIcon fontSize="inherit" />}
                    emptyIcon={<StarRoundedIcon fontSize="inherit" />}
                    size="large"
                    sx={{ fontSize: '2.5rem' }}
                  />
                </Box>
              </Box>

              <RatingRow
                label="Ease of use"
                hint="How easy is it to find your way around?"
                value={form.easeOfUse}
                onChange={set('easeOfUse')}
                testId="feedback-ease"
              />
              <RatingRow
                label="Performance & speed"
                hint="Does it feel fast and responsive?"
                value={form.performance}
                onChange={set('performance')}
                testId="feedback-performance"
              />
              <RatingRow
                label="Design & usability"
                hint="Is the interface clear and pleasant to use?"
                value={form.design}
                onChange={set('design')}
                testId="feedback-design"
              />
              <ChoiceField
                label="“TaskPlanner helps me stay on top of my deadlines and reduces the chance of missing tasks.”"
                value={form.helpsAgreement}
                onChange={set('helpsAgreement')}
                options={AGREEMENT}
                helperText="How much do you agree?"
                testId="feedback-helps-agree"
              />
              <ChoiceField
                label="Compared with how you managed before, TaskPlanner makes staying organized…"
                value={form.easierThanBefore}
                onChange={set('easierThanBefore')}
                options={EASIER}
                testId="feedback-easier"
              />
              <ChoiceField
                label="Which part of TaskPlanner is most useful to you?"
                value={form.mostUsed}
                onChange={set('mostUsed')}
                options={[['', '— No preference —'], ...FEATURES.map((f) => [f, f])]}
                testId="feedback-most-used"
              />

              <Divider />

              {/* ── Section C — interest & value ─────────────────────────── */}
              <SectionHeading hint="Finally, what TaskPlanner means for your MBA.">
                Value to your MBA journey
              </SectionHeading>

              <ChoiceField
                label="How much value would TaskPlanner add to your MBA journey?"
                value={form.valueToMba}
                onChange={set('valueToMba')}
                options={VALUE}
                testId="feedback-value"
              />
              <ChoiceField
                label="How likely are you to use TaskPlanner regularly through your program?"
                value={form.usageIntent}
                onChange={set('usageIntent')}
                options={LIKELIHOOD}
                testId="feedback-usage"
              />
              <ChoiceField
                label="How likely are you to recommend TaskPlanner to a classmate?"
                value={form.recommend}
                onChange={set('recommend')}
                options={RECOMMEND}
                helperText="0 = not at all likely, 10 = extremely likely"
                testId="feedback-recommend"
              />

              <Divider />

              {/* Optional last block — free-text suggestions */}
              <TextField
                label="Anything else you'd like to see in TaskPlanner? (optional)"
                placeholder="What would make TaskPlanner indispensable for you, or what's getting in your way…"
                fullWidth
                multiline
                minRows={3}
                value={form.suggestions}
                onChange={(e) => set('suggestions')(e.target.value)}
                inputProps={{ maxLength: 2000, 'data-testid': 'feedback-suggestions' }}
                helperText={`${form.suggestions.length}/2000`}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submit.isPending}
                data-testid="feedback-submit"
              >
                {submit.isPending ? 'Submitting…' : 'Submit feedback'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
