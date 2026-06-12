import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  useRoles,
  useSaveRole,
  useDeleteRole,
  useUsers,
  useAssignUserRoles,
} from '../../queries/hooks.js';
import { permissionLabel } from '../../constants/permissions.js';
import { FLOATING_SELECT } from '../../constants/ui.js';
import { roleLabel, initials } from '../../utils/format.js';
import PageHeader from '../../components/PageHeader.jsx';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

const emptyDraft = () => ({ name: '', description: '', permissions: [] });

export default function RolesPage() {
  const { user: me } = useAuth();
  const { data, isPending } = useRoles();
  const saveRole = useSaveRole();
  const deleteRole = useDeleteRole();

  const scope = data?.scope;
  const isOrgScope = scope === 'organization';
  const roles = data?.roles || [];
  const catalog = data?.assignablePermissions || [];

  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setError('');
    setOpen(true);
  };
  const openEdit = (r) => {
    setDraft({ name: r.name, description: r.description || '', permissions: r.permissions || [] });
    setEditingId(r.id);
    setError('');
    setOpen(true);
  };

  const togglePerm = (key) =>
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(key)
        ? d.permissions.filter((p) => p !== key)
        : [...d.permissions, key],
    }));

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError('Role name is required.');
      return;
    }
    setError('');
    try {
      await saveRole.mutateAsync({ id: editingId, body: draft });
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    const id = confirm.id;
    setConfirm(null);
    try {
      await deleteRole.mutateAsync(id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (isPending) return <Loading />;

  return (
    <Box>
      <PageHeader
        title="Roles & Permissions"
        subtitle={
          isOrgScope
            ? 'Create custom roles for your organization and assign them to members.'
            : 'Create platform roles available across all organizations.'
        }
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} data-testid="new-role-button">
            New role
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {roles.length === 0 ? (
        <EmptyState
          icon={AdminPanelSettingsRoundedIcon}
          title="No custom roles yet"
          description="Built-in roles (Admin, Moderator, Student) always apply. Create custom roles to grant extra capabilities — e.g. a “Coordinator” who can manage courses and groups."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              New role
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2.5}>
          {roles.map((r) => (
            <Grid item xs={12} md={6} lg={4} key={r.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6">{r.name}</Typography>
                    {r.isSystem ? (
                      <Chip size="small" label="Built-in" />
                    ) : (
                      <Stack direction="row">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(r)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setConfirm(r)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Stack>
                  {r.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {r.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {r.permissions.length ? (
                      r.permissions.map((p) => (
                        <Chip key={p} size="small" variant="outlined" label={permissionLabel(p)} />
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No permissions
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {isOrgScope && <AssignRolesSection roles={roles} me={me} />}

      {/* Create / edit role */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit role' : 'New role'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Role name" fullWidth required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextField
              label="Description (optional)"
              fullWidth
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Permissions
              </Typography>
              <FormGroup>
                {catalog.map((p) => (
                  <FormControlLabel
                    key={p.key}
                    control={<Checkbox checked={draft.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} />}
                    label={p.label}
                  />
                ))}
              </FormGroup>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saveRole.isPending}>
            {saveRole.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Create role'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete role?"
        message={`Delete “${confirm?.name}”? It will be removed from every user who has it.`}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}

// ─── Assign custom roles to organization members ─────────────────────────────
function AssignRolesSection({ roles, me }) {
  const { data: usersData, isPending } = useUsers();
  const assign = useAssignUserRoles();
  const [editing, setEditing] = useState(null); // the user
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');

  const users = (usersData?.users || []).filter((u) => u.id !== me.id);

  const open = (u) => {
    setEditing(u);
    setSelected((u.roles || []).map((r) => r.id));
    setError('');
  };

  const save = async () => {
    try {
      await assign.mutateAsync({ userId: editing.id, roleIds: selected });
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" gutterBottom>
        Assign roles to members
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Grant a member extra capabilities by assigning them one or more custom roles.
      </Typography>

      {isPending ? (
        <Loading height="20vh" />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                  <TableCell>Member</TableCell>
                  <TableCell>Base role</TableCell>
                  <TableCell>Custom roles</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.light', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {initials(u.name)}
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{roleLabel(u.role)}</TableCell>
                    <TableCell>
                      {u.roles?.length ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {u.roles.map((r) => (
                            <Chip key={r.id} size="small" label={r.name} />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">None</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => open(u)}>
                        Edit roles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Roles for {editing?.name}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
              {error}
            </Alert>
          )}
          {roles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Create a custom role first.
            </Typography>
          ) : (
            <TextField
              select
              fullWidth
              label="Custom roles"
              sx={{ mt: 1 }}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              {...FLOATING_SELECT}
              SelectProps={{ multiple: true, displayEmpty: true, renderValue: (sel) => `${sel.length} selected` }}
            >
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  <Checkbox checked={selected.includes(r.id)} />
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={assign.isPending}>
            {assign.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
