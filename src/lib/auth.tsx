import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
const SESSION_KEY = 'tgl-admin-session';

interface AuthState {
  isAdmin: boolean;
  signIn: (password: string) => string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  isAdmin: false,
  signIn: () => null,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    if (!ADMIN_PASSWORD) return false;
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  });

  const signIn = useCallback((password: string): string | null => {
    if (!ADMIN_PASSWORD) return 'Admin access is not configured';
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAdmin(true);
      return null;
    }
    return 'Incorrect password';
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
