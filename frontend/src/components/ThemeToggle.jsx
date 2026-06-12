import { IconButton, Tooltip } from '@mui/material';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useColorMode } from '../context/ColorModeContext.jsx';

export default function ThemeToggle({ size = 'medium' }) {
  const { mode, toggle } = useColorMode();
  const dark = mode === 'dark';
  return (
    <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton onClick={toggle} size={size} color="inherit" aria-label="toggle color mode">
        {dark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}
