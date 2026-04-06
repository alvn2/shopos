import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, Wifi, WifiOff, Eye, EyeOff, ShieldCheck, Package } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connectionDetails, setConnectionDetails] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const usernameRef = useRef<HTMLInputElement>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Auto-focus username on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionDetails('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('ok');
        setConnectionDetails(data.sheets_title ? `Connected to ${data.sheets_title}` : 'Backend online');
      } else {
        setConnectionStatus('error');
        setConnectionDetails(`Server error: ${response.status}`);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionDetails(err.name === 'AbortError' ? 'Connection timeout' : (err.message || 'Cannot reach server'));
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
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Network error — check your internet connection');
      } else if (err.message?.includes('CORS')) {
        setError('Connection blocked — please try again');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Invalid credentials or account disabled');
      }
    } finally {
      setLoading(false);
    }
  };

  const connectionColor = connectionStatus === 'ok' ? 'text-emerald-400' :
    connectionStatus === 'error' ? 'text-rose-400' :
    connectionStatus === 'testing' ? 'text-amber-400' : 'text-slate-500';

  const connectionIcon = connectionStatus === 'ok' ? <Wifi size={14} /> :
    connectionStatus === 'error' ? <WifiOff size={14} /> :
    connectionStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> :
    <Wifi size={14} />;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 selection:bg-brand-500/30">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-10 w-96 h-96 bg-brand-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" />
        <div className="absolute top-1/2 right-10 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-20 left-1/3 w-[25rem] h-[25rem] bg-cyan-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-transparent bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950/80 to-slate-950" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-up">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-brand-600 to-indigo-500 p-[2px] rounded-2xl shadow-glow shadow-brand-500/30 mb-6 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
            <div className="w-full h-full bg-slate-950/80 backdrop-blur-xl rounded-2xl flex items-center justify-center">
              <Package size={36} className="text-white" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">ShopOS</h1>
          <p className="text-slate-400 font-medium tracking-wide">Inventory Management System</p>
        </div>

        {/* Glass Card */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-brand-500/30 to-indigo-500/10 rounded-3xl blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />

          <div className="relative bg-slate-900/60 backdrop-blur-2xl border border-white/10 border-b-black/50 border-r-black/50 p-8 sm:p-10 rounded-3xl shadow-2xl">

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8 text-sm flex items-start gap-3 animate-slide-up">
                <WifiOff size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Account ID</label>
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none text-white placeholder-slate-600 transition-all duration-300 font-medium hover:bg-slate-900/80 focus:bg-slate-900/80"
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1.5 pb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Passphrase</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 pr-14 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none text-white placeholder-slate-600 transition-all duration-300 font-medium hover:bg-slate-900/80 focus:bg-slate-900/80"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-4 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all duration-300 shadow-glow shadow-brand-500/25 flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 group"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <span className="flex items-center gap-2 text-base tracking-wide">
                    <ShieldCheck size={18} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                    Sign In
                  </span>
                )}
              </button>
            </form>

            {/* Connection Status */}
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={testConnection}
                disabled={connectionStatus === 'testing'}
                className={`flex items-center gap-2 text-xs font-medium transition-all hover:opacity-80 ${connectionColor}`}
                title={connectionDetails || 'Click to test connection'}
              >
                {connectionIcon}
                <span>
                  {connectionStatus === 'ok' ? connectionDetails :
                   connectionStatus === 'error' ? 'Connection failed — tap to retry' :
                   connectionStatus === 'testing' ? 'Testing connection...' :
                   'System Online'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-10 font-medium">
          Powered by ShopOS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;