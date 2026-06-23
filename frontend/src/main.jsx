import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { QueryClientProvider } from '@tanstack/react-query';
import { ColorModeProvider } from './context/ColorModeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { queryClient } from './queries/queryClient.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initLogger } from './logger/logger.jsx';
import './i18n/index.js'; // initialize i18next before anything renders
import App from './App.jsx';

// Wire up structured logging (console + batched ship to the backend session
// file) and global error capture before anything renders.
initLogger();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ColorModeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </LocalizationProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ColorModeProvider>
  </React.StrictMode>,
);
