import { Box, Typography, Stack } from '@mui/material';
import { useAuth } from '../context/AuthContext.jsx';

export default function PageHeader({ title, subtitle, action }) {
  // The page `action` is always a primary write control (New/Add/…), so it's
  // hidden for read-only accounts. Row-level controls are additionally neutralized
  // by the API guard and, ultimately, the server.
  const { readOnly } = useAuth();
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h5">{title}</Typography>
        {subtitle && (
          // component="div" so callers can pass rich nodes (icons, chips) as
          // the subtitle without invalid <div>-inside-<p> DOM nesting.
          <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {!readOnly && action}
    </Stack>
  );
}
