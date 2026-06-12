import axios from 'axios';
import { config } from '../config/env.js';
import { logger } from '../logger/logger.jsx';

const TOKEN_KEY = 'careplus.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const newRequestId = () =>
  (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
  `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token + a correlation id, and time the request. The same
// X-Request-Id is logged by the backend, so a browser log and a server log line
// up for any given call.
api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  const requestId = newRequestId();
  cfg.headers['X-Request-Id'] = requestId;
  cfg.metadata = { requestId, start: performance.now() };
  logger.debug('→ {Method} {Url}', {
    Method: (cfg.method || 'get').toUpperCase(),
    Url: cfg.url,
    RequestId: requestId,
  });
  return cfg;
});

api.interceptors.response.use(
  (res) => {
    const { requestId, start } = res.config.metadata || {};
    logger.debug('← {Status} {Method} {Url} in {Elapsed}ms', {
      Status: res.status,
      Method: (res.config.method || 'get').toUpperCase(),
      Url: res.config.url,
      Elapsed: start ? Math.round(performance.now() - start) : undefined,
      RequestId: requestId,
    });
    return res;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Unexpected network error.';
    const { requestId, start } = error.config?.metadata || {};
    const props = {
      Method: (error.config?.method || 'get').toUpperCase(),
      Url: error.config?.url,
      Status: status,
      ErrorMessage: message,
      // The backend echoes its RequestId in the body on errors — prefer it.
      RequestId: error.response?.data?.requestId || requestId,
      Elapsed: start ? Math.round(performance.now() - start) : undefined,
    };
    // 4xx are usually expected (validation/auth) → warn; network/5xx → error.
    if (!status || status >= 500) logger.error('API {Method} {Url} failed: {ErrorMessage}', props);
    else logger.warn('API {Method} {Url} rejected ({Status}): {ErrorMessage}', props);

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      clearToken();
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(new Error(message));
  },
);

export default api;
