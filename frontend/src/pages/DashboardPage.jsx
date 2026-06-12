import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import AssignmentLateRoundedIcon from '@mui/icons-material/AssignmentLateRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { isThisWeek } from 'date-fns';
import { useAuth } from '../context/AuthContext.jsx';
import { can as canFn, canManageAnyAssignment } from '../utils/permissions.js';
import { useAssignments, useUsers } from '../queries/hooks.js';
import { deadlineMeta, formatDateTime } from '../utils/format.js';
import { brandGradient } from '../theme.js';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';

function StatCard({ icon: Icon, label, value, color = 'primary' }) {
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar variant="rounded" sx={{ bgcolor: `${color}.main`, width: 48, height: 48 }}>
            <Icon />
          </Avatar>
          <Box>
            <Typography variant="h4">{value}</Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  // Capability-driven (a custom-role admin or course moderator works too).
  const isAdmin = canFn(user, 'user:manage');
  const isModerator = !isAdmin && canManageAnyAssignment(user);
  const isStudent = !isAdmin && !isModerator;
  const isStaff = isAdmin || isModerator;

  // All cached & shared with the other pages that read the same queries.
  const { data: upcoming = [], isPending: loadingUpcoming } = useAssignments('upcoming');
  const { data: studentData } = useUsers({ role: 'student' }, { enabled: isAdmin });
  const { data: pastAssignments } = useAssignments('past', { enabled: isStudent });

  const studentCount = studentData?.count ?? null;
  // Overdue = past its due date and not yet marked done by the student.
  const overdueCount = isStudent && pastAssignments ? pastAssignments.filter((a) => !a.done).length : null;

  if (loadingUpcoming) return <Loading />;

  const dueThisWeek = upcoming.filter((a) => isThisWeek(new Date(a.dueAt), { weekStartsOn: 1 }));
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  // Staff see a 4th "Quick actions" card, so use 4 columns; students see 3.
  const colMd = isStaff ? 3 : 4;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">
          {greeting}, {user.name.split(' ')[0]} 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Here's what needs your attention.
        </Typography>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={colMd}>
          <StatCard icon={EventNoteRoundedIcon} label="Upcoming deadlines" value={upcoming.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={colMd}>
          <StatCard icon={AccessTimeRoundedIcon} label="Due this week" value={dueThisWeek.length} color="warning" />
        </Grid>
        {isAdmin && (
          <Grid item xs={12} sm={6} md={colMd}>
            <StatCard icon={GroupRoundedIcon} label="Students" value={studentCount ?? '—'} color="secondary" />
          </Grid>
        )}
        {isModerator && (
          <Grid item xs={12} sm={6} md={colMd}>
            <StatCard icon={SchoolRoundedIcon} label="Your program" value={user.program || '—'} color="secondary" />
          </Grid>
        )}
        {isStudent && (
          <Grid item xs={12} sm={6} md={colMd}>
            <StatCard
              icon={AssignmentLateRoundedIcon}
              label="Overdue"
              value={overdueCount ?? '—'}
              color="error"
            />
          </Grid>
        )}
        {isStaff && (
          <Grid item xs={12} sm={6} md={colMd}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Quick actions
                </Typography>
                <Stack spacing={0.5} alignItems="flex-start">
                  <Button size="small" component={RouterLink} to="/manage/assignments" startIcon={<AssignmentRoundedIcon />}>
                    Post an assignment
                  </Button>
                  {isAdmin && (
                    <Button size="small" component={RouterLink} to="/manage/users" startIcon={<GroupRoundedIcon />}>
                      Manage users
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Upcoming deadlines</Typography>
                <Button size="small" component={RouterLink} to="/deadlines">
                  View all
                </Button>
              </Stack>
              <Divider />
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={EventNoteRoundedIcon}
                  title="Nothing due — you're all caught up!"
                  description="New assignments will appear here as they're posted."
                />
              ) : (
                <List disablePadding>
                  {upcoming.slice(0, 6).map((a) => {
                    const meta = deadlineMeta(a.dueAt);
                    return (
                      <ListItem key={a._id} divider sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar variant="rounded" sx={{ bgcolor: 'primary.light' }}>
                            <AssignmentRoundedIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography fontWeight={600}>{a.title}</Typography>}
                          secondary={`${a.course} · ${formatDateTime(a.dueAt)}`}
                        />
                        <Chip size="small" color={meta.color} label={meta.label} variant="outlined" />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: brandGradient, color: '#fff', border: 'none', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your private to-do list
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                Plan your study tasks on a private Kanban board. Your tasks are encrypted and tied to
                your account — they stay safe even if you change your password.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                component={RouterLink}
                to="/todos"
                startIcon={<ChecklistRoundedIcon />}
              >
                Open my list
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
