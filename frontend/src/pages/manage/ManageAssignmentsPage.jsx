import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import LibraryAddRoundedIcon from '@mui/icons-material/LibraryAddRounded';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  useManagedAssignments,
  useCourses,
  useSaveAssignment,
  useDeleteAssignment,
} from '../../queries/hooks.js';
import { deadlineMeta, formatDateTime } from '../../utils/format.js';
import { SECTIONS, sectionLabel } from '../../constants/academics.js';
import { FLOATING_SELECT } from '../../constants/ui.js';
import PageHeader from '../../components/PageHeader.jsx';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

const sectionsLabel = (s) => (s && s.length ? s.map((x) => `Sec ${x}`).join(', ') : 'All sections');
const emptyDraft = () => ({ title: '', description: '', courseId: '', dueAt: null, attachmentUrl: '', sections: [] });

export default function ManageAssignmentsPage() {
  const { user: me } = useAuth();
  const isOrgManager = (me.permissions || []).includes('assignment:manage');

  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const { data: rows = [], isPending: loading } = useManagedAssignments();
  const { data: courses = [] } = useCourses();
  const saveAssignment = useSaveAssignment();
  const deleteAssignment = useDeleteAssignment();
  const saving = saveAssignment.isPending;

  // Courses the caller may post to: all (org manager) or only those moderated.
  const myCourseIds = new Set((me.moderatedCourses || []).map((c) => String(c.id)));
  const postable = isOrgManager ? courses : courses.filter((c) => myCourseIds.has(String(c.id)));
  const selectedCourse = postable.find((c) => String(c.id) === String(draft.courseId));

  const openCreate = () => {
    setDraft({ ...emptyDraft(), courseId: postable.length === 1 ? postable[0].id : '' });
    setEditingId(null);
    setError('');
    setOpen(true);
  };

  const openEdit = (a) => {
    setDraft({
      title: a.title,
      description: a.description || '',
      courseId: a.course?._id || a.course?.id || a.course,
      dueAt: new Date(a.dueAt),
      attachmentUrl: a.attachmentUrl || '',
      sections: a.sections || [],
    });
    setEditingId(a._id);
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.courseId || !draft.dueAt) {
      setError('Title, course and due date are required.');
      return;
    }
    setError('');
    const body = {
      title: draft.title,
      description: draft.description,
      courseId: draft.courseId,
      dueAt: new Date(draft.dueAt).toISOString(),
      attachmentUrl: draft.attachmentUrl,
      sections: draft.sections,
    };
    try {
      await saveAssignment.mutateAsync({ id: editingId, body });
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    try {
      await deleteAssignment.mutateAsync(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const noCourses = courses.length === 0;

  return (
    <Box>
      <PageHeader
        title="Manage Assignments"
        subtitle={
          isOrgManager
            ? 'Post deadlines for any course in the current semester.'
            : 'Post deadlines for the courses you moderate.'
        }
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} disabled={noCourses || postable.length === 0} data-testid="new-assignment-button">
            New assignment
          </Button>
        }
      />

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {noCourses && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No courses exist in the current semester yet. {isOrgManager ? 'Add courses under “Courses & Semester”.' : 'Ask an admin to add courses.'}
        </Alert>
      )}

      {loading ? (
        <Loading height="40vh" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={LibraryAddRoundedIcon}
          title="No assignments yet"
          description="Create the first assignment so students can see their deadlines."
          action={
            !noCourses && postable.length > 0 ? (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
                New assignment
              </Button>
            ) : null
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                  <TableCell>Title</TableCell>
                  <TableCell>Course</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Sections</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((a) => {
                  const meta = deadlineMeta(a.dueAt);
                  return (
                    <TableRow key={a._id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{a.title}</Typography>
                      </TableCell>
                      <TableCell>
                        {a.course?.code ? (
                          <Chip size="small" label={a.course.code} title={a.course.title} variant="outlined" />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={a.program} color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={a.sections?.length ? 'text.primary' : 'text.secondary'}>
                          {sectionsLabel(a.sections)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDateTime(a.dueAt)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(a)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setConfirmId(a._id)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit assignment' : 'New assignment'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <TextField
              select
              label="Course"
              fullWidth
              required
              value={draft.courseId}
              onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
              helperText={selectedCourse ? `Program: ${selectedCourse.program || '—'}` : 'Pick a course you can post to'}
            >
              {postable.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Sections"
                fullWidth
                value={draft.sections}
                onChange={(e) => setDraft({ ...draft, sections: e.target.value })}
                {...FLOATING_SELECT}
                SelectProps={{
                  multiple: true,
                  displayEmpty: true,
                  renderValue: (sel) => (sel.length ? sel.map((s) => `Section ${s}`).join(', ') : 'All sections'),
                }}
                helperText="Leave empty to target every section"
              >
                {SECTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {sectionLabel(s)}
                  </MenuItem>
                ))}
              </TextField>
              <DateTimePicker
                label="Due date & time"
                value={draft.dueAt}
                onChange={(v) => setDraft({ ...draft, dueAt: v })}
                slotProps={{ textField: { fullWidth: true, required: true } }}
              />
            </Stack>
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <TextField
              label="Brief / submission link (optional)"
              fullWidth
              placeholder="https://…"
              value={draft.attachmentUrl}
              onChange={(e) => setDraft({ ...draft, attachmentUrl: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} data-testid="save-assignment">
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Post assignment'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Delete assignment?"
        message="This will remove the assignment for all targeted students. This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmId(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
