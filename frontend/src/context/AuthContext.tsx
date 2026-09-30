import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, School } from '../types/index.ts';
import { api } from '../services/api.ts';

interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AuthContextType {
  user: User | null;
  activeSchool: School | null;
  isLoading: boolean;
  loginError: string | null;
  notification: NotificationState | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissNotification: () => void;
  switchSchoolContext: (schoolId: string | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeSchool, setActiveSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const dismissNotification = () => setNotification(null);

  const refreshUser = async () => {
    const token = localStorage.getItem('eduledger_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.auth.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        if (res.user.school) {
          setActiveSchool(res.user.school);
        } else if (res.user.role === 'super_admin') {
          // If super admin has a stored active school context, load it
          const storedSchoolId = localStorage.getItem('eduledger_active_school_id');
          if (storedSchoolId) {
            try {
              const schoolRes = await api.schools.getById(storedSchoolId);
              if (schoolRes.success) {
                setActiveSchool(schoolRes.school);
              }
            } catch {
              localStorage.removeItem('eduledger_active_school_id');
            }
          }
        }
      } else {
        localStorage.removeItem('eduledger_token');
        setUser(null);
      }
    } catch (e: any) {
      // If school deactivated or deleted while token active, log out cleanly
      localStorage.removeItem('eduledger_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);
    try {
      const res = await api.auth.login({ email, password });
      if (res.success && res.token) {
        localStorage.setItem('eduledger_token', res.token);
        setUser(res.user);
        if (res.user.school) {
          setActiveSchool(res.user.school);
        } else {
          setActiveSchool(null);
        }
        // Set initial tab based on role
        if (res.user.role === 'super_admin') {
          setActiveTab('schools');
        } else {
          setActiveTab('dashboard');
        }
        showNotification(res.message || 'Login successful! Welcome back.', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Login failure:', err);
      const msg = err.data?.message || err.message || 'Login failed. Please check your credentials.';
      setLoginError(msg);
      showNotification(msg, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('eduledger_token');
    localStorage.removeItem('eduledger_active_school_id');
    setUser(null);
    setActiveSchool(null);
    setActiveTab('dashboard');
    showNotification('Logged out successfully.', 'info');
  };

  const switchSchoolContext = async (schoolId: string | null) => {
    if (!schoolId) {
      localStorage.removeItem('eduledger_active_school_id');
      setActiveSchool(null);
      return;
    }

    try {
      const res = await api.schools.getById(schoolId);
      if (res.success) {
        localStorage.setItem('eduledger_active_school_id', schoolId);
        setActiveSchool(res.school);
        showNotification(`Switched school context to ${res.school.name}`, 'info');
      }
    } catch (err: any) {
      showNotification('Failed to switch school: ' + err.message, 'error');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeSchool,
        isLoading,
        loginError,
        notification,
        activeTab,
        setActiveTab,
        login,
        logout,
        showNotification,
        dismissNotification,
        switchSchoolContext,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
