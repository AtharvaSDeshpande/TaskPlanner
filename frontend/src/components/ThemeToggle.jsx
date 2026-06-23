import { IconButton, Tooltip } from '@mui/material';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useColorMode } from '../context/ColorModeContext.jsx';
import { useTranslation } from 'react-i18next';

export default function ThemeToggle({ size = 'medium' }) {
  const { t } = useTranslation();
  const { mode, toggle } = useColorMode();
  const dark = mode === 'dark';
  return (
    <Tooltip title={dark ? t('theme.toLight') : t('theme.toDark')}>
      <IconButton onClick={toggle} size={size} color="inherit" aria-label={t('theme.toggleAria')}>
        {dark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}
