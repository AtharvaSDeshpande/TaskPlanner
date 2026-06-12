import { createTheme } from '@mui/material/styles';

// Brand-aligned palette tokens for each colour scheme.
function tokens(mode) {
  if (mode === 'dark') {
    return {
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrastText: '#fff' },
      secondary: { main: '#2dd4bf', light: '#5eead4', dark: '#14b8a6', contrastText: '#06281f' },
      success: { main: '#22c55e' },
      warning: { main: '#f59e0b' },
      error: { main: '#f87171' },
      info: { main: '#60a5fa' },
      background: { default: '#0a0f1e', paper: '#141b2e' },
      text: { primary: '#e6e9f2', secondary: '#9aa4bf' },
      divider: 'rgba(148,163,184,0.18)',
    };
  }
  return {
    primary: { main: '#4f46e5', light: '#6366f1', dark: '#4338ca', contrastText: '#fff' },
    secondary: { main: '#0d9488', light: '#14b8a6', dark: '#0f766e', contrastText: '#fff' },
    success: { main: '#16a34a' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    info: { main: '#2563eb' },
    background: { default: '#f4f6fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e7eaf3',
  };
}

// Gradient used by hero/promo surfaces — looks good in both schemes.
export const brandGradient = 'linear-gradient(135deg, #4f46e5 0%, #0d9488 100%)';

export function getTheme(mode) {
  const palette = { mode, ...tokens(mode) };
  const isLight = mode === 'light';

  return createTheme({
    palette,
    typography: {
      fontFamily: 'Inter, Roboto, "Segoe UI", Arial, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: { borderRadius: 14 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isLight ? 'rgba(100,116,139,0.35)' : 'rgba(148,163,184,0.35)',
            borderRadius: 8,
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            backgroundImage: 'none',
            boxShadow: isLight
              ? '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)'
              : '0 1px 2px rgba(0,0,0,0.5)',
          }),
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10 } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            boxShadow: 'none',
            borderBottom: `1px solid ${theme.palette.divider}`,
            backdropFilter: 'blur(8px)',
            backgroundColor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(20,27,46,0.8)',
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
}

export default getTheme('light');
