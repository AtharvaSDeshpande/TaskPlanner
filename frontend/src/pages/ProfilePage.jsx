import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext.jsx';
import { useUpdateProfile } from '../queries/hooks.js';
import { roleLabel, initials } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';

function ReadOnlyField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [msg, setMsg] = useState(null); // { type, text }
  const updateProfile = useUpdateProfile();
  const saving = updateProfile.isPending;

  const dirty = name.trim() !== (user.name || '') || phone.trim() !== (user.phone || '');

  const save = async () => {
    if (!name.trim()) {
      setMsg({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    setMsg(null);
    try {
      const data = await updateProfile.mutateAsync({ name: name.trim(), phone: phone.trim() });
      setUser(data.user);
      setMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 820 }}>
      <PageHeader title="My Profile" subtitle="Manage your contact details. Academic info is set by your administrator." />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ width: 88, height: 88, mx: 'auto', mb: 2, bgcolor: 'primary.main', fontSize: 30 }}>
                {initials(user.name)}
              </Avatar>
              <Typography variant="h6">{user.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
                <Chip size="small" color="primary" label={roleLabel(user.role)} />
                {user.organization?.domain && (
                  <Chip size="small" variant="outlined" label={`@${user.organization.domain}`} />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Editable details
              </Typography>
              {msg && (
                <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
                  {msg.text}
                </Alert>
              )}
              <Stack spacing={2.5}>
                <TextField label="Full name" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                <TextField
                  label="Phone"
                  fullWidth
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                />
                <Box>
                  <Button variant="contained" onClick={save} disabled={saving || !dirty}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </Box>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" gutterBottom>
                Managed by your organization
              </Typography>
              <Grid container spacing={2}>
                {user.organization?.name && (
                  <Grid item xs={6}>
                    <ReadOnlyField label="Organization" value={user.organization.name} />
                  </Grid>
                )}
                {user.role !== 'owner' && (
                  <>
                    <Grid item xs={6}>
                      <ReadOnlyField label="Program" value={user.program} />
                    </Grid>
                    <Grid item xs={6}>
                      <ReadOnlyField label="Section" value={user.section} />
                    </Grid>
                    <Grid item xs={6}>
                      <ReadOnlyField label="Roll number" value={user.rollNumber} />
                    </Grid>
                    <Grid item xs={6}>
                      <ReadOnlyField label="Enrollment year" value={user.enrollmentYear} />
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
