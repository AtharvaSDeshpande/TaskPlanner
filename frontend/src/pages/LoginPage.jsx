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
import glim from "../../assets/glim.webp"
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import EnvBadge from '../components/EnvBadge.jsx';
import { useTranslation } from 'react-i18next';
import { homePathFor } from '../components/RouteGuards.jsx';
import { brandGradient } from '../theme.js';

// Icons only; the title/text strings live in i18n under auth.features[i].
const FEATURE_ICONS = [EventNoteRoundedIcon, NotificationsActiveRoundedIcon, LockRoundedIcon];

export default function LoginPage() {
  const { t } = useTranslation();
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
          <img style={{ width: '50px', objectFit: 'contain' }} src={glim} alt="GLIM logo" />
          <Typography variant="h5" fontWeight={700}>
            {t('auth.brandName')}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2, lineHeight: 1.15 }}>
          {t('auth.heroTitle')}
        </Typography>
        <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.9, mb: 5 }}>
          {t('auth.heroSubtitle')}
        </Typography>
        <Stack spacing={3}>
          {FEATURE_ICONS.map((Icon, i) => (
            <Stack key={i} direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 2, p: 1.2, display: 'flex' }}>
                <Icon />
              </Box>
              <Box>
                <Typography fontWeight={600}>{t(`auth.features.${i}.title`)}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {t(`auth.features.${i}.text`)}
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
              <img style={{ width: '50px', objectFit: 'contain' }} src={glim} alt="GLIM logo" />
              <Typography variant="h6">{t('common.appName')}</Typography>
            </Stack>
            <Typography variant="h5" gutterBottom>
              {t('auth.welcomeBack')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('auth.signInPrompt')}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate data-testid="login-form">
              <Stack spacing={2.5}>
                <TextField
                  label={t('auth.emailLabel')}
                  type="email"
                  fullWidth
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  inputProps={{ 'data-testid': 'login-email' }}
                />
                <TextField
                  label={t('auth.passwordLabel')}
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
                  {submitting ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
