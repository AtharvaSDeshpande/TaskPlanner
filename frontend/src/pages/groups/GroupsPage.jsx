import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import { useAuth } from '../../context/AuthContext.jsx';
import { useGroups, useCreateGroup } from '../../queries/hooks.js';
import { initials } from '../../utils/format.js';
import PageHeader from '../../components/PageHeader.jsx';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import UserSearchAutocomplete from '../../components/UserSearchAutocomplete.jsx';

export default function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });
  const [members, setMembers] = useState([]); // selected user objects

  const { data: groups = [], isPending: loading } = useGroups();
  const createGroup = useCreateGroup();
  const saving = createGroup.isPending;

  const closeDialog = () => {
    setOpen(false);
    setDraft({ name: '', description: '' });
    setMembers([]);
    setError('');
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      setError('Group name is required.');
      return;
    }
    setError('');
    try {
      const data = await createGroup.mutateAsync({
        name: draft.name.trim(),
        description: draft.description.trim(),
        memberEmails: members.map((m) => m.email),
      });
      closeDialog();
      navigate(`/groups/${data.group.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Groups"
        subtitle="Collaborate with classmates on group assignments using a shared task board."
        action={
          <Button variant="contained" startIcon={<GroupAddRoundedIcon />} onClick={() => setOpen(true)} data-testid="new-group-button">
            New group
          </Button>
        }
      />

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Alert severity="info" variant="outlined" sx={{ mb: 2.5 }}>
        Group boards are shared with all members, so unlike your personal to-do board they are{' '}
        <b>not encrypted</b>. Keep private notes on your personal board.
      </Alert>

      {loading ? (
        <Loading height="40vh" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Diversity3RoundedIcon}
          title="No groups yet"
          description="Create a group and add members by their organization email to start collaborating."
          action={
            <Button variant="contained" startIcon={<GroupAddRoundedIcon />} onClick={() => setOpen(true)}>
              New group
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2.5}>
          {groups.map((g) => (
            <Grid item xs={12} sm={6} lg={4} key={g.id}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea onClick={() => navigate(`/groups/${g.id}`)} sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Avatar variant="rounded" sx={{ bgcolor: 'secondary.main' }}>
                        <Diversity3RoundedIcon />
                      </Avatar>
                      {g.isOwner && <Chip size="small" color="primary" label="Owner" />}
                    </Stack>
                    <Typography variant="h6" sx={{ mt: 1.5 }}>
                      {g.name}
                    </Typography>
                    {g.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {g.description}
                      </Typography>
                    )}
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                      <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: 12 } }}>
                        {g.members.map((m) => (
                          <Avatar key={m.id}>{initials(m.name)}</Avatar>
                        ))}
                      </AvatarGroup>
                      <Typography variant="caption" color="text.secondary">
                        {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>New group</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Group name"
              fullWidth
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              minRows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <UserSearchAutocomplete
              value={members}
              onChange={setMembers}
              excludeIds={[user.id]}
              label="Add members"
              helperText="Search classmates by name, email or roll number. You're added automatically."
              testId="group-member-search"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create group'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
