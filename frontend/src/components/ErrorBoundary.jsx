import { Component } from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import { logger } from '../logger/logger.jsx';

// Catches render-time errors anywhere below it so a single bad component
// can't white-screen the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    logger.fatal('React render crashed: {ErrorMessage}', {
      ErrorMessage: error?.message,
      ComponentStack: info?.componentStack,
      Path: window.location.pathname,
      err: error,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 460, textAlign: 'center' }}>
          <ReportProblemRoundedIcon color="warning" sx={{ fontSize: 56 }} />
          <Typography variant="h5">Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary">
            An unexpected error occurred while rendering this page. Reloading usually fixes it.
          </Typography>
          <Button variant="contained" onClick={() => window.location.assign('/')}>
            Reload the app
          </Button>
        </Stack>
      </Box>
    );
  }
}
