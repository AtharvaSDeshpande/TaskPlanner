import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import glim from '../../assets/glim.webp';

// Full-screen branded loader for a cold start — i.e. a session token exists but
// there's no cached user snapshot yet, so we must wait for /auth/me before we
// know where to send them. Returning visitors hydrate from cache and never see
// this; showing the brand (rather than the login form) avoids a misleading flash
// of "signed out" while the session is still being confirmed.
export default function Splash() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Stack spacing={2} alignItems="center">
        <img src={glim} alt="" style={{ width: 64, objectFit: 'contain' }} />
        <Typography variant="h4">Task Planner</Typography>
        <Typography variant="h6">Getting things ready for you...</Typography>
        <CircularProgress size={22} />
      </Stack>
    </Box>
  );
}
