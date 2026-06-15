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

  const [confirmLogoutId, setConfirmLogoutId] = useState<string | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const confirmLogoutSession = async () => {
    if (!confirmLogoutId) return;
    const id = confirmLogoutId;
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
      setConfirmLogoutId(null);
    }
  };

  const confirmLogoutAllDevices = async () => {
    setProcessingId('ALL');
    try {
      await logoutAll();
      navigate('/login');
    } catch (e) {
      toast.error('Failed to logout all devices');
      setProcessingId(null);
      setConfirmLogoutAll(false);
    }
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
                    onClick={() => setConfirmLogoutId(session.session_id)}
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
          onClick={() => setConfirmLogoutAll(true)}
          disabled={processingId === 'ALL'}
          className="w-full py-3.5 border-2 border-rose-500 text-rose-600 dark:text-rose-400 dark:border-rose-500/50 rounded-2xl font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center"
        >
          {processingId === 'ALL' ? <Loader2 className="animate-spin mr-2" size={20} /> : <LogOut size={20} className="mr-2" />}
          Log Out All Devices
        </button>
      </div>

      {/* Logout Single Session Modal */}
      {confirmLogoutId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card-modern shadow-2xl w-full max-w-sm animate-slide-up border border-rose-100 dark:border-rose-900/50">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-rose-100 dark:bg-rose-900/50 text-rose-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <LogOut size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Log out device?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Are you sure you want to disconnect this device? It will need to log in again.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/50 flex gap-3 bg-slate-50/50 dark:bg-slate-800/20">
              <button onClick={() => setConfirmLogoutId(null)} className="flex-1 btn-secondary !py-2.5">Cancel</button>
              <button onClick={confirmLogoutSession} disabled={processingId !== null} className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white font-bold rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout All Sessions Modal */}
      {confirmLogoutAll && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card-modern shadow-2xl w-full max-w-sm animate-slide-up border border-rose-100 dark:border-rose-900/50">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-rose-100 dark:bg-rose-900/50 text-rose-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <ShieldAlert size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Log out ALL devices?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                This will immediately disconnect every device currently logged into your account, including this one.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/50 flex gap-3 bg-slate-50/50 dark:bg-slate-800/20">
              <button onClick={() => setConfirmLogoutAll(false)} className="flex-1 btn-secondary !py-2.5">Cancel</button>
              <button onClick={confirmLogoutAllDevices} disabled={processingId !== null} className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white font-bold rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                Log Out All
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ActiveSessions;