import React, { useState, useEffect } from 'react';
import Layout from '../components/common/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Settings, User, UserRole } from '../types';
import { Save, Calculator, Users, Settings as SettingsIcon, Key, Trash2, Plus, Check, X, AlertCircle, RefreshCw, Database, Download, HardDrive } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

type TabType = 'rates' | 'users' | 'system';

const SettingsPage: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const showAED = user?.shop_id !== 'CARWORLD';
  const [activeTab, setActiveTab] = useState<TabType>(user?.shop_id === 'CARWORLD' ? 'users' : 'rates');

  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    try {
      await api.settings.update({
        aed_rate: parseFloat(aedRate) || 36.5,
        conversion_percent: parseFloat(conversionPercent) || 13,
        default_min_stock: parseInt(defaultMinStock) || 5
      });
      toast.success('Settings saved successfully!');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) {
      toast.error('Please fill in all fields');
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
      toast.success('User created successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create user');
    }
  };

  const handleToggleUser = async (username: string, isActive: boolean) => {
    try {
      await api.users.update(username, { is_active: !isActive });
      loadUsers();
      toast.success(`User ${!isActive ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error('Failed to update user');
    }
  };

  const handleChangePassword = async (username: string) => {
    if (!newPassword) return;
    try {
      await api.users.update(username, { password_hash: newPassword });
      setChangingPassword(null);
      setNewPassword('');
      toast.success('Password updated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'admin') {
      toast.error('Cannot delete admin user');
      return;
    }
    toast((t) => (
      <div className="flex items-center gap-3">
        <AlertCircle size={18} className="text-rose-500 shrink-0" />
        <div>
          <p className="font-semibold text-sm">Delete user "{username}"?</p>
        </div>
        <div className="flex gap-2 ml-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-medium bg-slate-600 rounded-lg text-white">Cancel</button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await api.users.delete(username);
                loadUsers();
                toast.success('User deleted');
              } catch (e) {
                toast.error('Failed to delete user');
              }
            }}
            className="px-3 py-1.5 text-xs font-bold bg-rose-500 text-white rounded-lg"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  // Calculate landed cost
  const calcLandedCost = parseFloat(calcAed || '0') * parseFloat(aedRate || '36.5') * (1 + parseFloat(conversionPercent || '13') / 100);

  const isCarWorld = user?.shop_id === 'CARWORLD';

  const allTabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'rates', label: 'Rates', icon: <Calculator size={18} /> },
    { id: 'users', label: 'Users', icon: <Users size={18} /> },
    { id: 'system', label: 'System', icon: <SettingsIcon size={18} /> }
  ];
  const tabs = allTabs.filter(tab => !(isCarWorld && tab.id === 'rates'));

  return (
    <Layout title="Settings">
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6 animate-enter">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage rates, users, and system settings</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-1 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all duration-300 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* === RATES TAB === */}
        {activeTab === 'rates' && (
          <div className="space-y-6">
            {showAED && (
          <div className="card-modern p-6 mb-8 bg-blue-50 dark:bg-slate-800/50 border-blue-200 dark:border-blue-900/50">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <RefreshCw size={16} /> Cost Calculator Preview
            </h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Test AED:</span>
                <input 
                  type="number" 
                  value={calcAed} 
                  onChange={e => setCalcAed(e.target.value)} 
                  className="w-24 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" 
                />
              </div>
              <span className="text-slate-400">→</span>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-slate-500 font-medium">Landed Cost:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  KSh {Math.round(parseFloat(calcAed || '0') * parseFloat(aedRate || '0') * (1 + parseFloat(conversionPercent || '0') / 100)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          )}

            {/* Rate Settings */}
            <div className="card-modern p-5 lg:p-6 space-y-5">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Conversion Rates</h3>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Default Min Stock Alert</label>
                <input type="number" value={defaultMinStock} onChange={e => setDefaultMinStock(e.target.value)} className="input-modern" />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full btn-primary"
              >
                {saving ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
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
              className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:border-brand-500 hover:text-brand-500 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={20} />
              Add New User
            </button>

            {/* New User Form */}
            {showNewUser && (
              <div className="card-modern p-5 space-y-4 animate-slide-up">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">New User</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                    <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="input-modern" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                    <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="input-modern" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                    <input type="text" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="input-modern" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="input-modern">
                      <option value={UserRole.COUNTER}>Counter</option>
                      <option value={UserRole.WORKER}>Worker</option>
                      <option value={UserRole.ADMIN}>Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowNewUser(false)} className="flex-1 btn-secondary">Cancel</button>
                  <button onClick={handleCreateUser} className="flex-1 btn-primary">Create User</button>
                </div>
              </div>
            )}

            {/* Users List */}
            {users.map(u => (
              <div key={u.username} className="card-modern p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-lg">{u.full_name}</span>
                    <span className="text-sm text-slate-500 font-mono">@{u.username}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/50' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                      {u.role}
                    </span>
                  </div>
                  <div>
                    {u.is_active !== false ? (
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50">Active</span>
                    ) : (
                      <span className="text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800/50">Disabled</span>
                    )}
                  </div>
                </div>

                {/* Password Change */}
                {changingPassword === u.username ? (
                  <div className="flex gap-2 mt-3 animate-slide-up">
                    <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="flex-1 input-modern !py-2.5" />
                    <button onClick={() => handleChangePassword(u.username)} className="px-4 py-2.5 btn-primary !rounded-xl !text-sm">Save</button>
                    <button onClick={() => { setChangingPassword(null); setNewPassword(''); }} className="px-4 py-2.5 btn-secondary !rounded-xl !text-sm">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setChangingPassword(u.username)} className="flex-1 btn-secondary !py-2.5 flex items-center justify-center gap-2 !text-sm">
                      <Key size={14} />
                      Change Password
                    </button>
                    {u.username !== 'admin' && (
                      <>
                        <button onClick={() => handleToggleUser(u.username, u.is_active !== false)} className="btn-secondary !py-2.5 !text-sm">
                          {u.is_active !== false ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleDeleteUser(u.username)} className="py-2.5 px-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors">
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
            <div className="card-modern p-5 lg:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Database size={18} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Data Storage</h3>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5 mb-5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold mb-2">
                  <Check size={18} />
                  Cloud Backup Enabled
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 leading-relaxed">
                  All data is securely stored in Google Sheets and automatically synced. Your inventory, sales, and user data are protected in the cloud.
                </p>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2.5">
                <p><strong className="text-slate-700 dark:text-slate-300">Database:</strong> Google Sheets (ShopOS_DB)</p>
                <p><strong className="text-slate-700 dark:text-slate-300">Backup:</strong> Google maintains version history. Restore from Google Sheets.</p>
                <p><strong className="text-slate-700 dark:text-slate-300">Audit Trail:</strong> All changes are logged with timestamps and user info.</p>
              </div>
            </div>

            {/* Export Data */}
            <div className="card-modern p-5 lg:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/40 rounded-lg text-brand-600 dark:text-brand-400">
                  <Download size={18} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Export Data</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Download your data for offline backup or reporting.</p>
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
                      toast.success('Inventory exported!');
                    } catch (e) {
                      toast.error('Export failed');
                    }
                  }}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
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
                      toast.success('Sales exported!');
                    } catch (e) {
                      toast.error('Export failed');
                    }
                  }}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  Export Sales History (JSON)
                </button>
              </div>
            </div>

            {/* Clear Local Cache */}
            <div className="card-modern p-5 lg:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400">
                  <HardDrive size={18} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Local Cache</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                Clear locally cached data. This will NOT delete your actual data (which is in Google Sheets).
              </p>
              <button
                onClick={() => {
                  toast((t) => (
                    <div className="flex items-center gap-3">
                      <AlertCircle size={18} className="text-amber-500 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">Clear local cache?</p>
                        <p className="text-xs opacity-70">You'll need to login again.</p>
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-medium bg-slate-600 rounded-lg text-white">Cancel</button>
                        <button onClick={() => { toast.dismiss(t.id); localStorage.clear(); window.location.reload(); }} className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg">Clear</button>
                      </div>
                    </div>
                  ), { duration: 8000 });
                }}
                className="w-full py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
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