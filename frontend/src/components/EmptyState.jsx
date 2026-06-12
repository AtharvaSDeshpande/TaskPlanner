import { Box, Typography } from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';

export default function EmptyState({ icon, title, description, action }) {
  const Icon = icon || InboxRoundedIcon;
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        px: 2,
        color: 'text.secondary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Icon sx={{ fontSize: 56, color: 'primary.light', opacity: 0.6 }} />
      <Typography variant="h6" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
