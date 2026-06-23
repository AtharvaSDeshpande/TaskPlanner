import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor = 'error',
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title ?? t('common.labels.areYouSure')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>{cancelLabel ?? t('common.actions.cancel')}</Button>
        <Button variant="contained" color={confirmColor} onClick={onConfirm}>
          {confirmLabel ?? t('common.actions.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
