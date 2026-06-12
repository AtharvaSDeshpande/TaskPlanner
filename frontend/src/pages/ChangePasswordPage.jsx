import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { homePathFor } from '../components/RouteGuards.jsx';
import { deriveKey, encryptObject, decryptObject } from '../crypto/e2e.js';
import PageHeader from '../components/PageHeader.jsx';

function strength(pw) {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score; // 0..4
}

export default function ChangePasswordPage() {
  const { user, applyCredentialChange } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const score = strength(newPassword);
  const valid =
    newPassword.length >= 8 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!valid) {
      setError('New password must be 8+ characters with upper, lower case letters and a number.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current one.');
      return;
    }

    setBusy(true);
    try {
      // The E2E key is derived from the password, so changing it changes the
      // key. Re-encrypt existing todos with the new key so the board survives.
      const oldKey = await deriveKey(currentPassword, user.encSalt);
      const newKey = await deriveKey(newPassword, user.encSalt);

      let reencryptedTodos = [];
      const { data } = await api.get('/todos');
      if (data.todos.length) {
        try {
          reencryptedTodos = await Promise.all(
            data.todos.map(async (t) => {
              const obj = await decryptObject(oldKey, t.ciphertext, t.iv);
              const { ciphertext, iv } = await encryptObject(newKey, obj);
              return { id: t.id, ciphertext, iv };
            }),
          );
        } catch {
          throw new Error('Current password is incorrect — could not unlock your board.');
        }
      }

      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        reencryptedTodos,
      });
      await applyCredentialChange({ token: res.data.token, user: res.data.user }, newKey);
      setSuccess('Password updated successfully.');
      setTimeout(() => navigate(homePathFor(user.role), { replace: true }), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const colors = ['error', 'error', 'warning', 'info', 'success'];

  return (
    <Box sx={{ maxWidth: 560 }}>
      <PageHeader
        title="Change password"
        subtitle="Update the temporary password you were given. Changing it does not affect your to-do board — your tasks stay intact."
      />

      {user?.mustChangePassword && (
        <Alert severity="info" sx={{ mb: 3 }}>
          For your security, please set a personal password before continuing.
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate data-testid="change-password-form">
            <Stack spacing={2.5}>
              <TextField
                label="Current password"
                type={show ? 'text' : 'password'}
                required
                fullWidth
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                inputProps={{ 'data-testid': 'current-password' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShow((s) => !s)} edge="end" tabIndex={-1}>
                        {show ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Box>
                <TextField
                  label="New password"
                  type={show ? 'text' : 'password'}
                  required
                  fullWidth
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  inputProps={{ 'data-testid': 'new-password' }}
                />
                {newPassword && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      color={colors[score]}
                      value={(score / 4) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Strength: {['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][score]}
                    </Typography>
                  </Box>
                )}
              </Box>
              <TextField
                label="Confirm new password"
                type={show ? 'text' : 'password'}
                required
                fullWidth
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                inputProps={{ 'data-testid': 'confirm-password' }}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy} data-testid="change-password-submit">
                {busy ? 'Updating…' : 'Update password'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
