import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useAuth } from '../context/AuthContext.jsx';
import { useEncryptedTodos, useTodoMutations } from '../queries/hooks.js';
import { encryptObject, decryptObject } from '../crypto/e2e.js';
import { byDeadline } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Loading from '../components/Loading.jsx';
import DeadlineChip from '../components/DeadlineChip.jsx';

// Board columns. `status` is stored inside the (encrypted) to-do payload, so
// the whole Kanban is client-side only — the server still sees just ciphertext.
const COLUMNS = [
  { key: 'todo', label: 'To Do', chipColor: 'default', accent: 'info.main' },
  { key: 'inprogress', label: 'In Progress', chipColor: 'warning', accent: 'warning.main' },
  { key: 'done', label: 'Done', chipColor: 'success', accent: 'success.main' },
];
const STATUS_KEYS = COLUMNS.map((c) => c.key);
const labelFor = (key) => COLUMNS.find((c) => c.key === key)?.label || key;

const EMPTY = { title: '', notes: '', dueDate: null, status: 'todo' };

// Normalises a decrypted item, migrating legacy { completed } items to a status.
function normalizeStatus(obj) {
  if (obj.status && STATUS_KEYS.includes(obj.status)) return obj.status;
  return obj.completed ? 'done' : 'todo';
}

// Prompts for the password when the encryption key isn't in this tab's session.
// The password is used only to re-derive the key locally — it never goes to the
// server beyond the normal login check.
function UnlockGate({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onUnlock(password);
    } catch (err) {
      setError(err.message || 'Could not unlock. Check your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 460, mx: 'auto', mt: 6 }}>
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <LockRoundedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            Unlock your encrypted board
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your board is end-to-end encrypted. Re-enter your password to unlock it on this device —
            it never leaves your browser.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={submit}>
            <TextField
              label="Password"
              type={show ? 'text' : 'password'}
              fullWidth
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={busy}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function TodosPage() {
  const { cryptoKey, unlock } = useAuth();
  const [items, setItems] = useState([]); // decrypted, with optimistic updates
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  // Drag-and-drop + per-card menu state.
  const [draggingId, setDraggingId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [menu, setMenu] = useState({ anchor: null, item: null });

  // React Query caches the raw ciphertext list; decryption happens client-side.
  const { data: rawTodos, isPending, error: queryError } = useEncryptedTodos(cryptoKey);
  const { save, remove } = useTodoMutations();
  const saving = save.isPending;

  // Decrypt whenever the ciphertext list or the key changes.
  useEffect(() => {
    if (!cryptoKey || !rawTodos) return undefined;
    let active = true;
    setDecrypting(true);
    (async () => {
      const decrypted = await Promise.all(
        rawTodos.map(async (t) => {
          try {
            const obj = await decryptObject(cryptoKey, t.ciphertext, t.iv);
            return { id: t.id, ...EMPTY, ...obj, status: normalizeStatus(obj), updatedAt: t.updatedAt };
          } catch {
            return { id: t.id, title: '🔒 Unable to decrypt', status: 'todo', undecryptable: true };
          }
        }),
      );
      if (active) {
        setItems(decrypted);
        setDecrypting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [rawTodos, cryptoKey]);

  useEffect(() => {
    if (queryError) setError(queryError.message);
  }, [queryError]);

  const loading = isPending || decrypting;

  // On a fresh tab the token is restored but the key isn't — prompt to unlock.
  if (!cryptoKey) {
    return (
      <Box>
        <PageHeader title="My To-Do Board" subtitle="Private, end-to-end encrypted task board." />
        <UnlockGate onUnlock={unlock} />
      </Box>
    );
  }

  const openCreate = (status = 'todo') => {
    setDraft({ ...EMPTY, status });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setDraft({
      title: item.title,
      notes: item.notes || '',
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
      status: item.status,
    });
    setEditingId(item.id);
    setDialogOpen(true);
    setMenu({ anchor: null, item: null });
  };

  const encrypt = (payload) =>
    encryptObject(cryptoKey, {
      title: payload.title.trim(),
      notes: payload.notes?.trim() || '',
      dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : null,
      status: STATUS_KEYS.includes(payload.status) ? payload.status : 'todo',
    });

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    try {
      const body = await encrypt(draft);
      await save.mutateAsync({ id: editingId, body });
      setDialogOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  // Moves a card to a new column, re-encrypting the whole item (optimistic).
  const moveTo = async (item, status) => {
    if (item.status === status || item.undecryptable) return;
    const next = { ...item, status };
    setItems((prev) => prev.map((i) => (i.id === item.id ? next : i)));
    try {
      const body = await encrypt(next);
      await save.mutateAsync({ id: item.id, body });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setMenu({ anchor: null, item: null });
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const onDrop = (status) => {
    setOverCol(null);
    const item = items.find((i) => i.id === draggingId);
    setDraggingId(null);
    if (item) moveTo(item, status);
  };

  const remaining = items.filter((i) => i.status !== 'done').length;
  // Cards within each column are ordered by soonest deadline first.
  const byStatus = (key) => items.filter((i) => i.status === key).sort(byDeadline((i) => i.dueDate));

  return (
    <Box>
      <PageHeader
        title="My To-Do Board"
        subtitle={
          <Stack direction="row" spacing={1} alignItems="center">
            <LockRoundedIcon sx={{ fontSize: 16 }} color="success" />
            <span>
              Encrypted &amp; private to you · {remaining} task{remaining === 1 ? '' : 's'} open ·
              drag cards between columns
            </span>
          </Stack>
        }
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreate('todo')} data-testid="new-task-button">
            New task
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Loading height="40vh" />
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
          {COLUMNS.map((col) => {
            const colItems = byStatus(col.key);
            const isOver = overCol === col.key;
            return (
              <Box
                key={col.key}
                data-testid={`todo-column-${col.key}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingId) setOverCol(col.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(col.key);
                }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: isOver ? col.accent : 'divider',
                  borderRadius: 3,
                  p: 1.5,
                  transition: 'border-color .15s ease, background-color .15s ease',
                  ...(isOver && { boxShadow: (t) => `inset 0 0 0 1px ${t.palette.divider}` }),
                }}
              >
                {/* Column header */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ px: 0.5, mb: 1.5, borderTop: '3px solid', borderTopColor: col.accent, pt: 1, borderRadius: 1 }}
                >
                  <Typography variant="subtitle2" sx={{ flexGrow: 1, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {col.label}
                  </Typography>
                  <Chip size="small" label={colItems.length} color={col.chipColor} />
                  <Tooltip title={`Add to ${col.label}`}>
                    <IconButton size="small" onClick={() => openCreate(col.key)}>
                      <AddRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Cards */}
                <Stack spacing={1.25} sx={{ minHeight: 80 }}>
                  {colItems.length === 0 && (
                    <Box
                      sx={{
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        py: 3,
                        textAlign: 'center',
                        color: 'text.secondary',
                      }}
                    >
                      <Typography variant="caption">Drop tasks here</Typography>
                    </Box>
                  )}
                  {colItems.map((item) => {
                    const isDone = item.status === 'done';
                    return (
                      <Card
                        key={item.id}
                        data-testid={`todo-card-${item.id}`}
                        draggable={!item.undecryptable}
                        onDragStart={(e) => {
                          setDraggingId(item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverCol(null);
                        }}
                        sx={{
                          cursor: item.undecryptable ? 'default' : 'grab',
                          borderLeft: '3px solid',
                          borderLeftColor: col.accent,
                          opacity: draggingId === item.id ? 0.4 : 1,
                          '&:active': { cursor: 'grabbing' },
                        }}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                            <DragIndicatorRoundedIcon
                              fontSize="small"
                              sx={{ color: 'text.disabled', mt: 0.25, display: { xs: 'none', md: 'block' } }}
                            />
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography
                                fontWeight={600}
                                sx={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'text.secondary' : 'text.primary' }}
                              >
                                {item.title}
                              </Typography>
                              {item.notes && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                  {item.notes}
                                </Typography>
                              )}
                              {item.dueDate && (
                                <Box sx={{ mt: 1 }}>
                                  <DeadlineChip dueAt={item.dueDate} done={isDone} />
                                </Box>
                              )}
                            </Box>
                            {!item.undecryptable && (
                              <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, item })}>
                                <MoreVertRoundedIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Per-card menu: edit, move between columns, delete */}
      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={() => setMenu({ anchor: null, item: null })}
      >
        <MenuItem onClick={() => openEdit(menu.item)}>
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <Divider />
        {STATUS_KEYS.filter((k) => k !== menu.item?.status).map((k) => (
          <MenuItem
            key={k}
            onClick={() => {
              moveTo(menu.item, k);
              setMenu({ anchor: null, item: null });
            }}
          >
            <ListItemIcon>
              <ArrowForwardRoundedIcon fontSize="small" />
            </ListItemIcon>
            Move to {labelFor(k)}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => handleDelete(menu.item.id)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit task' : 'New task'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              required
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <TextField
              label="Notes (optional)"
              fullWidth
              multiline
              minRows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <DateTimePicker
                label="Due date (optional)"
                value={draft.dueDate}
                onChange={(v) => setDraft({ ...draft, dueDate: v })}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <TextField
                select
                label="Column"
                fullWidth
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                {COLUMNS.map((c) => (
                  <MenuItem key={c.key} value={c.key}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Alert severity="success" icon={<LockRoundedIcon />} sx={{ alignItems: 'center' }}>
              This task is encrypted on your device before it's saved.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !draft.title.trim()}>
            {saving ? 'Saving…' : 'Save task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
