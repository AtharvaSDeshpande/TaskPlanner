import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  useGroup,
  useGroupTodos,
  useGroupMembers,
  useGroupTodoMutations,
  useDeleteGroup,
} from '../../queries/hooks.js';
import { qk } from '../../queries/queryClient.js';
import { initials, byDeadline } from '../../utils/format.js';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DeadlineChip from '../../components/DeadlineChip.jsx';
import UserSearchAutocomplete from '../../components/UserSearchAutocomplete.jsx';

const emptyTask = () => ({ title: '', notes: '', dueDate: null, assignedTo: '' });

export default function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [taskOpen, setTaskOpen] = useState(false);
  const [task, setTask] = useState(emptyTask());
  const [editingId, setEditingId] = useState(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [newMembers, setNewMembers] = useState([]); // selected user objects to add
  const [confirm, setConfirm] = useState(null); // { type, ... }

  const qc = useQueryClient();
  const { data: group, isPending: loading, error: loadError } = useGroup(id);
  const { data: todos = [] } = useGroupTodos(id);
  const todoMut = useGroupTodoMutations(id);
  const members = useGroupMembers(id);
  const deleteGroup = useDeleteGroup();
  const savingTask = todoMut.save.isPending;

  if (loading) return <Loading />;
  if (loadError && !group) {
    return (
      <Box>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/groups')} sx={{ mb: 2 }}>
          Back to groups
        </Button>
        <Alert severity="error">{loadError.message}</Alert>
      </Box>
    );
  }

  const isOwner = group.isOwner;

  const openCreateTask = () => {
    setTask(emptyTask());
    setEditingId(null);
    setTaskOpen(true);
  };
  const openEditTask = (t) => {
    setTask({
      title: t.title,
      notes: t.notes || '',
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      assignedTo: t.assignedTo?.id || '',
    });
    setEditingId(t.id);
    setTaskOpen(true);
  };

  const saveTask = async () => {
    if (!task.title.trim()) return;
    const body = {
      title: task.title.trim(),
      notes: task.notes.trim(),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      assignedTo: task.assignedTo || null,
    };
    try {
      await todoMut.save.mutateAsync({ todoId: editingId, body });
      setTaskOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (t) => {
    // Optimistic flip in the cache; the mutation invalidates to re-sync.
    qc.setQueryData(qk.groupTodos(id), (old) =>
      old?.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)),
    );
    try {
      await todoMut.save.mutateAsync({ todoId: t.id, body: { completed: !t.completed } });
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTask = async (taskId) => {
    qc.setQueryData(qk.groupTodos(id), (old) => old?.filter((x) => x.id !== taskId));
    try {
      await todoMut.remove.mutateAsync(taskId);
    } catch (err) {
      setError(err.message);
    }
  };

  const addMembers = async () => {
    if (!newMembers.length) return;
    try {
      await members.add.mutateAsync(newMembers.map((m) => m.email));
      setNewMembers([]);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMember = async (userId) => {
    try {
      await members.remove.mutateAsync(userId);
    } catch (err) {
      setError(err.message);
    }
  };

  const doConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.type === 'deleteGroup') {
        await deleteGroup.mutateAsync(id);
        navigate('/groups');
      } else if (c.type === 'leave') {
        await members.remove.mutateAsync(user.id);
        navigate('/groups');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const remaining = todos.filter((t) => !t.completed).length;
  // Open tasks first, then completed; within each, soonest deadline first.
  const sortedTodos = [...todos].sort(
    (a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0) || byDeadline((t) => t.dueDate)(a, b),
  );

  return (
    <Box>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/groups')} sx={{ mb: 2 }}>
        Back to groups
      </Button>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5">{group.name}</Typography>
          {group.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {group.description}
            </Typography>
          )}
          <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            {group.members.map((m) => (
              <Chip
                key={m.id}
                size="small"
                avatar={<Avatar>{initials(m.name)}</Avatar>}
                label={m.id === group.owner ? `${m.name} (owner)` : m.name}
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {isOwner ? (
            <>
              <Button variant="outlined" startIcon={<PersonAddRoundedIcon />} onClick={() => setMembersOpen(true)}>
                Members
              </Button>
              <Button color="error" variant="outlined" onClick={() => setConfirm({ type: 'deleteGroup' })}>
                Delete
              </Button>
            </>
          ) : (
            <Button color="error" variant="outlined" startIcon={<LogoutRoundedIcon />} onClick={() => setConfirm({ type: 'leave' })}>
              Leave
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">
          Shared board{' '}
          <Typography component="span" variant="body2" color="text.secondary">
            · {remaining} open
          </Typography>
        </Typography>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateTask}>
          New task
        </Button>
      </Stack>

      {todos.length === 0 ? (
        <EmptyState
          title="No shared tasks yet"
          description="Add the first task to divide up the work for your group assignment."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateTask}>
              Add a task
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2.5}>
          {sortedTodos.map((t) => (
            <Grid item xs={12} sm={6} lg={4} key={t.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: t.completed ? 0.85 : 1,
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    {t.assignedTo ? (
                      <Chip size="small" avatar={<Avatar>{initials(t.assignedTo.name)}</Avatar>} label={t.assignedTo.name} />
                    ) : (
                      <Chip size="small" variant="outlined" label="Unassigned" />
                    )}
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      {t.completed && <Chip size="small" color="success" label="Done" icon={<CheckCircleRoundedIcon />} />}
                      <DeadlineChip dueAt={t.dueDate} done={t.completed} />
                    </Stack>
                  </Stack>
                  <Typography
                    variant="h6"
                    sx={{
                      mt: 1.5,
                      fontSize: '1.05rem',
                      textDecoration: t.completed ? 'line-through' : 'none',
                      color: t.completed ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {t.title}
                  </Typography>
                  {t.notes && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                      {t.notes}
                    </Typography>
                  )}
                </CardContent>
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {t.completed && t.completedBy
                      ? `Done by ${t.completedBy.name}`
                      : t.createdBy
                        ? `Added by ${t.createdBy.name}`
                        : ''}
                  </Typography>
                  <Stack direction="row" alignItems="center">
                    <Button
                      size="small"
                      color={t.completed ? 'success' : 'primary'}
                      startIcon={t.completed ? <CheckCircleRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
                      onClick={() => toggle(t)}
                      sx={{ flexShrink: 0 }}
                    >
                      {t.completed ? 'Done' : 'Mark done'}
                    </Button>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditTask(t)}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => deleteTask(t.id)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Task dialog */}
      <Dialog open={taskOpen} onClose={() => setTaskOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit task' : 'New task'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth required autoFocus value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
            <TextField label="Notes (optional)" fullWidth multiline minRows={2} value={task.notes} onChange={(e) => setTask({ ...task, notes: e.target.value })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <DateTimePicker
                label="Due date (optional)"
                value={task.dueDate}
                onChange={(v) => setTask({ ...task, dueDate: v })}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <TextField
                select
                label="Assign to"
                fullWidth
                value={task.assignedTo}
                onChange={(e) => setTask({ ...task, assignedTo: e.target.value })}
              >
                <MenuItem value="">— Unassigned —</MenuItem>
                {group.members.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTaskOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveTask} disabled={savingTask || !task.title.trim()}>
            {savingTask ? 'Saving…' : 'Save task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members dialog (owner) */}
      <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Manage members</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
            {group.members.map((m) => (
              <Stack key={m.id} direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>{initials(m.name)}</Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {m.name} {m.id === group.owner && <Chip size="small" label="Owner" sx={{ ml: 0.5, height: 18 }} />}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m.email}
                  </Typography>
                </Box>
                {m.id !== group.owner && (
                  <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => removeMember(m.id)}>
                      <PersonRemoveRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Stack>
          <UserSearchAutocomplete
            value={newMembers}
            onChange={setNewMembers}
            excludeIds={group.members.map((m) => m.id)}
            label="Add members"
            helperText="Search by name, email or roll number. Current members are excluded."
            testId="group-add-member-search"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMembersOpen(false)}>Close</Button>
          <Button variant="contained" onClick={addMembers} disabled={!newMembers.length || members.add.isPending}>
            {members.add.isPending ? 'Adding…' : 'Add members'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'deleteGroup' ? 'Delete group?' : 'Leave group?'}
        message={
          confirm?.type === 'deleteGroup'
            ? 'This permanently deletes the group and its shared board for everyone.'
            : 'You will lose access to this group and its shared board.'
        }
        confirmLabel={confirm?.type === 'deleteGroup' ? 'Delete' : 'Leave'}
        onCancel={() => setConfirm(null)}
        onConfirm={doConfirm}
      />
    </Box>
  );
}
