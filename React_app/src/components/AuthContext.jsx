import { createContext, useState, useContext } from "react";
import { validUsers } from "./Users";
import { useEffect } from "react";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // Novo estado de carregamento

  const login = (username, password) => {
    const user = validUsers.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      setCurrentUser(user);
      localStorage.setItem("currentUser", JSON.stringify(user)); // Persiste o usuário no localStorage
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser"); // Remove o usuário do localStorage
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error(
        "AuthProvider useEffect: Erro ao parsear usuário do localStorage",
        error,
      );
      localStorage.removeItem("currentUser"); // Limpa se estiver corrompido
    } finally {
      setAuthLoading(false); // Define como false após a tentativa de carregar
    }
  }, [setCurrentUser]); // Array de dependências vazio para executar apenas na montagem

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
