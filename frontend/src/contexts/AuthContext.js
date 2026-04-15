import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    setUser(data);
    return data;
  };

  const register = async (email, password, name) => {
    const { data } = await axios.post(`${API}/auth/register`, { email, password, name }, { withCredentials: true });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    setUser(false);
  };

  const forgotPassword = async (email) => {
    const { data } = await axios.post(`${API}/auth/forgot-password`, { email });
    return data;
  };

  const verifyOtp = async (email, otp) => {
    const { data } = await axios.post(`${API}/auth/verify-otp`, { email, otp });
    return data;
  };

  const resetPassword = async (email, otp, new_password) => {
    const { data } = await axios.post(`${API}/auth/reset-password`, { email, otp, new_password });
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, forgotPassword, verifyOtp, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
