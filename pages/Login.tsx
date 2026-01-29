import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, Wifi, WifiOff } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connectionDetails, setConnectionDetails] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Get API URL for testing
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionDetails('');
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('ok');
        setConnectionDetails(`Connected to backend (${data.sheets_title || 'OK'})`);
      } else {
        setConnectionStatus('error');
        setConnectionDetails(`Server error: ${response.status}`);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionDetails(`${err.message || 'Cannot reach server'} - API: ${apiUrl}`);
    }
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("SamsungBrowser")) browser = "Samsung Internet";
    else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
    else if (ua.includes("Edge")) browser = "Edge";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";

    let os = "Unknown OS";
    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac")) os = "MacOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("like Mac")) os = "iOS";

    return `${browser} on ${os}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const deviceInfo = getDeviceInfo();
      await login(username, password, deviceInfo);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      // Show specific error if available
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Network error - check your internet connection');
      } else if (err.message?.includes('CORS')) {
        setError('Connection blocked - please try again');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Invalid credentials or account disabled');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-teal-700 px-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md text-white">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center text-brand-600 mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">ShopOS</h1>
          <p className="text-brand-100 mt-2">Login to manage inventory</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-brand-100 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none text-white placeholder-white/30 transition-all"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-100 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none text-white placeholder-white/30 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-white text-brand-700 font-bold rounded-lg hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-brand-700 transition-all shadow-lg flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : 'Sign In'}
          </button>
        </form>

        {/* Connection Status - only show if there's an issue */}
        {connectionStatus === 'error' && connectionDetails && (
          <div className="mt-4 text-center">
            <p className="text-xs text-red-300">{connectionDetails}</p>
            <button
              type="button"
              onClick={testConnection}
              disabled={connectionStatus === 'testing'}
              className="mt-2 text-xs text-white/50 hover:text-white/70 underline"
            >
              Retry connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;