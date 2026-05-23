import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AUTH_STORAGE_KEY = 'padiBridgeAuth';

const AuthContext = createContext(null);

function parseAuthStorage(storage) {
  try {
    const rawValue = storage.getItem(AUTH_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    return null;
  }
}

function clearAuthStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    user: null,
    token: null,
    ready: false,
  });

  useEffect(() => {
    const localAuth = parseAuthStorage(localStorage);
    const sessionAuth = parseAuthStorage(sessionStorage);
    const persistedAuth = localAuth || sessionAuth;

    if (persistedAuth?.token) {
      setAuthState({
        user: persistedAuth.user || null,
        token: persistedAuth.token,
        ready: true,
      });
      return;
    }

    setAuthState((previous) => ({
      ...previous,
      ready: true,
    }));
  }, []);

  const login = (payload, rememberMe) => {
    const nextState = {
      user: payload.user || null,
      token: payload.token,
      ready: true,
    };

    clearAuthStorage();

    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
    }

    setAuthState(nextState);
  };

  const logout = () => {
    clearAuthStorage();
    setAuthState({
      user: null,
      token: null,
      ready: true,
    });
  };

  const value = useMemo(
    () => ({
      user: authState.user,
      token: authState.token,
      isReady: authState.ready,
      isAuthenticated: Boolean(authState.token),
      login,
      logout,
    }),
    [authState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
