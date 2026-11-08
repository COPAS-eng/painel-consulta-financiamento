import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthTokens, clearAuthTokens, getAccessToken } from '../lib/api';
import { User, AuthTokens, LoginCredentials, RegisterData } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get<User>('/auth/me');
      setUser(response.data);
    } catch {
      clearAuthTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (credentials: LoginCredentials) => {
    const response = await api.post<AuthTokens>('/auth/login', credentials);
    setAuthTokens(response.data.accessToken, response.data.refreshToken);
    await fetchUser();
  };

  const register = async (data: RegisterData) => {
    const response = await api.post<AuthTokens>('/auth/register', data);
    setAuthTokens(response.data.accessToken, response.data.refreshToken);
    await fetchUser();
  };

  const logout = () => {
    clearAuthTokens();
    setUser(null);
  };

  const refreshUser = fetchUser;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}