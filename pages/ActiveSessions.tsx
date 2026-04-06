import React, { useEffect, useState } from 'react';
import Layout from '../components/common/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Session } from '../types';
import { Laptop, Smartphone, Globe, LogOut, ShieldAlert, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';

const ActiveSessions: React.FC = () => {
  const { getSessions, deleteSession, logoutAll, session_id } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogoutSession = async (id: string) => {
    toast((t) => (
      <div className="flex items-center gap-3">
        <LogOut size={18} className="text-rose-500 shrink-0" />
        <p className="font-semibold text-sm">Log out this device?</p>
        <div className="flex gap-2 ml-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-medium bg-slate-600 rounded-lg text-white">Cancel</button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              setProcessingId(id);
              try {
                await deleteSession(id);
                setSessions(prev => prev.filter(s => s.session_id !== id));
                if (id === session_id) navigate('/login');
                toast.success('Session logged out');
              } catch (e) {
                toast.error('Failed to logout session');
              } finally {
                setProcessingId(null);
              }
            }}
            className="px-3 py-1.5 text-xs font-bold bg-rose-500 text-white rounded-lg"
          >
            Log Out
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const handleLogoutAll = async () => {
    toast((t) => (
      <div className="flex items-center gap-3">
        <ShieldAlert size={18} className="text-rose-500 shrink-0" />
        <div>
          <p className="font-semibold text-sm">Log out ALL devices?</p>
          <p className="text-xs opacity-70">Including this one</p>
        </div>
        <div className="flex gap-2 ml-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-medium bg-slate-600 rounded-lg text-white">Cancel</button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              setProcessingId('ALL');
              try {
                await logoutAll();
                navigate('/login');
              } catch (e) {
                toast.error('Failed to logout all devices');
                setProcessingId(null);
              }
            }}
            className="px-3 py-1.5 text-xs font-bold bg-rose-500 text-white rounded-lg"
          >
            Log Out All
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const getDeviceIcon = (info: string) => {
    const lower = info.toLowerCase();
    if (lower.includes('android') || lower.includes('iphone') || lower.includes('mobile')) {
      return <Smartphone size={24} />;
    }
    return <Laptop size={24} />;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout title="Active Sessions">
      <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6 animate-enter">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Active Sessions</h1>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-5 flex items-start gap-3">
          <ShieldAlert className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-bold">Security Notice</p>
            <p className="mt-1">Review your active sessions regularly. If you see a device you don't recognize, log it out immediately.</p>
          </div>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <div
                key={session.session_id}
                className={`card-modern p-5 transition-all ${session.is_current ? '!border-brand-500 ring-2 ring-brand-500/20' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${session.is_current ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {getDeviceIcon(session.device_info)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-white">{session.device_info}</h3>
                        {session.is_current && (
                          <span className="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest border border-brand-200 dark:border-brand-800/50">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 space-y-1 font-medium">
                        <p className="flex items-center gap-1"><Globe size={10} /> IP: <span className="font-mono">{session.ip_address}</span></p>
                        <p>Last active: {formatTime(session.last_active)}</p>
                        <p>Logged in: {new Date(session.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLogoutSession(session.session_id)}
                    disabled={processingId === session.session_id}
                    className="text-slate-400 hover:text-rose-600 p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    {processingId === session.session_id ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleLogoutAll}
          disabled={processingId === 'ALL'}
          className="w-full py-3.5 border-2 border-rose-500 text-rose-600 dark:text-rose-400 dark:border-rose-500/50 rounded-2xl font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center"
        >
          {processingId === 'ALL' ? <Loader2 className="animate-spin mr-2" size={20} /> : <LogOut size={20} className="mr-2" />}
          Log Out All Devices
        </button>

        <Toaster position="top-right" toastOptions={{
          style: { borderRadius: '12px', background: '#1e293b', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } }
        }} />
      </div>
    </Layout>
  );
};

export default ActiveSessions;