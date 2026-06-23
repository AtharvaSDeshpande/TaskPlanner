import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  MenuItem,
} from '@mui/material';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import { useAssignments, useSetAssignmentProgress } from '../queries/hooks.js';
import { qk } from '../queries/queryClient.js';
import { formatDateTime } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DeadlineChip from '../components/DeadlineChip.jsx';

const SCOPES = ['upcoming', 'past', 'all'];

export default function DeadlinesPage() {
  const { user } = useAuth();
  const isStudent = user.role === 'student';
  const [scope, setScope] = useState(0);
  const [course, setCourse] = useState('all');
  const scopeKey = SCOPES[scope];

  const qc = useQueryClient();
  // Cached per scope — revisiting a tab within staleTime is instant, no spinner.
  const { data: assignments = [], isPending: loading } = useAssignments(scopeKey);
  const progress = useSetAssignmentProgress();

  // Optimistically update the cache, then persist. In the "Upcoming" tab a
  // completed assignment leaves the list (it lives under Past/All); elsewhere we
  // just flip its done flag. On error we re-fetch to resync.
  const toggleDone = (a) => {
    const nextDone = !a.done;
    qc.setQueryData(qk.assignments(scopeKey), (old) => {
      if (!old) return old;
      if (scopeKey === 'upcoming' && nextDone) return old.filter((x) => x._id !== a._id);
      return old.map((x) => (x._id === a._id ? { ...x, done: nextDone } : x));
    });
    progress.mutate(
      { id: a._id, completed: nextDone },
      { onError: () => qc.invalidateQueries({ queryKey: qk.assignments(scopeKey) }) },
    );
  };

  const courses = useMemo(
    () => ['all', ...Array.from(new Set(assignments.map((a) => a.course?.title).filter(Boolean))).sort()],
    [assignments],
  );

  const visible = course === 'all' ? assignments : assignments.filter((a) => a.course?.title === course);

  return (
    <Box>
      <PageHeader
        title="Deadlines & Assignments"
        subtitle="Everything you need to submit, sorted by due date."
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Tabs value={scope} onChange={(_e, v) => setScope(v)}>
          <Tab label="Upcoming" />
          <Tab label="Past" />
          <Tab label="All" />
        </Tabs>
        <TextField
          select
          size="small"
          label="Course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {courses.map((c) => (
            <MenuItem key={c} value={c}>
              {c === 'all' ? 'All courses' : c}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading ? (
        <Loading height="40vh" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={EventNoteRoundedIcon}
          title="No assignments here"
          description="Try a different tab or course filter."
        />
      ) : (
        <Grid container spacing={2.5}>
          {visible.map((a) => {
            return (
              <Grid item xs={12} sm={6} lg={4} key={a._id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform .18s ease, box-shadow .18s ease',
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Tooltip title={a.course?.title || a.course?.code || 'Course'}>
                          <Chip
                            size="small"
                            label={a.course?.title || a.course?.code || 'Course'}
                            color="primary"
                            variant="outlined"
                            sx={{ maxWidth: 220, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                          />
                        </Tooltip>
                        {a.program && <Chip size="small" label={a.program} variant="outlined" />}
                        {a.sections?.length > 0 && (
                          <Chip
                            size="small"
                            color="secondary"
                            variant="outlined"
                            label={`Sec ${a.sections.join(', ')}`}
                          />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {a.done ? (
                          <Chip size="small" color="success" label="Done" icon={<CheckCircleRoundedIcon />} />
                        ) : (
                          <DeadlineChip dueAt={a.dueAt} />
                        )}
                      </Stack>
                    </Stack>
                    <Typography
                      variant="h6"
                      sx={{ mt: 1.5, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'text.secondary' : 'text.primary' }}
                    >
                      {a.title}
                    </Typography>
                    {a.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {a.description}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
                      Due {formatDateTime(a.dueAt)}
                    </Typography>
                    {a.attachmentUrl && (
                      <Link
                        href={a.attachmentUrl}
                        target="_blank"
                        rel="noopener"
                        sx={{ mt: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        Open brief <OpenInNewRoundedIcon fontSize="inherit" />
                      </Link>
                    )}
                  </CardContent>
                  {(a.createdBy?.name || isStudent) && (
                    <Box
                      sx={{
                        px: 2,
                        py: 1.25,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {a.createdBy?.name ? `Posted by ${a.createdBy.name}` : ''}
                      </Typography>
                      {isStudent && (
                        <Button
                          size="small"
                          color={a.done ? 'success' : 'primary'}
                          startIcon={a.done ? <CheckCircleRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
                          onClick={() => toggleDone(a)}
                          sx={{ flexShrink: 0 }}
                          data-testid={`assignment-done-${a._id}`}
                        >
                          {a.done ? 'Done' : 'Mark done'}
                        </Button>
                      )}
                    </Box>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
