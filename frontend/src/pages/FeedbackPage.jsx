import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { FLOATING_SELECT } from '../constants/ui.js';
import { useSubmitFeedback } from '../queries/hooks.js';
import { homePathFor } from '../components/RouteGuards.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

// Areas of the product the user can flag as most useful to them.
const FEATURES = [
  'Deadlines & assignments',
  'My To-Do board',
  'Groups & collaboration',
  'Managing users & roles',
  'Semesters & courses',
  'Other',
];

// One labelled 1–5 star row, used for each rated aspect.
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
          onChange={(_, v) => onChange(v)}
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

  const [rating, setRating] = useState(0); // overall — required
  const [easeOfUse, setEaseOfUse] = useState(0);
  const [performance, setPerformance] = useState(0);
  const [design, setDesign] = useState(0);
  const [recommend, setRecommend] = useState('');
  const [mostUsed, setMostUsed] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please give an overall rating before submitting.');
      return;
    }
    setError('');
    try {
      await submit.mutateAsync({
        rating,
        easeOfUse: easeOfUse || undefined,
        performance: performance || undefined,
        design: design || undefined,
        recommend: recommend === '' ? undefined : Number(recommend),
        mostUsed,
        suggestions: suggestions.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (done) {
    return (
      <Box sx={{ maxWidth: 640 }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <CheckCircleRoundedIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h5" gutterBottom>
              Thank you{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your feedback has been recorded. It helps us make GLIM better for everyone.
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
    <Box sx={{ maxWidth: 640 }}>
      <PageHeader
        title="Share your feedback"
        subtitle="Tell us how GLIM is working for you. It only takes a minute and helps shape what we build next."
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
              {/* Required overall rating */}
              <Box>
                <Typography fontWeight={600}>
                  Overall, how satisfied are you with GLIM?{' '}
                  <Typography component="span" color="error.main">
                    *
                  </Typography>
                </Typography>
                <Box data-testid="feedback-rating" sx={{ mt: 0.5 }}>
                  <Rating
                    value={rating}
                    onChange={(_, v) => setRating(v || 0)}
                    icon={<StarRoundedIcon fontSize="inherit" />}
                    emptyIcon={<StarRoundedIcon fontSize="inherit" />}
                    size="large"
                    sx={{ fontSize: '2.5rem' }}
                  />
                </Box>
              </Box>

              <Divider />

              {/* Per-aspect ratings */}
              <RatingRow
                label="Ease of use"
                hint="How easy is it to find your way around?"
                value={easeOfUse}
                onChange={(v) => setEaseOfUse(v || 0)}
                testId="feedback-ease"
              />
              <RatingRow
                label="Performance & speed"
                hint="Does the app feel fast and responsive?"
                value={performance}
                onChange={(v) => setPerformance(v || 0)}
                testId="feedback-performance"
              />
              <RatingRow
                label="Design & usability"
                hint="Is the interface clear and pleasant to use?"
                value={design}
                onChange={(v) => setDesign(v || 0)}
                testId="feedback-design"
              />

              <Divider />

              {/* Likelihood to recommend (NPS-style 0–10) */}
              <TextField
                select
                fullWidth
                label="How likely are you to recommend GLIM to a classmate?"
                value={recommend}
                onChange={(e) => setRecommend(e.target.value)}
                {...FLOATING_SELECT}
                helperText="0 = not at all likely, 10 = extremely likely"
                inputProps={{ 'data-testid': 'feedback-recommend' }}
                InputProps={{
                  startAdornment: <FavoriteRoundedIcon color="error" fontSize="small" sx={{ mr: 1 }} />,
                }}
              >
                {Array.from({ length: 11 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {i}
                  </MenuItem>
                ))}
              </TextField>

              {/* Which feature is most useful */}
              <TextField
                select
                fullWidth
                label="Which part of GLIM do you find most useful?"
                value={mostUsed}
                onChange={(e) => setMostUsed(e.target.value)}
                {...FLOATING_SELECT}
                inputProps={{ 'data-testid': 'feedback-most-used' }}
              >
                <MenuItem value="">— No preference —</MenuItem>
                {FEATURES.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </TextField>

              <Divider />

              {/* Optional last block — free-text suggestions */}
              <TextField
                label="Suggestions or anything else? (optional)"
                placeholder="Tell us what you'd love to see, or what's getting in your way…"
                fullWidth
                multiline
                minRows={4}
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                inputProps={{ maxLength: 2000, 'data-testid': 'feedback-suggestions' }}
                helperText={`${suggestions.length}/2000`}
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
