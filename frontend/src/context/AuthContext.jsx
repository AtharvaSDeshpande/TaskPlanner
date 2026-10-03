import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api, {
  setToken,
  clearToken,
  getToken,
  getCachedUser,
  setCachedUser,
  clearCachedUser,
} from '../api/client.js';
import { deriveKey, cacheKey, loadCachedKey, clearKey } from '../crypto/e2e.js';
import { can as canFn, isReadOnly } from '../utils/permissions.js';
import { readUrlCredentials, hasUrlCredentials, scrubUrlCredentials } from '../utils/autoLogin.js';
import { logger } from '../logger/logger.jsx';

const AuthContext = createContext(null);

// A returning visitor has a token AND a cached user snapshot, so we can render
// the app immediately and revalidate in the background ("stale-while-revalidate")
// instead of blocking on /auth/me. Only a cold start (token but no snapshot) has
// to wait, and that's what `loading` gates.
const bootUser = () => (getToken() ? getCachedUser() : null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(bootUser);
  const [cryptoKey, setCryptoKey] = useState(null); // AES key for the E2E todo board
  // Block on the splash during a cold start OR while a demo auto-login link is
  // being processed (so the login form never flashes in either case).
  const [loading, setLoading] = useState(
    () => hasUrlCredentials() || (Boolean(getToken()) && !getCachedUser()),
  );

  // Keeps the cached snapshot in lock-step with in-memory user state, so pages
  // that update the profile don't leave a stale copy behind for the next visit.
  const setUser = useCallback((next) => {
    setUserState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (value) setCachedUser(value);
      else clearCachedUser();
      return value;
    });
  }, []);

  const login = useCallback(async (email, password) => {
    logger.info('Login attempt for {Email}', { Email: email });
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    logger.setUser(data.user);
    logger.info('Login succeeded for {UserEmail} ({Role}, mustChangePassword={MustChange})', {
      UserEmail: data.user.email,
      Role: data.user.role,
      MustChange: data.user.mustChangePassword,
    });
    // Derive the E2E key from the password while we still have it in memory.
    const key = await deriveKey(password, data.user.encSalt);
    await cacheKey(key);
    setCryptoKey(key);
    return data.user;
  }, [setUser]);

  const logout = useCallback(() => {
    logger.info('User logged out');
    clearToken();
    clearKey();
    clearCachedUser();
    logger.clearUser();
    setUserState(null);
    setCryptoKey(null);
  }, []);

  // Used after change-password so the new token + re-derived key take effect.
  const applyCredentialChange = useCallback(async ({ token, user: nextUser }, newKey) => {
    if (token) setToken(token);
    if (nextUser) {
      setUser(nextUser);
      logger.setUser(nextUser);
      logger.info('Password changed for {UserEmail}', { UserEmail: nextUser.email });
    }
    if (newKey) {
      await cacheKey(newKey);
      setCryptoKey(newKey);
    }
  }, [setUser]);

  // Bootstrap on first load:
  //  1. If the URL carries demo credentials (?username=&password= or #…), sign in
  //     with them automatically — after scrubbing them from the URL.
  //  2. Otherwise restore an existing session. The token and the derived E2E key
  //     both persist in localStorage, so a returning user is authenticated AND
  //     their encrypted board decrypts automatically.
  //
  // A valid session requires the cached key: if the token is present but the key
  // is gone we can't decrypt the board, so we drop the session and fall back to
  // login — keeping "authenticated" and "has a usable key" in lock-step.
  useEffect(() => {
    let active = true;

    async function restore() {
      if (!getToken()) {
        clearCachedUser();
        if (active) {
          setUserState(null);
          setLoading(false);
        }
        return;
      }
      const key = await loadCachedKey();
      if (!key) {
        clearToken();
        clearKey();
        clearCachedUser();
        if (active) {
          setUserState(null);
          setLoading(false);
        }
        return;
      }
      if (active) setCryptoKey(key);
      try {
        // Revalidate the optimistically-hydrated session (or resolve a cold one).
        const { data } = await api.get('/auth/me');
        if (!active) return;
        setUser(data.user);
        logger.setUser(data.user);
        logger.info('Session restored for {UserEmail} ({Role})', {
          UserEmail: data.user.email,
          Role: data.user.role,
        });
      } catch {
        // Token rejected/expired — drop the stale session and fall back to login.
        clearToken();
        clearKey();
        clearCachedUser();
        if (!active) return;
        setUserState(null);
        setCryptoKey(null);
        logger.warn('Session restore failed — token cleared');
      } finally {
        if (active) setLoading(false);
      }
    }

    async function boot() {
      const creds = readUrlCredentials();
      if (creds) {
        // Strip the credentials from the URL first, so they never linger in the
        // address bar, history, or a link the viewer copies — even if login fails.
        scrubUrlCredentials();
        if (active) setLoading(true);
        try {
          await login(creds.username, creds.password);
          logger.info('Auto-login via URL succeeded for {Email}', { Email: creds.username });
          if (active) setLoading(false);
          return;
        } catch {
          logger.warn('Auto-login via URL failed; falling back to session restore');
          // fall through to a normal restore / the login screen
        }
      }
      await restore();
    }

    boot();
    return () => {
      active = false;
    };
  }, [login, setUser]);

  const value = useMemo(
    () => ({
      user,
      cryptoKey,
      loading,
      isAuthenticated: Boolean(user),
      readOnly: isReadOnly(user),
      can: (key, opts) => canFn(user, key, opts),
      login,
      logout,
      applyCredentialChange,
      setUser,
    }),
    [user, cryptoKey, loading, login, logout, applyCredentialChange, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
