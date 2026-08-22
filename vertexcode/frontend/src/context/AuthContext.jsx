import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('vertexwm_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vertexwm_access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data.data.user);
        localStorage.setItem('vertexwm_user', JSON.stringify(data.data.user));
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user: u, accessToken, refreshToken } = data.data;
    localStorage.setItem('vertexwm_access_token', accessToken);
    localStorage.setItem('vertexwm_refresh_token', refreshToken);
    localStorage.setItem('vertexwm_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('vertexwm_refresh_token');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch (e) {
      /* ignore */
    }
    localStorage.removeItem('vertexwm_access_token');
    localStorage.removeItem('vertexwm_refresh_token');
    localStorage.removeItem('vertexwm_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
