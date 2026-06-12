import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from '../theme.js';

const STORAGE_KEY = 'glim.theme';
const ColorModeContext = createContext({ mode: 'light', toggle: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

function resolveInitialMode() {
  const saved = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // Fall back to the user's OS preference on first visit.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(resolveInitialMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
      setMode,
    }),
    [mode],
  );

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
