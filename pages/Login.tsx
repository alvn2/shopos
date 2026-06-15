import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Wifi, WifiOff, Eye, EyeOff, ShieldCheck, Package } from 'lucide-react';

const Login: React.FC = () => {
  const [shopId, setShopId] = useState('STEPMOTORS');
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

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionDetails('Testing connection...');
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
        setConnectionStatus('ok');
        setConnectionDetails('System Online');
      } else {
        setConnectionStatus('error');
        setConnectionDetails(`Server Error: ${response.status}`);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionDetails('Offline / Unreachable');
    }
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("SamsungBrowser")) browser = "Samsung";
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
      await login(shopId, username, password, deviceInfo);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Network Error');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Access Denied');
      }
    } finally {
      setLoading(false);
    }
  };

  const connectionColor = connectionStatus === 'ok' ? 'text-emerald-400' :
    connectionStatus === 'error' ? 'text-rose-400' :
    connectionStatus === 'testing' ? 'text-amber-400' : 'text-slate-400';
    
  const connectionIcon = connectionStatus === 'ok' ? <Wifi size={14} /> :
    connectionStatus === 'error' ? <WifiOff size={14} /> :
    connectionStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> :
    <Wifi size={14} />;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Lively Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-10 w-96 h-96 bg-blue-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 right-10 w-[30rem] h-[30rem] bg-indigo-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-bounce" style={{ animationDuration: '7s' }} />
        <div className="absolute -bottom-20 left-1/3 w-[25rem] h-[25rem] bg-cyan-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-cyan-400 to-indigo-600 p-[3px] rounded-[2rem] shadow-2xl shadow-indigo-500/50 mb-6 transform hover:rotate-12 hover:scale-105 transition-all duration-500 cursor-pointer">
            <div className="w-full h-full bg-slate-900/90 backdrop-blur-2xl rounded-[1.8rem] flex items-center justify-center">
              <Package size={44} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 mb-2 drop-shadow-sm">ShopOS</h1>
          <p className="text-slate-300 font-medium tracking-wide">Next-Gen Inventory System</p>
        </div>

        {/* Glassmorphism Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 rounded-3xl blur-md opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>

          <div className="relative bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-8 text-sm flex items-start gap-3">
                <WifiOff size={18} className="shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300 ml-1">Select Shop</label>
                <div className="relative">
                  <select
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    className="w-full pl-5 pr-10 py-4 bg-slate-950/50 border border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none text-white transition-all duration-300 font-semibold hover:bg-slate-900/80 appearance-none shadow-inner"
                    required
                  >
                    <option value="STEPMOTORS">StepMotors</option>
                    <option value="CARWORLD">CarWorld Auto</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300 ml-1">Account ID</label>
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-950/50 border border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none text-white placeholder-slate-500 transition-all duration-300 font-medium hover:bg-slate-900/80 shadow-inner"
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2 pb-4">
                <div className="flex justify-between items-center px-1">
                  <label className="block text-sm font-semibold text-slate-300">Password</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-5 pr-14 py-4 bg-slate-950/50 border border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none text-white placeholder-slate-500 transition-all duration-300 font-medium hover:bg-slate-900/80 shadow-inner"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/10"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-4 px-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed group text-lg"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <span className="flex items-center gap-3">
                    <ShieldCheck size={22} className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    Sign In to Dashboard
                  </span>
                )}
              </button>
            </form>

            {/* Connection Status */}
            <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={testConnection}
                disabled={connectionStatus === 'testing'}
                className={`flex items-center gap-2 text-sm font-semibold transition-all hover:brightness-125 ${connectionColor} bg-slate-950/40 px-4 py-2 rounded-full border border-white/5`}
              >
                {connectionIcon}
                <span>{connectionDetails}</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8 font-medium">
          ShopOS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;