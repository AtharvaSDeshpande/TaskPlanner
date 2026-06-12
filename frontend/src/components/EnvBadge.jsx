import { Chip, Tooltip } from '@mui/material';
import { config } from '../config/env.js';

// Small indicator of the active environment + the API it targets, so it's
// always obvious whether you're testing against dev or prod.
export default function EnvBadge() {
  const prod = config.isProd;
  return (
    <Tooltip title={`Environment: ${config.appEnv} · API: ${config.apiBaseUrl}`}>
      <Chip
        size="small"
        label={prod ? 'PROD' : 'DEV'}
        color={prod ? 'warning' : 'default'}
        variant={prod ? 'filled' : 'outlined'}
        sx={{ height: 22, fontWeight: 700, letterSpacing: '0.04em' }}
      />
    </Tooltip>
  );
}
