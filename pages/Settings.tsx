import React, { useState, useEffect } from 'react';
import Layout from '../components/common/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Settings, User, UserRole } from '../types';
import { Save, Calculator, Users, Settings as SettingsIcon, Key, Trash2, Plus, Check, X, AlertCircle, RefreshCw } from 'lucide-react';

type TabType = 'rates' | 'users' | 'system';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('rates');

  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Local edit state
  const [aedRate, setAedRate] = useState('36.5');
  const [conversionPercent, setConversionPercent] = useState('13');
  const [defaultMinStock, setDefaultMinStock] = useState('5');

  // Calculator state
  const [calcAed, setCalcAed] = useState('100');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: UserRole.COUNTER });

  // Password change state
  const [changingPassword, setChangingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.settings.get();
      setSettings(s);
      setAedRate(s.aed_rate.toString());
      setConversionPercent(s.conversion_percent.toString());
      setDefaultMinStock(s.default_min_stock.toString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const u = await api.users.getAll();
      setUsers(u);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.settings.update({
        aed_rate: parseFloat(aedRate) || 36.5,
        conversion_percent: parseFloat(conversionPercent) || 13,
        default_min_stock: parseInt(defaultMinStock) || 5
      });
      setMessage({ type: 'success', text: 'Settings saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) {
      setMessage({ type: 'error', text: 'Fill all fields' });
      return;
    }
    try {
      await api.users.create({
        username: newUser.username.toLowerCase().trim(),
        password_hash: newUser.password,
        full_name: newUser.full_name.trim(),
        role: newUser.role
      });
      setNewUser({ username: '', password: '', full_name: '', role: UserRole.COUNTER });
      setShowNewUser(false);
      loadUsers();
      setMessage({ type: 'success', text: 'User created!' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to create user' });
    }
  };

  const handleToggleUser = async (username: string, isActive: boolean) => {
    try {
      await api.users.update(username, { is_active: !isActive });
      loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async (username: string) => {
    if (!newPassword) return;
    try {
      await api.users.update(username, { password_hash: newPassword });
      setChangingPassword(null);
      setNewPassword('');
      setMessage({ type: 'success', text: 'Password updated!' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update password' });
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'admin') {
      setMessage({ type: 'error', text: 'Cannot delete admin user' });
      return;
    }
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await api.users.delete(username);
      loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate landed cost
  const calcLandedCost = parseFloat(calcAed || '0') * parseFloat(aedRate || '36.5') * (1 + parseFloat(conversionPercent || '13') / 100);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'rates', label: 'Rates', icon: <Calculator size={18} /> },
    { id: 'users', label: 'Users', icon: <Users size={18} /> },
    { id: 'system', label: 'System', icon: <SettingsIcon size={18} /> }
  ];

  return (
    <Layout title="Settings">
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b dark:border-gray-700 pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* === RATES TAB === */}
        {activeTab === 'rates' && (
          <div className="space-y-6">
            {/* Calculator Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-xl shadow-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calculator size={20} className="text-brand-400" />
                <h2 className="font-bold text-lg">Dubai Cost Calculator</h2>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">AED Price</label>
                  <input
                    type="number"
                    value={calcAed}
                    onChange={e => setCalcAed(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-mono focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <span className="text-2xl text-gray-500 font-light">→</span>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-brand-300 block mb-1">Landed KES</label>
                  <div className="w-full bg-brand-900/40 border border-brand-500/30 rounded-lg px-3 py-2 text-brand-300 font-mono font-bold text-lg">
                    {calcLandedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Formula: AED × {aedRate} × (1 + {conversionPercent}%) = KES
              </div>
            </div>

            {/* Rate Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Conversion Rates</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">AED Exchange Rate (KES per 1 AED)</label>
                <input
                  type="number"
                  step="0.1"
                  value={aedRate}
                  onChange={e => setAedRate(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Import/Conversion Percentage (%)</label>
                <input
                  type="number"
                  step="1"
                  value={conversionPercent}
                  onChange={e => setConversionPercent(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">E.g., 13% for shipping, customs, and handling overhead</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Min Stock Alert</label>
                <input
                  type="number"
                  value={defaultMinStock}
                  onChange={e => setDefaultMinStock(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white"
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* === USERS TAB === */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Add User Button */}
            <button
              onClick={() => setShowNewUser(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 font-medium hover:border-brand-500 hover:text-brand-500 flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New User
            </button>

            {/* New User Form */}
            {showNewUser && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">New User</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Username</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Password</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={newUser.full_name}
                      onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Role</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white text-sm"
                    >
                      <option value={UserRole.COUNTER}>Counter</option>
                      <option value={UserRole.WORKER}>Worker</option>
                      <option value={UserRole.ADMIN}>Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewUser(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-medium">Cancel</button>
                  <button onClick={handleCreateUser} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-bold">Create User</button>
                </div>
              </div>
            )}

            {/* Users List */}
            {users.map(u => (
              <div key={u.username} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">{u.full_name}</span>
                    <span className="text-sm text-gray-500 ml-2">@{u.username}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_active !== false ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded">Disabled</span>
                    )}
                  </div>
                </div>

                {/* Password Change */}
                {changingPassword === u.username ? (
                  <div className="flex gap-2 mt-3">
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="flex-1 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                    />
                    <button onClick={() => handleChangePassword(u.username)} className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">Save</button>
                    <button onClick={() => { setChangingPassword(null); setNewPassword(''); }} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setChangingPassword(u.username)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <Key size={14} />
                      Change Password
                    </button>
                    {u.username !== 'admin' && (
                      <>
                        <button onClick={() => handleToggleUser(u.username, u.is_active !== false)} className="py-2 px-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm">
                          {u.is_active !== false ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleDeleteUser(u.username)} className="py-2 px-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* === SYSTEM TAB === */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            {/* Data Storage Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Data Storage</h3>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                  <Check size={18} />
                  Cloud Backup Enabled
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  All data is securely stored in Google Sheets and automatically synced. Your inventory, sales, and user data are protected in the cloud.
                </p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                <p><strong>Database:</strong> Google Sheets (ShopOS_DB)</p>
                <p><strong>Backup:</strong> Google automatically maintains version history. You can view/restore previous versions in Google Sheets.</p>
                <p><strong>Audit Trail:</strong> All changes are logged with timestamps and user info.</p>
              </div>
            </div>

            {/* Export Data */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Export Data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Download your data for offline backup or reporting.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      const inventory = await api.inventory.getAll();
                      const blob = new Blob([JSON.stringify(inventory, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `shopos-inventory-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      setMessage({ type: 'success', text: 'Inventory exported!' });
                    } catch (e) {
                      setMessage({ type: 'error', text: 'Export failed' });
                    }
                  }}
                  className="w-full py-3 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg font-medium hover:bg-brand-200 dark:hover:bg-brand-900/50"
                >
                  Export Inventory (JSON)
                </button>
                <button
                  onClick={async () => {
                    try {
                      const sales = await api.sales.getAll();
                      const blob = new Blob([JSON.stringify(sales, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `shopos-sales-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      setMessage({ type: 'success', text: 'Sales exported!' });
                    } catch (e) {
                      setMessage({ type: 'error', text: 'Export failed' });
                    }
                  }}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Export Sales History (JSON)
                </button>
              </div>
            </div>

            {/* Clear Local Cache */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Local Cache</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Clear locally cached data. This will NOT delete your actual data (which is in Google Sheets).
              </p>
              <button
                onClick={() => {
                  if (confirm('Clear local cache? You will need to login again. Your actual data is safe in Google Sheets.')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full py-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg font-medium"
              >
                Clear Local Cache & Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SettingsPage;