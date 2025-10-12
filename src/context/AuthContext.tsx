'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'invoice_flow_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedAuth = sessionStorage.getItem(AUTH_KEY);
      if (storedAuth === 'true') {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Could not access sessionStorage:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const login = () => {
    try {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
    } catch (error) {
        console.error("Could not access sessionStorage:", error);
        // If session storage is not available, just set the state for the current session
        setIsAuthenticated(true);
    }
  };

  const logout = () => {
    try {
        sessionStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
    } catch (error) {
        console.error("Could not access sessionStorage:", error);
        setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
