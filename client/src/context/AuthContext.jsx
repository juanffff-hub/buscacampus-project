import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await api.getCurrentUser();
      setUser(result.user);
      setStatus("authenticated");
      return result.user;
    } catch (requestError) {
      setUser(null);
      if (requestError.status !== 401) setError(requestError);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (credentials) => {
    setError(null);
    const result = await api.login(credentials);
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  const signUp = useCallback(async (details) => {
    setError(null);
    return api.register(details);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await api.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      isAuthenticated: status === "authenticated" && user !== null,
      isLoading: status === "loading",
      refreshSession,
      login: signIn,
      register: signUp,
      logout: signOut,
    }),
    [user, status, error, refreshSession, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }
  return context;
}
