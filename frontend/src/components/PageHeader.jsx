import { Box, Typography, Stack } from '@mui/material';

export default function PageHeader({ title, subtitle, action }) {
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
      {action}
    </Stack>
  );
}
