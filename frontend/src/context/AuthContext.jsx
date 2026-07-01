import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const storedRole = localStorage.getItem("role");

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedUser && storedRole) {
      try {
        setUser(JSON.parse(storedUser));
        setRole(storedRole);
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("role");
      }
    }

    setIsAuthReady(true);
  }, []);

  const login = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setRole(data.role);
    setIsAuthReady(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setRole(null);
    setIsAuthReady(true);
  };

  return (
    <AuthContext.Provider value={{ user, role, token, isAuthReady, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
