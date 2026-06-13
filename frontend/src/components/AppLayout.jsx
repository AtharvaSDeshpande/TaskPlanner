import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import LibraryAddRoundedIcon from '@mui/icons-material/LibraryAddRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAuth } from '../context/AuthContext.jsx';
import { initials, roleLabel } from '../utils/format.js';
import { can, canManageAnyAssignment } from '../utils/permissions.js';
import { brandGradient } from '../theme.js';
import ThemeToggle from './ThemeToggle.jsx';
import EnvBadge from './EnvBadge.jsx';

const DRAWER_WIDTH = 264;

const isMember = (u) => u?.role !== 'owner';

// Nav items are gated by capability (permissions), not just the base role, so a
// student promoted to course moderator sees "Manage Assignments", etc.
const NAV = [
  { label: 'Organizations', to: '/organizations', icon: CorporateFareRoundedIcon, show: (u) => u?.role === 'owner' },
  { label: 'Dashboard', to: '/dashboard', icon: SpaceDashboardRoundedIcon, show: isMember },
  { label: 'Deadlines', to: '/deadlines', icon: EventNoteRoundedIcon, show: isMember },
  { label: 'My To-Do Board', to: '/todos', icon: ChecklistRoundedIcon, show: isMember },
  { label: 'Groups', to: '/groups', icon: Diversity3RoundedIcon, show: isMember },
  { label: 'Manage Assignments', to: '/manage/assignments', icon: LibraryAddRoundedIcon, show: canManageAnyAssignment },
  { label: 'Courses & Semester', to: '/manage/semester', icon: CalendarMonthRoundedIcon, show: (u) => can(u, 'course:manage') || can(u, 'semester:manage') || can(u, 'group:manage') },
  { label: 'Manage Users', to: '/manage/users', icon: GroupRoundedIcon, show: (u) => can(u, 'user:manage') },
  { label: 'Roles & Permissions', to: '/manage/roles', icon: AdminPanelSettingsRoundedIcon, show: (u) => can(u, 'role:manage') || can(u, 'role:manage:global') },
];

export default function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = NAV.filter((i) => i.show(user));

  const handleNav = (to) => {
    navigate(to);
    setMobileOpen(false);
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5, px: 2.5 }}>
        <Avatar variant="rounded" sx={{ background: brandGradient }}>
          <SchoolRoundedIcon />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" lineHeight={1.1}>
            GLIM
          </Typography>
          <Typography variant="caption" color="text.secondary">
            BSchool Portal
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1.5, py: 1, flexGrow: 1 }}>
        {items.map(({ label, to, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <ListItemButton
              key={to}
              selected={active}
              data-testid={`nav-${to.replace(/^\//, '').replace(/\//g, '-')}`}
              onClick={() => handleNav(to)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff' },
                '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
                '&.Mui-selected .MuiListItemIcon-root': { color: '#fff' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600 }}>{label}</ListItemText>
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'secondary.main' }}>{initials(user?.name)}</Avatar>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user?.name}
          </Typography>
          <Chip size="small" label={roleLabel(user?.role)} sx={{ height: 18, fontSize: 11 }} />
          {user?.organization?.domain && (
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              @{user.organization.domain}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { md: 'none' } }}
            aria-label="open navigation"
            data-testid="open-nav-button"
          >
            <MenuRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {NAV.find((n) => location.pathname.startsWith(n.to))?.label ||
              (location.pathname.startsWith('/change-password') ? 'Change password' : 'GLIM')}
          </Typography>
          <EnvBadge />
          <Box sx={{ mx: 0.5 }} />
          <ThemeToggle />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="account menu" sx={{ ml: 0.5 }} data-testid="account-menu-button">
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
              {initials(user?.name)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled sx={{ opacity: '1 !important' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem component={RouterLink} to="/profile" onClick={() => setAnchorEl(null)} data-testid="menu-profile">
              <ListItemIcon>
                <AccountCircleRoundedIcon fontSize="small" />
              </ListItemIcon>
              My profile
            </MenuItem>
            <MenuItem component={RouterLink} to="/change-password" onClick={() => setAnchorEl(null)} data-testid="menu-change-password">
              <ListItemIcon>
                <LockResetRoundedIcon fontSize="small" />
              </ListItemIcon>
              Change password
            </MenuItem>
            <MenuItem component={RouterLink} to="/feedback" onClick={() => setAnchorEl(null)} data-testid="menu-feedback">
              <ListItemIcon>
                <RateReviewRoundedIcon fontSize="small" />
              </ListItemIcon>
              Feedback
            </MenuItem>
            <MenuItem
              data-testid="menu-logout"
              onClick={() => {
                setAnchorEl(null);
                logout();
              }}
            >
              <ListItemIcon>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // min-width:0 lets this flex child shrink below its content's intrinsic
          // width, so wide content (data tables, code blocks) scrolls inside its
          // own container instead of stretching the whole page past the viewport.
          minWidth: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
