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
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useAuth } from '../context/AuthContext.jsx';
import { can as canFn, canManageAnyAssignment } from '../utils/permissions.js';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useCourses,
} from '../queries/hooks.js';
import { useTranslation } from 'react-i18next';
import { initials, formatDateTime } from '../utils/format.js';
import { FLOATING_SELECT } from '../constants/ui.js';
import PageHeader from '../components/PageHeader.jsx';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DeadlineChip from '../components/DeadlineChip.jsx';

const emptyDraft = () => ({ title: '', body: '', dueAt: null, courseId: '' });

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canPost = canManageAnyAssignment(user);
  const isOrgManager = canFn(user, 'assignment:manage');

  const { data: announcements = [], isPending: loading } = useAnnouncements();
  const { data: courses = [] } = useCourses();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  // Subjects the user may tag: org managers can pick any active-semester course,
  // subject moderators only the courses they moderate.
  const myCourseIds = new Set((user.moderatedCourses || []).map((c) => String(c.id)));
  const subjectOptions = isOrgManager ? courses : courses.filter((c) => myCourseIds.has(String(c.id)));

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // the announcement to delete

  const openCreate = () => {
    setDraft(emptyDraft());
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError(t('announcements.errorTitleRequired'));
      return;
    }
    if (!draft.body.trim()) {
      setError(t('announcements.errorMessageRequired'));
      return;
    }
    setError('');
    try {
      await createAnnouncement.mutateAsync({
        title: draft.title.trim(),
        body: draft.body.trim(),
        dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
        courseId: draft.courseId || null,
      });
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    const target = confirm;
    setConfirm(null);
    try {
      await deleteAnnouncement.mutateAsync(target.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const canDelete = (a) => a.createdBy?.id === user.id || isOrgManager;

  return (
    <Box>
      <PageHeader
        title={t('announcements.title')}
        subtitle={t('announcements.subtitle')}
        action={
          canPost && (
            <Button variant="contained" startIcon={<CampaignRoundedIcon />} onClick={openCreate} data-testid="new-announcement-button">
              {t('announcements.new')}
            </Button>
          )
        }
      />

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Loading height="40vh" />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={CampaignRoundedIcon}
          title={t('announcements.emptyTitle')}
          description={
            canPost
              ? t('announcements.emptyDescriptionCanPost')
              : t('announcements.emptyDescriptionViewer')
          }
        />
      ) : (
        <Stack spacing={2} sx={{ maxWidth: 820 }}>
          {announcements.map((a) => (
            <Card key={a.id} data-testid={`announcement-card-${a.id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    {a.type === 'deadline' ? (
                      <Chip size="small" color="warning" variant="outlined" icon={<EventRoundedIcon />} label={t('announcements.typeDate')} />
                    ) : (
                      <Chip size="small" color="info" variant="outlined" icon={<InfoOutlinedIcon />} label={t('announcements.typeInfo')} />
                    )}
                    {a.subject && (
                      <Tooltip title={a.subject.title || ''}>
                        <Chip size="small" color="primary" variant="outlined" icon={<MenuBookRoundedIcon />} label={a.subject.code} />
                      </Tooltip>
                    )}
                    {a.dueAt && <DeadlineChip dueAt={a.dueAt} />}
                  </Stack>
                  {canDelete(a) && (
                    <Tooltip title={t('common.actions.delete')}>
                      <IconButton size="small" color="error" onClick={() => setConfirm(a)} data-testid={`announcement-delete-${a.id}`}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                <Typography variant="h6" sx={{ mt: 1 }}>
                  {a.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                  {a.body}
                </Typography>
                {a.dueAt && (
                  <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
                    {formatDateTime(a.dueAt)}
                  </Typography>
                )}

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
                  <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'primary.light' }}>
                    {initials(a.createdBy?.name)}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary">
                    {a.createdBy?.name ? t('announcements.postedBy', { name: a.createdBy.name }) : t('announcements.posted')} · {formatDateTime(a.createdAt)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Create dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ 'data-testid': 'announcement-form' }}>
        <DialogTitle>{t('announcements.dialogTitle')}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label={t('announcements.titleLabel')}
              fullWidth
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              inputProps={{ maxLength: 160, 'data-testid': 'announcement-title' }}
            />
            <TextField
              label={t('announcements.messageLabel')}
              fullWidth
              required
              multiline
              minRows={3}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              inputProps={{ maxLength: 4000, 'data-testid': 'announcement-body' }}
            />
            <TextField
              select
              label={t('announcements.subjectLabel')}
              fullWidth
              value={draft.courseId}
              onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
              {...FLOATING_SELECT}
              helperText={
                subjectOptions.length
                  ? t('announcements.subjectHelpHasCourses')
                  : t('announcements.subjectHelpNoCourses')
              }
              inputProps={{ 'data-testid': 'announcement-subject' }}
            >
              <MenuItem value="">{t('announcements.subjectGeneral')}</MenuItem>
              {subjectOptions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </MenuItem>
              ))}
            </TextField>
            <DateTimePicker
              label={t('announcements.dateLabel')}
              value={draft.dueAt}
              onChange={(v) => setDraft({ ...draft, dueAt: v })}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: t('announcements.dateHelp'),
                },
                field: { clearable: true },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={createAnnouncement.isPending} data-testid="announcement-save">
            {createAnnouncement.isPending ? t('announcements.posting') : t('announcements.post')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={t('announcements.deleteTitle')}
        message={t('announcements.deleteMessage', { title: confirm?.title })}
        confirmLabel={t('common.actions.delete')}
        confirmColor="error"
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
