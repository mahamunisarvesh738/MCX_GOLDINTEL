import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('goldintel_token') || null);
  const [loading, setLoading] = useState(true);

  // Configure default Axios header when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('goldintel_token', token);
      fetchUserProfile();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('goldintel_token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/auth/me');
      if (res.data?.success) {
        setUser(res.data.user);
      }
    } catch (e) {
      console.warn('Failed to fetch user profile with stored token:', e.message);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogleCredential = async (credential, userInfo = null) => {
    try {
      const res = await axios.post('/api/auth/google', { credential, userInfo });
      if (res.data?.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
      return { success: false, error: err.response?.data?.message || err.message };
    }
  };

  const loginAsDemo = async (role = 'QUANT_ANALYST', name = 'Senior Quant Trader') => {
    try {
      const res = await axios.post('/api/auth/demo-login', { role, name });
      if (res.data?.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
    } catch (err) {
      console.error('Demo Login Error:', err);
      return { success: false, error: err.response?.data?.message || err.message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      loginWithGoogleCredential,
      loginAsDemo,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
