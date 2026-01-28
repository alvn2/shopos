import React, { useEffect, useState } from 'react';
import Header from '../components/common/Header';
import BottomNav from '../components/common/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { Session } from '../types';
import { Laptop, Smartphone, Globe, LogOut, ShieldAlert, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    const interval = setInterval(fetchSessions, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleLogoutSession = async (id: string) => {
    if (!window.confirm("Are you sure you want to log out this device?")) return;
    setProcessingId(id);
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.session_id !== id));
      if (id === session_id) navigate('/login');
    } catch (e) {
      alert("Failed to logout session");
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("CRITICAL: This will log you out from ALL devices including this one. Continue?")) return;
    setProcessingId('ALL');
    try {
      await logoutAll();
      navigate('/login');
    } catch (e) {
      alert("Failed to logout all devices");
      setProcessingId(null);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <Header title="Active Sessions" />

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start space-x-3">
           <ShieldAlert className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
           <div className="text-sm text-blue-800 dark:text-blue-200">
             <p className="font-semibold">Security Notice</p>
             <p>Review your active sessions regularly. If you see a device you don't recognize, log it out immediately.</p>
           </div>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => (
              <div 
                key={session.session_id} 
                className={`bg-white dark:bg-gray-800 rounded-lg p-4 border shadow-sm transition-all ${session.is_current ? 'border-brand-500 ring-1 ring-brand-500/20' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${session.is_current ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {getDeviceIcon(session.device_info)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{session.device_info}</h3>
                        {session.is_current && (
                          <span className="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                        <p className="flex items-center"><Globe size={10} className="mr-1"/> IP: {session.ip_address}</p>
                        <p>Last active: {formatTime(session.last_active)}</p>
                        <p>Logged in: {new Date(session.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleLogoutSession(session.session_id)}
                    disabled={processingId === session.session_id}
                    className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {processingId === session.session_id ? <Loader2 className="animate-spin" size={20}/> : <LogOut size={20} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={handleLogoutAll}
          disabled={processingId === 'ALL'}
          className="w-full py-3 border-2 border-red-500 text-red-600 dark:text-red-400 dark:border-red-500/50 rounded-lg font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center"
        >
          {processingId === 'ALL' ? <Loader2 className="animate-spin mr-2" size={20} /> : <LogOut size={20} className="mr-2" />}
          Log Out All Devices
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ActiveSessions;