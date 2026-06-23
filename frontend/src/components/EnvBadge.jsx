import { Chip, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { config } from '../config/env.js';

// Small indicator of the active environment + the API it targets, so it's
// always obvious whether you're testing against dev or prod.
export default function EnvBadge() {
  const { t } = useTranslation();
  const prod = config.isProd;
  return (
    <Tooltip title={t('env.tooltip', { env: config.appEnv, api: config.apiBaseUrl })}>
      <Chip
        size="small"
        label={prod ? t('env.prod') : t('env.dev')}
        color={prod ? 'warning' : 'default'}
        variant={prod ? 'filled' : 'outlined'}
        sx={{ height: 22, fontWeight: 700, letterSpacing: '0.04em' }}
      />
    </Tooltip>
  );
}
