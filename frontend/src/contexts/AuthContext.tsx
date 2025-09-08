/**
 * Contexto de autenticação
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginRequest, AuthContextType } from '../types';
import { apiClient } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Verificar se o usuário é administrador
  const isAdmin = user?.role === 'admin';

  // Função de login
  const login = async (credentials: LoginRequest & { remember?: boolean }): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Fazer login via API
      const tokenResponse = await apiClient.login(credentials);
      const { access_token } = tokenResponse;
      
      // Salvar token sempre no localStorage para simplicidade do MVP
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
      // Obter dados do usuário atual
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
      
    } catch (error) {
      console.error('Erro no login:', error);
      localStorage.removeItem('access_token');
      setToken(null);
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Função de logout
  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint if token exists
      if (token) {
        await apiClient.logout();
      }
    } catch (error) {
      console.error('Erro no logout:', error);
      // Continue with logout even if API call fails
    }
    
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  // Verificar autenticação ao carregar a aplicação
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      
      if (storedToken) {
        try {
          // Verificar se o token ainda é válido
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
          setToken(storedToken);
        } catch (error) {
          console.error('Token inválido:', error);
          localStorage.removeItem('access_token');
          setToken(null);
          setUser(null);
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook customizado para usar o contexto de autenticação
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export default AuthContext;