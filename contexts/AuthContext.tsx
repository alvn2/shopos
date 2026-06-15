import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, LoginResponse, Session } from '../types';
import { api } from '../services/api';

interface AuthContextType extends AuthState {
  login: (shop_id: string, username: string, password: string, device_info: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<number>;
  getSessions: () => Promise<Session[]>;
  deleteSession: (sessionId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session_id: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    const initAuth = async () => {
      const storedSessionId = localStorage.getItem('shopos_session');
      const storedUser = localStorage.getItem('shopos_user');

      if (storedSessionId && storedUser) {
        // Optimistic Load
        try {
          const user = JSON.parse(storedUser);
          setState({ session_id: storedSessionId, user, isAuthenticated: true });

          // Verify Session Validity
          const isValid = await api.auth.verify();
          if (!isValid) {
            handleLocalLogout();
          }
        } catch (e) {
          handleLocalLogout();
        }
      }
    };
    initAuth();

    // Listen for global logout events (from api.ts on 401)
    const handleGlobalLogout = () => {
      handleLocalLogout();
    };
    window.addEventListener('shopos:logout', handleGlobalLogout);

    return () => {
      window.removeEventListener('shopos:logout', handleGlobalLogout);
    };
  }, []);

  const handleLocalLogout = () => {
    localStorage.removeItem('shopos_session');
    localStorage.removeItem('shopos_user');
    setState({ user: null, session_id: null, isAuthenticated: false });
  };

  const login = async (shop_id: string, username: string, password: string, device_info: string) => {
    const response: LoginResponse = await api.auth.login(shop_id, username, password, device_info);
    localStorage.setItem('shopos_session', response.session_id);
    localStorage.setItem('shopos_user', JSON.stringify(response.user));
    setState({
      session_id: response.session_id,
      user: response.user,
      isAuthenticated: true,
    });
  };

  const logout = async () => {
    if (state.session_id) {
      try {
        await api.auth.logout();
      } catch (e) {
        console.error("Logout failed", e);
      }
    }
    handleLocalLogout();
  };

  const logoutAll = async () => {
    if (!state.user) return 0;
    try {
      const count = await api.auth.logoutAll();
      handleLocalLogout();
      return count;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const getSessions = async () => {
    if (!state.user) return [];
    const sessions = await api.auth.getSessions();
    return sessions.map(s => ({
      ...s,
      is_current: s.session_id === state.session_id
    }));
  };

  const deleteSession = async (targetSessionId: string) => {
    await api.auth.deleteSession(targetSessionId);
    if (targetSessionId === state.session_id) {
      handleLocalLogout();
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, logoutAll, getSessions, deleteSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};