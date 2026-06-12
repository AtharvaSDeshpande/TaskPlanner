import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api, { setToken, clearToken, getToken } from '../api/client.js';
import { deriveKey, cacheKey, loadCachedKey, clearKey } from '../crypto/e2e.js';
import { can as canFn } from '../utils/permissions.js';
import { logger } from '../logger/logger.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cryptoKey, setCryptoKey] = useState(null); // AES key for the E2E todo board
  const [loading, setLoading] = useState(true);

  // Restore the session on first load. The token persists in localStorage; the
  // derived key persists only in sessionStorage, so on a fresh tab the user is
  // authenticated but must re-unlock the board by re-entering their password.
  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!active) return;
        setUser(data.user);
        logger.setUser(data.user);
        logger.info('Session restored for {UserEmail} ({Role})', {
          UserEmail: data.user.email,
          Role: data.user.role,
        });
        const key = await loadCachedKey();
        if (key) setCryptoKey(key);
      } catch {
        clearToken();
        clearKey();
        logger.warn('Session restore failed — token cleared');
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
    };
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
  }, []);

  // Re-derive the encryption key on a fresh tab/session where only the token
  // survived. Re-authenticates so a wrong password is rejected before we derive
  // (and cache) an unusable key.
  const unlock = useCallback(
    async (password) => {
      const { data } = await api.post('/auth/login', { email: user.email, password });
      setToken(data.token);
      setUser(data.user);
      const key = await deriveKey(password, data.user.encSalt);
      await cacheKey(key);
      setCryptoKey(key);
      logger.info('Encrypted board unlocked for {UserEmail}', { UserEmail: user.email });
      return key;
    },
    [user],
  );

  const logout = useCallback(() => {
    logger.info('User logged out');
    clearToken();
    clearKey();
    logger.clearUser();
    setUser(null);
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
  }, []);

  const value = useMemo(
    () => ({
      user,
      cryptoKey,
      loading,
      isAuthenticated: Boolean(user),
      can: (key, opts) => canFn(user, key, opts),
      login,
      logout,
      unlock,
      applyCredentialChange,
      setUser,
    }),
    [user, cryptoKey, loading, login, logout, unlock, applyCredentialChange],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
