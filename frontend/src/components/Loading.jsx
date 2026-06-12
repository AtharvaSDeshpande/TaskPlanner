import { Box, CircularProgress } from '@mui/material';

export default function Loading({ height = '60vh' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
      <CircularProgress />
    </Box>
  );
}
