import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import EnvBadge from '../components/EnvBadge.jsx';
import { homePathFor } from '../components/RouteGuards.jsx';
import { brandGradient } from '../theme.js';

const FEATURES = [
  { icon: EventNoteRoundedIcon, title: 'Deadlines at a glance', text: 'Track every assignment and submission in one place.' },
  { icon: NotificationsActiveRoundedIcon, title: 'Email reminders', text: 'Get nudged before a deadline slips past you.' },
  { icon: LockRoundedIcon, title: 'Encrypted to-dos', text: 'Your personal task board is encrypted and private to your account.' },
];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.mustChangePassword ? '/change-password' : homePathFor(user.role), {
        replace: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container sx={{ minHeight: '100vh', position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EnvBadge />
        <ThemeToggle />
      </Box>
      {/* Branding panel */}
      <Grid
        item
        xs={12}
        md={6}
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          p: 8,
          color: '#fff',
          background: brandGradient,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
          <SchoolRoundedIcon sx={{ fontSize: 40 }} />
          <Typography variant="h4" fontWeight={700}>
            GLIM
          </Typography>
        </Stack>
        <Typography variant="h3" fontWeight={700} sx={{ mb: 2, lineHeight: 1.15 }}>
          Stay ahead of every deadline.
        </Typography>
        <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.9, mb: 5 }}>
          The student portal for assignments, submissions and a private, encrypted to-do list.
        </Typography>
        <Stack spacing={3}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Stack key={title} direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 2, p: 1.2, display: 'flex' }}>
                <Icon />
              </Box>
              <Box>
                <Typography fontWeight={600}>{title}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {text}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Grid>

      {/* Form panel */}
      <Grid
        item
        xs={12}
        md={6}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 6 } }}
      >
        <Card sx={{ width: '100%', maxWidth: 420 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, display: { md: 'none' } }}>
              <SchoolRoundedIcon color="primary" />
              <Typography variant="h6">GLIM</Typography>
            </Stack>
            <Typography variant="h5" gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Sign in with your official college email and the password sent to you.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate data-testid="login-form">
              <Stack spacing={2.5}>
                <TextField
                  label="College email"
                  type="email"
                  fullWidth
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@bschool.edu"
                  inputProps={{ 'data-testid': 'login-email' }}
                />
                <TextField
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  fullWidth
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  inputProps={{ 'data-testid': 'login-password' }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPw((s) => !s)} edge="end" tabIndex={-1} data-testid="login-toggle-password">
                          {showPw ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button type="submit" variant="contained" size="large" fullWidth disabled={submitting} data-testid="login-submit">
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
