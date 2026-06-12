import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import {
  useOrganizations,
  useCreateOrganization,
  useSetOrganizationStatus,
  useDeleteOrganization,
} from '../queries/hooks.js';
import PageHeader from '../components/PageHeader.jsx';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

function SummaryCard({ icon: Icon, label, value, color = 'primary' }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar variant="rounded" sx={{ bgcolor: `${color}.main`, width: 44, height: 44 }}>
            <Icon />
          </Avatar>
          <Box>
            <Typography variant="h5">{value}</Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Shows the auto-generated admin credentials after an organization is created.
function AdminCredentialDialog({ data, onClose }) {
  const [copied, setCopied] = useState('');
  if (!data) return null;
  const copy = (text, which) => {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(''), 1500);
  };
  const field = (label, value, key) => (
    <TextField
      label={label}
      value={value}
      fullWidth
      InputProps={{
        readOnly: true,
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title={copied === key ? 'Copied!' : 'Copy'}>
              <IconButton onClick={() => copy(value, key)} edge="end">
                <ContentCopyRoundedIcon />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  );
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Organization admin created</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {data.emailDelivered
            ? 'These credentials were emailed to the new admin. Share them securely if needed.'
            : 'Email delivery is off — share these credentials with the admin securely.'}
        </DialogContentText>
        <Stack spacing={2}>
          {field('Admin email', data.adminAccount.email, 'email')}
          {field('Password', data.adminAccount.password, 'pw')}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function OrganizationsPage() {
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', domain: '' });
  const [credential, setCredential] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type:'delete', org }

  const { data, isPending: loading } = useOrganizations();
  const summary = data?.summary;
  const orgs = data?.organizations ?? [];

  const createOrg = useCreateOrganization();
  const setStatus = useSetOrganizationStatus();
  const deleteOrg = useDeleteOrganization();
  const saving = createOrg.isPending;
  const busyId = setStatus.isPending ? setStatus.variables?.id : null;

  const handleCreate = async () => {
    if (!draft.name.trim() || !draft.domain.trim()) {
      setError('Organization name and domain are required.');
      return;
    }
    setError('');
    try {
      const created = await createOrg.mutateAsync({
        name: draft.name.trim(),
        domain: draft.domain.trim(),
      });
      setCreateOpen(false);
      setDraft({ name: '', domain: '' });
      setCredential(created);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleStatus = async (org) => {
    const next = org.status === 'active' ? 'disabled' : 'active';
    try {
      await setStatus.mutateAsync({ id: org.id, status: next });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    const org = confirm.org;
    setConfirm(null);
    try {
      await deleteOrg.mutateAsync(org.id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <Box>
      <PageHeader
        title="Organizations"
        subtitle="Each organization is a tenant identified by its email domain. Members are clustered by the part after @ in their email."
        action={
          <Button variant="contained" startIcon={<AddBusinessRoundedIcon />} onClick={() => setCreateOpen(true)} data-testid="new-organization-button">
            New organization
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {summary && (
        <Grid container spacing={2.5} sx={{ mb: 1 }}>
          <Grid item xs={6} md={3}>
            <SummaryCard icon={CorporateFareRoundedIcon} label="Organizations" value={summary.organizations} />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryCard icon={GroupRoundedIcon} label="Total users" value={summary.users} color="secondary" />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryCard icon={ShieldRoundedIcon} label="Admins" value={summary.admins} color="warning" />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryCard icon={GroupRoundedIcon} label="Moderators" value={summary.moderators} color="info" />
          </Grid>
        </Grid>
      )}

      {orgs.length === 0 ? (
        <EmptyState
          icon={CorporateFareRoundedIcon}
          title="No organizations yet"
          description="Create your first organization. An admin@<domain> account is generated automatically."
          action={
            <Button variant="contained" startIcon={<AddBusinessRoundedIcon />} onClick={() => setCreateOpen(true)}>
              New organization
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          {orgs.map((org) => {
            const disabled = org.status === 'disabled';
            return (
              <Grid item xs={12} md={6} lg={4} key={org.id}>
                <Card sx={{ height: '100%', opacity: disabled ? 0.75 : 1 }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar variant="rounded" sx={{ bgcolor: 'primary.main' }}>
                          <CorporateFareRoundedIcon />
                        </Avatar>
                        <Box>
                          <Typography fontWeight={700}>{org.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            @{org.domain}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip
                        size="small"
                        label={disabled ? 'Disabled' : 'Active'}
                        color={disabled ? 'default' : 'success'}
                        variant={disabled ? 'outlined' : 'filled'}
                      />
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={`${org.counts.total} users`} />
                      <Chip size="small" variant="outlined" label={`${org.counts.admins} admins`} />
                      <Chip size="small" variant="outlined" label={`${org.counts.moderators} mods`} />
                      <Chip size="small" variant="outlined" label={`${org.counts.students} students`} />
                    </Stack>
                  </CardContent>
                  <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      color={disabled ? 'success' : 'warning'}
                      startIcon={disabled ? <PlayArrowRoundedIcon /> : <BlockRoundedIcon />}
                      disabled={busyId === org.id}
                      onClick={() => toggleStatus(org)}
                    >
                      {disabled ? 'Reactivate' : 'Disable'}
                    </Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="Permanently delete">
                      <IconButton color="error" size="small" onClick={() => setConfirm({ type: 'delete', org })}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create organization dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New organization</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Organization name"
              fullWidth
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Acme Business School"
            />
            <TextField
              label="Email domain"
              fullWidth
              required
              value={draft.domain}
              onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
              placeholder="acme.edu"
              helperText="Members must use emails on this domain. An admin@<domain> account is created automatically."
              InputProps={{ startAdornment: <InputAdornment position="start">@</InputAdornment> }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create organization'}
          </Button>
        </DialogActions>
      </Dialog>

      <AdminCredentialDialog data={credential} onClose={() => setCredential(null)} />

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Permanently delete organization?"
        message={`This permanently removes "${confirm?.org?.name}" and ALL of its users, assignments and to-dos. This cannot be undone.`}
        confirmLabel="Delete forever"
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
