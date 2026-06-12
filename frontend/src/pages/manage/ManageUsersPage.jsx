import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  useDeleteUser,
  useCourses,
  useSetUserModeratedCourses,
} from '../../queries/hooks.js';
import Checkbox from '@mui/material/Checkbox';
import { qk } from '../../queries/queryClient.js';
import { roleLabel, formatDate, initials } from '../../utils/format.js';
import { PROGRAMS, SECTIONS, sectionLabel } from '../../constants/academics.js';
import { FLOATING_SELECT } from '../../constants/ui.js';
import PageHeader from '../../components/PageHeader.jsx';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import BulkAddUsersDialog from '../../components/BulkAddUsersDialog.jsx';

const ROLE_COLORS = { admin: 'error', moderator: 'warning', student: 'primary' };
const ROLE_OPTIONS = ['student', 'moderator', 'admin'];
const emptyDraft = () => ({
  name: '',
  localPart: '',
  role: 'student',
  program: '',
  section: '',
  rollNumber: '',
  phone: '',
  enrollmentYear: '',
  moderatedCourseIds: [],
});

function CredentialDialog({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!data) return null;
  const copy = () => {
    navigator.clipboard?.writeText(data.generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Temporary password</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {data.emailDelivered
            ? 'A welcome email with these credentials has been sent to the user.'
            : 'Email delivery is not configured — share these credentials securely.'}
        </DialogContentText>
        <TextField
          label="Password"
          value={data.generatedPassword}
          fullWidth
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                  <IconButton onClick={copy} edge="end">
                    <ContentCopyRoundedIcon />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ManageUsersPage() {
  const { user: me, can } = useAuth();
  const domain = me.organization?.domain || '';
  const canModeration = can('course:manage');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState(''); // debounced
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(0); // 0-based for MUI TablePagination
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [editing, setEditing] = useState(null); // the user being edited, or null

  const [credential, setCredential] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type:'delete'|'reset', user }

  // Debounce the search box into the query param so each keystroke isn't a fetch.
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Any change to the filters returns us to the first page of results.
  useEffect(() => {
    setPage(0);
  }, [appliedSearch, roleFilter, rowsPerPage]);

  const params = {
    page: page + 1, // backend is 1-based
    limit: rowsPerPage,
    ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
    ...(appliedSearch ? { search: appliedSearch } : {}),
  };

  const qc = useQueryClient();
  // keepPreviousData avoids a loading flash (and layout jump) on page changes.
  const { data, isPending: loading, isPlaceholderData } = useUsers(params, {
    placeholderData: keepPreviousData,
  });
  const rows = data?.users ?? [];
  const total = data?.total ?? 0;

  const { data: courses = [] } = useCourses();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPw = useResetUserPassword();
  const removeUser = useDeleteUser();
  const setModeration = useSetUserModeratedCourses();
  const saving = createUser.isPending || updateUser.isPending || setModeration.isPending;

  // Courses a given user currently moderates, derived from the course list.
  const moderatedFor = (u) => courses.filter((c) => (c.moderators || []).some((m) => m.id === u.id));

  const openCreate = () => {
    setDraft(emptyDraft());
    setEditing(null);
    setError('');
    setOpen(true);
  };

  const openEdit = (u) => {
    setDraft({
      name: u.name,
      localPart: u.email.split('@')[0],
      role: u.role,
      program: u.program || '',
      section: u.section || '',
      rollNumber: u.rollNumber || '',
      phone: u.phone || '',
      enrollmentYear: u.enrollmentYear || '',
      moderatedCourseIds: moderatedFor(u).map((c) => c.id),
    });
    setEditing(u);
    setError('');
    setOpen(true);
  };

  // Mirrors backend rules so the form guides the user before submitting.
  const needsProgram = draft.role === 'student' || draft.role === 'moderator';
  const needsSection = draft.role === 'student';

  const validate = () => {
    if (!draft.name.trim()) return 'Name is required.';
    if (!editing && !draft.localPart.trim()) return 'Email username is required.';
    if (needsProgram && !draft.program) return 'Program is required for students and moderators.';
    if (needsSection && !draft.section) return 'Section is required for students.';
    return '';
  };

  const handleSave = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    const payload = {
      name: draft.name.trim(),
      role: draft.role,
      program: draft.program,
      section: needsSection ? draft.section : draft.section || '',
      rollNumber: draft.rollNumber.trim(),
      phone: draft.phone.trim(),
      enrollmentYear: draft.enrollmentYear.trim(),
    };
    try {
      if (editing) {
        await updateUser.mutateAsync({ id: editing.id, body: payload });
        // Apply subject-moderation changes (which courses this user moderates).
        if (canModeration && courses.length) {
          await setModeration.mutateAsync({ id: editing.id, courseIds: draft.moderatedCourseIds });
        }
        setOpen(false);
      } else {
        const created = await createUser.mutateAsync({
          ...payload,
          email: `${draft.localPart.trim()}@${domain}`,
        });
        setOpen(false);
        setCredential(created);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (u) => {
    // Optimistically flip in the cache, then persist (mutation invalidates).
    qc.setQueryData(qk.users(params), (old) =>
      old
        ? { ...old, users: old.users.map((r) => (r.id === u.id ? { ...r, isActive: !r.isActive } : r)) }
        : old,
    );
    try {
      await updateUser.mutateAsync({ id: u.id, body: { isActive: !u.isActive } });
    } catch (err) {
      setError(err.message);
    }
  };

  const doConfirm = async () => {
    const { type, user: u } = confirm;
    setConfirm(null);
    try {
      if (type === 'delete') await removeUser.mutateAsync(u.id);
      else if (type === 'reset') setCredential(await resetPw.mutateAsync(u.id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Manage Users"
        subtitle={`Add and manage members of your organization (@${domain}). Passwords are generated and emailed automatically.`}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => setBulkOpen(true)} data-testid="bulk-add-button">
              Bulk add
            </Button>
            <Button variant="contained" startIcon={<PersonAddRoundedIcon />} onClick={openCreate} data-testid="add-user-button">
              Add user
            </Button>
          </Stack>
        }
      />

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search name, email or roll no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ 'data-testid': 'user-search' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 280 }}
        />
        <TextField
          select
          size="small"
          label="Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All roles</MenuItem>
          <MenuItem value="student">Students</MenuItem>
          <MenuItem value="moderator">Moderators</MenuItem>
          <MenuItem value="admin">Admins</MenuItem>
        </TextField>
      </Stack>

      {loading ? (
        <Loading height="40vh" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={GroupRoundedIcon}
          title="No users found"
          description="Add a user to get started, or adjust your search."
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Moderates</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>Last login</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id} hover data-testid={`user-row-${u.id}`}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            bgcolor: 'primary.light',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials(u.name)}
                        </Box>
                        <Box>
                          <Typography fontWeight={600}>{u.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {u.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={roleLabel(u.role)} color={ROLE_COLORS[u.role]} />
                    </TableCell>
                    <TableCell>{u.program || '—'}</TableCell>
                    <TableCell>{u.section || '—'}</TableCell>
                    <TableCell>
                      {moderatedFor(u).length ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {moderatedFor(u).map((c) => (
                            <Chip key={c.id} size="small" color="secondary" variant="outlined" label={c.code} />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={u.isActive}
                        onChange={() => toggleActive(u)}
                        disabled={u.id === me.id}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(u)} data-testid={`user-edit-${u.id}`}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset password">
                        <IconButton size="small" onClick={() => setConfirm({ type: 'reset', user: u })} data-testid={`user-reset-${u.id}`}>
                          <LockResetRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={u.id === me.id}
                            onClick={() => setConfirm({ type: 'delete', user: u })}
                            data-testid={`user-delete-${u.id}`}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{ opacity: isPlaceholderData ? 0.6 : 1 }}
            data-testid="users-pagination"
          />
        </Card>
      )}

      {/* Create / edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ 'data-testid': 'user-dialog' }}>
        <DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }} data-testid="user-dialog-error">
              {error}
            </Alert>
          )}
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Full name"
              fullWidth
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              inputProps={{ 'data-testid': 'user-name' }}
            />
            {editing ? (
              <TextField label="Email" fullWidth value={editing.email} disabled helperText="Email cannot be changed." />
            ) : (
              <TextField
                label="Email username"
                fullWidth
                required
                value={draft.localPart}
                onChange={(e) => setDraft({ ...draft, localPart: e.target.value.replace(/@.*$/, '') })}
                inputProps={{ 'data-testid': 'user-email-username' }}
                InputProps={{ endAdornment: <InputAdornment position="end">@{domain}</InputAdornment> }}
                helperText={`Account: ${draft.localPart || 'username'}@${domain}`}
              />
            )}
            <TextField
              select
              label="Role"
              fullWidth
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {roleLabel(r)}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Program"
                fullWidth
                required={needsProgram}
                value={draft.program}
                onChange={(e) => setDraft({ ...draft, program: e.target.value })}
                helperText={needsProgram ? 'Required' : 'Optional for admins'}
                {...FLOATING_SELECT}
              >
                <MenuItem value="">— None —</MenuItem>
                {PROGRAMS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Section"
                fullWidth
                required={needsSection}
                value={draft.section}
                onChange={(e) => setDraft({ ...draft, section: e.target.value })}
                helperText={needsSection ? 'Required for students' : 'Optional'}
                {...FLOATING_SELECT}
              >
                <MenuItem value="">— None —</MenuItem>
                {SECTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {sectionLabel(s)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Roll number"
              fullWidth
              value={draft.rollNumber}
              onChange={(e) => setDraft({ ...draft, rollNumber: e.target.value })}
              placeholder="e.g. PGDM-101"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Phone"
                fullWidth
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
              <TextField
                label="Enrollment year"
                fullWidth
                value={draft.enrollmentYear}
                onChange={(e) => setDraft({ ...draft, enrollmentYear: e.target.value })}
                placeholder="2026"
              />
            </Stack>

            {/* Make this member a moderator of specific subjects (courses). */}
            {editing && canModeration && courses.length > 0 && (
              <TextField
                select
                label="Moderates subjects"
                fullWidth
                value={draft.moderatedCourseIds}
                onChange={(e) => setDraft({ ...draft, moderatedCourseIds: e.target.value })}
                {...FLOATING_SELECT}
                SelectProps={{
                  multiple: true,
                  renderValue: (sel) =>
                    sel.length
                      ? courses.filter((c) => sel.includes(c.id)).map((c) => c.code).join(', ')
                      : 'None — not a moderator',
                  displayEmpty: true,
                }}
                helperText="Grants this member rights to post assignments for the selected courses only."
              >
                {courses.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <Checkbox checked={draft.moderatedCourseIds.includes(c.id)} />
                    {c.code} · {c.title}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} data-testid="user-cancel">Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} data-testid="user-save">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
          </Button>
        </DialogActions>
      </Dialog>

      <CredentialDialog data={credential} onClose={() => setCredential(null)} />

      <BulkAddUsersDialog open={bulkOpen} onClose={() => setBulkOpen(false)} domain={domain} />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'delete' ? 'Delete user?' : 'Reset password?'}
        message={
          confirm?.type === 'delete'
            ? `This permanently removes ${confirm?.user?.name} and their to-dos.`
            : `A new temporary password will be emailed to ${confirm?.user?.name}. Because their to-do board is end-to-end encrypted with a key derived from their password, resetting it clears their existing encrypted tasks.`
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : 'Reset password'}
        confirmColor={confirm?.type === 'delete' ? 'error' : 'primary'}
        onCancel={() => setConfirm(null)}
        onConfirm={doConfirm}
      />
    </Box>
  );
}
