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
  DialogContentText,
  DialogTitle,
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
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  useActiveSemester,
  useStartSemester,
  useCourses,
  useSaveCourse,
  useSetCourseModerators,
  useDeleteCourse,
  useGenerateGroups,
  useUsers,
} from '../../queries/hooks.js';
import { PROGRAMS, SECTIONS, sectionLabel } from '../../constants/academics.js';
import { FLOATING_SELECT } from '../../constants/ui.js';
import { formatDate, initials } from '../../utils/format.js';
import PageHeader from '../../components/PageHeader.jsx';
import Loading from '../../components/Loading.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

const emptyCourse = () => ({ code: '', title: '', program: '' });

export default function SemesterPage() {
  const { can } = useAuth();
  const { data: semester, isPending } = useActiveSemester();
  const { data: courses = [] } = useCourses();
  const { data: usersData } = useUsers({}, { enabled: can('course:manage') || can('group:manage') });
  const orgUsers = usersData?.users || [];

  const startSemester = useStartSemester();
  const saveCourse = useSaveCourse();
  const setModerators = useSetCourseModerators();
  const deleteCourse = useDeleteCourse();
  const generate = useGenerateGroups();

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Start-semester dialog
  const [startOpen, setStartOpen] = useState(false);
  const [startDraft, setStartDraft] = useState({ name: '', password: '' });

  // Course add/edit dialog
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseDraft, setCourseDraft] = useState(emptyCourse());
  const [editingCourseId, setEditingCourseId] = useState(null);

  // Moderators dialog
  const [modCourse, setModCourse] = useState(null);
  const [modIds, setModIds] = useState([]);

  // Generate-groups dialog
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ program: '', section: '', size: 4, namePrefix: '' });

  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(null);

  if (isPending) return <Loading />;

  // ── Start semester ──
  const submitStart = async () => {
    if (!startDraft.name.trim() || !startDraft.password) {
      setError('A semester name and your password are required.');
      return;
    }
    setError('');
    try {
      const res = await startSemester.mutateAsync({ name: startDraft.name.trim(), password: startDraft.password });
      setStartOpen(false);
      setStartDraft({ name: '', password: '' });
      setNotice(res.message);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Courses ──
  const openCreateCourse = () => {
    setCourseDraft(emptyCourse());
    setEditingCourseId(null);
    setError('');
    setCourseOpen(true);
  };
  const openEditCourse = (c) => {
    setCourseDraft({ code: c.code, title: c.title, program: c.program || '' });
    setEditingCourseId(c.id);
    setError('');
    setCourseOpen(true);
  };
  const submitCourse = async () => {
    if (!courseDraft.code.trim() || !courseDraft.title.trim()) {
      setError('Course code and title are required.');
      return;
    }
    setError('');
    try {
      await saveCourse.mutateAsync({ id: editingCourseId, body: courseDraft });
      setCourseOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const openModerators = (c) => {
    setModCourse(c);
    setModIds((c.moderators || []).map((m) => m.id));
  };
  const submitModerators = async () => {
    try {
      await setModerators.mutateAsync({ id: modCourse.id, userIds: modIds });
      setModCourse(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const doDeleteCourse = async () => {
    const id = confirmDeleteCourse.id;
    setConfirmDeleteCourse(null);
    try {
      await deleteCourse.mutateAsync(id);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Generate groups ──
  const submitGenerate = async () => {
    if (!gen.program) {
      setError('Choose a program.');
      return;
    }
    setError('');
    try {
      const res = await generate.mutateAsync({
        program: gen.program,
        section: gen.section || undefined,
        size: Number(gen.size),
        namePrefix: gen.namePrefix || undefined,
      });
      setGenOpen(false);
      setNotice(res.message);
    } catch (err) {
      setError(err.message);
    }
  };

  const canCourses = can('course:manage');

  return (
    <Box>
      <PageHeader title="Courses & Semester" subtitle="Manage the active term, its courses and student groups." />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 1 }}>
        {/* Active semester */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <CalendarMonthRoundedIcon color="primary" />
                <Typography variant="h6">Active semester</Typography>
              </Stack>
              {semester ? (
                <>
                  <Typography variant="h5">{semester.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Started {formatDate(semester.startedAt)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active semester.
                </Typography>
              )}
              {can('semester:manage') && (
                <Button
                  sx={{ mt: 2 }}
                  variant="outlined"
                  color="warning"
                  startIcon={<RestartAltRoundedIcon />}
                  onClick={() => setStartOpen(true)}
                  data-testid="start-semester-button"
                >
                  Start new semester
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Generate groups */}
        {can('group:manage') && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <GroupAddRoundedIcon color="secondary" />
                  <Typography variant="h6">Student groups</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Auto-partition students of a program/section into evenly-sized groups for the
                  current semester.
                </Typography>
                <Button variant="contained" color="secondary" startIcon={<GroupAddRoundedIcon />} onClick={() => setGenOpen(true)} disabled={!semester} data-testid="generate-groups-button">
                  Generate groups
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Courses */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3, mb: 1.5 }}>
        <Typography variant="h6">Courses</Typography>
        {canCourses && (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateCourse} disabled={!semester} data-testid="add-course-button">
            Add course
          </Button>
        )}
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                <TableCell>Code</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Program</TableCell>
                <TableCell>Moderators</TableCell>
                {canCourses && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {courses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canCourses ? 5 : 4}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No courses in this semester yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                courses.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Chip size="small" label={c.code} variant="outlined" />
                    </TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{c.program || '—'}</TableCell>
                    <TableCell>
                      {c.moderators?.length ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {c.moderators.map((m) => (
                            <Chip key={m.id} size="small" label={m.name} />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">None</Typography>
                      )}
                    </TableCell>
                    {canCourses && (
                      <TableCell align="right">
                        <Tooltip title="Moderators">
                          <Button size="small" onClick={() => openModerators(c)}>
                            Moderators
                          </Button>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditCourse(c)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setConfirmDeleteCourse(c)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Start semester dialog */}
      <Dialog open={startOpen} onClose={() => setStartOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Start a new semester</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This archives the current semester. Assignments and groups reset for the new term;
            students’ personal to-do boards are <b>untouched</b>. Confirm with your password.
          </DialogContentText>
          <Stack spacing={2}>
            <TextField label="New semester name" fullWidth required placeholder="e.g. Spring 2027" value={startDraft.name} onChange={(e) => setStartDraft({ ...startDraft, name: e.target.value })} />
            <TextField label="Your password" type="password" fullWidth required value={startDraft.password} onChange={(e) => setStartDraft({ ...startDraft, password: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStartOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={submitStart} disabled={startSemester.isPending}>
            {startSemester.isPending ? 'Starting…' : 'Start semester'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Course add/edit dialog */}
      <Dialog open={courseOpen} onClose={() => setCourseOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingCourseId ? 'Edit course' : 'Add course'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Course code" fullWidth required placeholder="FIN101" value={courseDraft.code} onChange={(e) => setCourseDraft({ ...courseDraft, code: e.target.value })} />
            <TextField label="Title" fullWidth required value={courseDraft.title} onChange={(e) => setCourseDraft({ ...courseDraft, title: e.target.value })} />
            <TextField select label="Program" fullWidth value={courseDraft.program} onChange={(e) => setCourseDraft({ ...courseDraft, program: e.target.value })} helperText="Required to post assignments for this course" {...FLOATING_SELECT}>
              <MenuItem value="">— None —</MenuItem>
              {PROGRAMS.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCourseOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCourse} disabled={saveCourse.isPending}>
            {saveCourse.isPending ? 'Saving…' : editingCourseId ? 'Save' : 'Add course'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Moderators dialog */}
      <Dialog open={Boolean(modCourse)} onClose={() => setModCourse(null)} fullWidth maxWidth="xs">
        <DialogTitle>Moderators · {modCourse?.code}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Moderators can post and edit assignments for this course only.
          </DialogContentText>
          <TextField
            select
            fullWidth
            label="Moderators"
            value={modIds}
            onChange={(e) => setModIds(e.target.value)}
            {...FLOATING_SELECT}
            SelectProps={{ multiple: true, displayEmpty: true, renderValue: (sel) => `${sel.length} selected` }}
          >
            {orgUsers.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                <Checkbox checked={modIds.includes(u.id)} />
                {u.name} · {u.email}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModCourse(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitModerators} disabled={setModerators.isPending}>
            {setModerators.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate groups dialog */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Generate student groups</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField select label="Program" fullWidth required value={gen.program} onChange={(e) => setGen({ ...gen, program: e.target.value })}>
              {PROGRAMS.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Section (optional)" fullWidth value={gen.section} onChange={(e) => setGen({ ...gen, section: e.target.value })} {...FLOATING_SELECT}>
              <MenuItem value="">All sections</MenuItem>
              {SECTIONS.map((s) => (
                <MenuItem key={s} value={s}>{sectionLabel(s)}</MenuItem>
              ))}
            </TextField>
            <TextField type="number" label="Group size" fullWidth value={gen.size} onChange={(e) => setGen({ ...gen, size: e.target.value })} inputProps={{ min: 2 }} />
            <TextField label="Name prefix (optional)" fullWidth placeholder="e.g. Team" value={gen.namePrefix} onChange={(e) => setGen({ ...gen, namePrefix: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={submitGenerate} disabled={generate.isPending}>
            {generate.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDeleteCourse)}
        title="Delete course?"
        message={`Delete “${confirmDeleteCourse?.title}”? Its assignments will also be deleted.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteCourse(null)}
        onConfirm={doDeleteCourse}
      />
    </Box>
  );
}
