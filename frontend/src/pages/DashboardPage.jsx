import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
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
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import AssignmentLateRoundedIcon from '@mui/icons-material/AssignmentLateRounded';
import glim from "../../assets/glim.webp"
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { isThisWeek } from 'date-fns';
import { useAuth } from '../context/AuthContext.jsx';
import { can as canFn, canManageAnyAssignment } from '../utils/permissions.js';
import { useAssignments, useUsers, useAnnouncements } from '../queries/hooks.js';
import { deadlineMeta, formatDateTime } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import EmptyState from '../components/EmptyState.jsx';

// A stat tile. When `to` is provided it becomes a link to the relevant page.
function StatCard({ icon: Icon, label, value, color = 'primary', to }) {
  // `icon` may be an MUI icon component or an image URL (e.g. the GLIM logo).
  const isImg = typeof Icon === 'string';
  const body = (
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar
          variant="rounded"
          src={isImg ? Icon : undefined}
          imgProps={isImg ? { alt: '', style: { objectFit: 'contain' } } : undefined}
          sx={{ bgcolor: isImg ? 'transparent' : `${color}.main`, width: 48, height: 48 }}
        >
          {isImg ? null : <Icon />}
        </Avatar>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  );
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
      }}
    >
      {to ? (
        <CardActionArea component={RouterLink} to={to} sx={{ height: '100%' }} data-testid={`stat-link-${to.replace(/\//g, '-')}`}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

// Compact recent-announcements list for the dashboard.
function RecentAnnouncementsCard({ items }) {
  return (
    <Card sx={{ height: '100%' }} data-testid="recent-announcements">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Announcements</Typography>
          <Button size="small" component={RouterLink} to="/announcements">
            View all
          </Button>
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <EmptyState
            icon={CampaignRoundedIcon}
            title="No announcements yet"
            description="Updates from your staff will appear here."
          />
        ) : (
          <List disablePadding>
            {items.slice(0, 5).map((a) => (
              <ListItem key={a.id} divider sx={{ px: 0, alignItems: 'flex-start' }}>
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Avatar
                    variant="rounded"
                    sx={{ bgcolor: a.type === 'deadline' ? 'warning.light' : 'info.light', width: 34, height: 34 }}
                  >
                    {a.type === 'deadline' ? <EventRoundedIcon fontSize="small" /> : <InfoOutlinedIcon fontSize="small" />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography fontWeight={600} noWrap>{a.title}</Typography>}
                  secondary={[a.subject?.code, a.dueAt ? formatDateTime(a.dueAt) : a.createdBy?.name ? `by ${a.createdBy.name}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

// Shared list card used by both the "Upcoming" and "Missed" deadline sections so
// the two render identically; only the title, accent and empty-state copy differ.
function DeadlineListCard({ title, items, accent = 'primary', emptyTitle, emptyDescription, testId }) {
  return (
    <Card data-testid={testId}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Button size="small" component={RouterLink} to="/deadlines">
            View all
          </Button>
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <EmptyState icon={EventNoteRoundedIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <List disablePadding>
            {items.slice(0, 6).map((a) => {
              const meta = deadlineMeta(a.dueAt);
              return (
                <ListItem key={a._id} divider sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar variant="rounded" sx={{ bgcolor: `${accent}.light` }}>
                      <AssignmentRoundedIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography fontWeight={600}>{a.title}</Typography>}
                    secondary={`${a.course?.title || a.course?.code || 'Course'} · ${formatDateTime(a.dueAt)}`}
                  />
                  <Chip size="small" color={meta.color} label={meta.label} variant="outlined" />
                </ListItem>
              );
            })}
          </List>
        )}
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
  const { data: past = [] } = useAssignments('past');
  const { data: announcements = [] } = useAnnouncements();

  const studentCount = studentData?.count ?? null;
  // Missed = past its due date and not yet marked done.
  const missed = past.filter((a) => !a.done);
  const overdueCount = isStudent ? missed.length : null;

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
          <StatCard icon={EventNoteRoundedIcon} label="Upcoming deadlines" value={upcoming.length} to="/deadlines" />
        </Grid>
        <Grid item xs={12} sm={6} md={colMd}>
          <StatCard icon={AccessTimeRoundedIcon} label="Due this week" value={dueThisWeek.length} color="warning" to="/deadlines" />
        </Grid>
        {isAdmin && (
          <Grid item xs={12} sm={6} md={colMd}>
            <StatCard icon={GroupRoundedIcon} label="Students" value={studentCount ?? '—'} color="secondary" to="/manage/users" />
          </Grid>
        )}
        {isModerator && (
          <Grid item xs={12} sm={6} md={colMd}>
            <StatCard icon={glim} label="Your program" value={user.program || '—'} color="secondary" to="/manage/assignments" />
          </Grid>
        )}
        {isStudent && (
          <Grid item xs={12} sm={6} md={colMd}>
            <StatCard
              icon={AssignmentLateRoundedIcon}
              label="Overdue"
              value={overdueCount ?? '—'}
              color="error"
              to="/deadlines"
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
          <DeadlineListCard
            title="Upcoming deadlines"
            items={upcoming}
            accent="primary"
            emptyTitle="Nothing due — you're all caught up!"
            emptyDescription="New assignments will appear here as they're posted."
            testId="upcoming-deadlines"
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <RecentAnnouncementsCard items={announcements} />
        </Grid>

        {/* Missed deadlines — same card as "Upcoming", placed directly below it. */}
        <Grid item xs={12} md={8}>
          <DeadlineListCard
            title="Missed deadlines"
            items={missed}
            accent="error"
            emptyTitle="No missed deadlines — nice work!"
            emptyDescription="Past-due assignments you haven't completed will show up here."
            testId="missed-deadlines"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
