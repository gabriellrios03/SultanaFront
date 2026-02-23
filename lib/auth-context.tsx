'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Empresa } from './types';

interface AuthContextType {
  token: string | null;
  selectedEmpresa: Empresa | null;
  setToken: (token: string | null) => void;
  setSelectedEmpresa: (empresa: Empresa | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [selectedEmpresa, setSelectedEmpresaState] = useState<Empresa | null>(null);

  useEffect(() => {
    // Cargar token y empresa del localStorage al iniciar
    const savedToken = localStorage.getItem('token');
    const savedEmpresa = localStorage.getItem('selectedEmpresa');
    
    if (savedToken) {
      setTokenState(savedToken);
    }
    if (savedEmpresa) {
      setSelectedEmpresaState(JSON.parse(savedEmpresa));
    }
  }, []);

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
  };

  const setSelectedEmpresa = (empresa: Empresa | null) => {
    setSelectedEmpresaState(empresa);
    if (empresa) {
      localStorage.setItem('selectedEmpresa', JSON.stringify(empresa));
    } else {
      localStorage.removeItem('selectedEmpresa');
    }
  };

  const logout = () => {
    setTokenState(null);
    setSelectedEmpresaState(null);
    localStorage.removeItem('token');
    localStorage.removeItem('selectedEmpresa');
  };

  return (
    <AuthContext.Provider value={{ token, selectedEmpresa, setToken, setSelectedEmpresa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
