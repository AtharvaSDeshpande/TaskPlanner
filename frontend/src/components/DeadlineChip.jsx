import { Chip } from '@mui/material';
import OutlinedFlagRoundedIcon from '@mui/icons-material/OutlinedFlagRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { useTranslation } from 'react-i18next';
import { deadlineMeta, formatDateTime } from '../utils/format.js';

// One consistent deadline indicator used across the To-Do board, Deadlines and
// Groups. Tasks nearing their deadline (overdue or due within 24h) are flagged
// with a filled red chip + flag icon; completed items are shown muted.
export default function DeadlineChip({ dueAt, done = false, size = 'small' }) {
  const { t } = useTranslation();
  if (!dueAt) return null;
  const meta = deadlineMeta(dueAt);

  if (done) {
    return (
      <Chip size={size} variant="outlined" color="default" icon={<EventRoundedIcon />} label={t('deadlineChip.due', { date: formatDateTime(dueAt) })} />
    );
  }

  return (
    <Chip
      size={size}
      color={meta.color}
      variant={meta.urgent ? 'filled' : 'outlined'}
      icon={meta.urgent ? <OutlinedFlagRoundedIcon /> : <EventRoundedIcon />}
      label={meta.label}
    />
  );
}
